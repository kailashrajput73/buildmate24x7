using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BuildMate.Services.Erp;

/// <summary>
/// ERP integration. The ERP vendor is not decided yet, so business code only writes events to an
/// outbox (same DB transaction as the change). A background worker delivers them through the
/// configured IErpConnector, with retries. Swapping in Tally / Busy / Zoho / SAP B1 later means
/// implementing IErpConnector — nothing else changes.
/// </summary>
public static class ErpEvents
{
    public const string ProductUpserted = "product.upserted";
    public const string PurchaseCreated = "purchase.created";
    public const string OrderPaid = "order.paid";
    public const string OrderDispatched = "order.dispatched";
    public const string OrderCancelled = "order.cancelled";
    public const string StockAdjusted = "stock.adjusted";
    public const string PartnerApproved = "partner.approved";
}

public class ErpOptions
{
    /// <summary>"None" (events are recorded and skipped) or "Webhook".</summary>
    public string Provider { get; set; } = "None";
    public string? WebhookUrl { get; set; }
    public string? WebhookSecret { get; set; }
    public int PollSeconds { get; set; } = 30;
    public int MaxAttempts { get; set; } = 8;
}

public interface IOutbox
{
    /// <summary>Queues an event. It is persisted when the caller saves the DbContext.</summary>
    void Add(string eventType, object payload);
}

public class Outbox : IOutbox
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;
    public Outbox(AppDbContext db) => _db = db;

    public void Add(string eventType, object payload) =>
        _db.OutboxMessages.Add(new OutboxMessage
        {
            EventType = eventType,
            Payload = JsonSerializer.Serialize(payload, Json),
            NextAttemptAt = DateTime.UtcNow
        });
}

public enum ErpDeliveryResult { Delivered, Skipped }

public interface IErpConnector
{
    string Name { get; }
    Task<ErpDeliveryResult> DeliverAsync(string eventType, string payloadJson, long messageId, CancellationToken ct);
}

public class NoErpConnector : IErpConnector
{
    public string Name => "None";
    public Task<ErpDeliveryResult> DeliverAsync(string eventType, string payloadJson, long messageId, CancellationToken ct) =>
        Task.FromResult(ErpDeliveryResult.Skipped);
}

/// <summary>
/// Generic connector: POSTs each event as JSON to a middleware endpoint (e.g. a Tally ODBC/XML bridge).
/// Header X-BuildMate-Signature = hex(HMAC-SHA256(body, secret)); X-BuildMate-Event-Id for idempotency.
/// </summary>
public class WebhookErpConnector : IErpConnector
{
    private readonly HttpClient _http;
    private readonly ErpOptions _opt;

    public WebhookErpConnector(HttpClient http, IOptions<ErpOptions> opt)
    {
        _http = http;
        _opt = opt.Value;
    }

    public string Name => "Webhook";

    public async Task<ErpDeliveryResult> DeliverAsync(string eventType, string payloadJson, long messageId, CancellationToken ct)
    {
        var body = $"{{\"id\":{messageId},\"type\":{JsonSerializer.Serialize(eventType)},\"data\":{payloadJson}}}";
        using var req = new HttpRequestMessage(HttpMethod.Post, _opt.WebhookUrl)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        req.Headers.Add("X-BuildMate-Event-Id", messageId.ToString());
        if (!string.IsNullOrEmpty(_opt.WebhookSecret))
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_opt.WebhookSecret));
            req.Headers.Add("X-BuildMate-Signature", Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(body))).ToLowerInvariant());
        }
        using var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        return ErpDeliveryResult.Delivered;
    }
}

/// <summary>Delivers pending outbox messages with exponential backoff.</summary>
public class OutboxProcessor : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ErpOptions _opt;
    private readonly ILogger<OutboxProcessor> _log;

    public OutboxProcessor(IServiceScopeFactory scopes, IOptions<ErpOptions> opt, ILogger<OutboxProcessor> log)
    {
        _scopes = scopes;
        _opt = opt.Value;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await ProcessBatchAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { _log.LogError(ex, "Outbox batch failed"); }

            try { await Task.Delay(TimeSpan.FromSeconds(Math.Max(5, _opt.PollSeconds)), stoppingToken); }
            catch (TaskCanceledException) { }
        }
    }

    public async Task ProcessBatchAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var connector = scope.ServiceProvider.GetRequiredService<IErpConnector>();
        var now = DateTime.UtcNow;

        var batch = await db.OutboxMessages
            .Where(m => m.Status == OutboxStatus.Pending && (m.NextAttemptAt == null || m.NextAttemptAt <= now))
            .OrderBy(m => m.Id)
            .Take(50)
            .ToListAsync(ct);

        foreach (var m in batch)
        {
            try
            {
                var result = await connector.DeliverAsync(m.EventType, m.Payload, m.Id, ct);
                m.Status = result == ErpDeliveryResult.Delivered ? OutboxStatus.Processed : OutboxStatus.Skipped;
                m.ProcessedAt = DateTime.UtcNow;
                m.LastError = null;
            }
            catch (Exception ex)
            {
                m.Attempts++;
                m.LastError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
                if (m.Attempts >= _opt.MaxAttempts) m.Status = OutboxStatus.Failed;
                else m.NextAttemptAt = DateTime.UtcNow.AddSeconds(Math.Pow(2, m.Attempts) * 30);
                _log.LogWarning(ex, "ERP delivery failed for outbox {Id} ({Type}), attempt {Attempt}", m.Id, m.EventType, m.Attempts);
            }
        }
        if (batch.Count > 0) await db.SaveChangesAsync(ct);
    }
}
