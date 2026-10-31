using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using BuildMate.Services.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BuildMate.Services.Payments;

public class CashfreeOptions
{
    /// <summary>"sandbox" or "production".</summary>
    public string Environment { get; set; } = "sandbox";
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string ApiVersion { get; set; } = "2023-08-01";
    /// <summary>Where the browser returns after payment, e.g. https://buildmate24x7.in/checkout/return?order_id={order_id}</summary>
    public string WebReturnUrl { get; set; } = "";
    /// <summary>Public URL of our webhook endpoint: https://api.../api/payments/cashfree/webhook</summary>
    public string NotifyUrl { get; set; } = "";

    public string BaseUrl => Environment == "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

    public bool KeysSet => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);

    /// <summary>Set-up problems that stop payments from working (shown in admin → Integrations and logged at start-up).</summary>
    public List<string> Problems()
    {
        var p = new List<string>();
        if (Environment is not ("sandbox" or "production")) p.Add($"Cashfree:Environment must be \"sandbox\" or \"production\" (now \"{Environment}\").");
        if (!KeysSet) p.Add("Cashfree keys are empty: set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET (Cashfree dashboard → Developers → API keys).");
        foreach (var (name, url) in new[] { ("WebReturnUrl (SITE_URL)", WebReturnUrl), ("NotifyUrl (PUBLIC_API_URL)", NotifyUrl) })
        {
            // Sandbox can return to a local browser and use server-side confirmation without a public webhook.
            // Production always requires both public HTTPS URLs.
            if (Environment == "sandbox" && name.StartsWith("NotifyUrl") && string.IsNullOrWhiteSpace(url)) continue;
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
            { p.Add($"{name} must be an absolute HTTP(S) URL."); continue; }
            if (uri.Host == "example.com" || uri.Host.EndsWith(".example.com", StringComparison.OrdinalIgnoreCase))
                p.Add($"{name} still uses a placeholder domain; set the real public address.");
            if (Environment == "sandbox" && name.StartsWith("NotifyUrl") && uri.IsLoopback)
                p.Add($"{name} cannot receive remote webhooks on loopback; leave it empty for local confirmation or set the real public address.");
            if (Environment == "production" && (uri.Scheme != "https" || uri.IsLoopback))
                p.Add($"{name} must use a public https:// address in production.");
        }
        return p;
    }
}

public record GatewayOrderRequest(
    string GatewayOrderId, decimal Amount, string CustomerId, string CustomerName, string CustomerPhone,
    string? CustomerEmail, string? ReturnUrl);

public record GatewayOrderResult(string GatewayOrderId, string PaymentSessionId, string? CfOrderId, string Raw);

public record GatewayStatus(string GatewayOrderId, bool IsPaid, bool IsTerminalFailure, decimal Amount, string? Reference, string Raw);

public interface IPaymentGateway
{
    Task<GatewayOrderResult> CreateOrderAsync(GatewayOrderRequest req, CancellationToken ct = default);
    Task<GatewayStatus> GetStatusAsync(string gatewayOrderId, CancellationToken ct = default);
    Task<string> RefundAsync(string gatewayOrderId, decimal amount, string refundId, string note, CancellationToken ct = default);
    Task<bool> VerifyWebhookAsync(string rawBody, string? signature, string? timestamp, CancellationToken ct = default);
    Task<string> EnvironmentAsync(string orderId, CancellationToken ct = default);
    /// <summary>Checks the keys against Cashfree without creating anything (looks up an order id that doesn't exist).</summary>
    Task<(bool Ok, string Message)> TestConnectionAsync(CancellationToken ct = default);
    string? ExtractOrderIdFromWebhook(string rawBody);
}

/// <summary>Cashfree Payment Gateway (PG API v2023-08-01).</summary>
public class CashfreeGateway : IPaymentGateway
{
    private static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
    private readonly HttpClient _http;
    private readonly CashfreeOptions _opt;
    private readonly ILogger<CashfreeGateway> _log;

    public CashfreeGateway(HttpClient http, IOptions<CashfreeOptions> opt, ILogger<CashfreeGateway> log)
    {
        _http = http;
        _opt = opt.Value;
        _log = log;
    }

    private HttpRequestMessage Request(HttpMethod method, string path)
    {
        var req = new HttpRequestMessage(method, $"{_opt.BaseUrl}{path}");
        req.Headers.Add("x-client-id", _opt.ClientId);
        req.Headers.Add("x-client-secret", _opt.ClientSecret);
        req.Headers.Add("x-api-version", _opt.ApiVersion);
        return req;
    }

    /// <summary>Cashfree's own error code and message from an error response, for logs and the admin check.</summary>
    private static (string? Code, string? Message) ErrorOf(string raw)
    {
        try
        {
            using var d = JsonDocument.Parse(raw);
            string? Get(string n) => d.RootElement.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            return (Get("code") ?? Get("type"), Get("message"));
        }
        catch (JsonException) { return (null, null); }
    }

    public async Task<(bool Ok, string Message)> TestConnectionAsync(CancellationToken ct = default)
    {
        if (!_opt.KeysSet) return (false, "Cashfree keys are not set.");
        try
        {
            using var req = Request(HttpMethod.Get, "/orders/bm-connection-test-" + Guid.NewGuid().ToString("N")[..8]);
            using var res = await _http.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);
            var (code, message) = ErrorOf(raw);
            return (int)res.StatusCode switch
            {
                404 when code?.Contains("order", StringComparison.OrdinalIgnoreCase) == true => (true, $"Connected to Cashfree {_opt.Environment}: the keys are valid."),
                401 or 403 => (false, "Cashfree rejected the credentials. Check the environment and server IP allowlist."),
                >= 200 and < 300 => (true, $"Connected to Cashfree {_opt.Environment}."),
                _ => (false, $"Cashfree validation failed with HTTP {(int)res.StatusCode}."),
            };
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            return (false, "Could not reach Cashfree. Retry after checking the server network.");
        }
    }

    public async Task<GatewayOrderResult> CreateOrderAsync(GatewayOrderRequest r, CancellationToken ct = default)
    {
        if (!_opt.KeysSet)
        {
            _log.LogError("Cashfree payment not started: {Problems}", string.Join(" ", _opt.Problems()));
            throw new AppException("Online payment isn't set up yet. Please try again later or contact the store.", 503, "payment_not_configured");
        }
        if (_opt.Environment == "production" && !string.IsNullOrEmpty(r.ReturnUrl) && !r.ReturnUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            throw new AppException("Online payment needs the secure (https://) website address.", 400, "payment_return_url_insecure");

        var body = new Dictionary<string, object?>
        {
            ["order_id"] = r.GatewayOrderId,
            ["order_amount"] = Math.Round(r.Amount, 2),
            ["order_currency"] = "INR",
            ["customer_details"] = new Dictionary<string, object?>
            {
                ["customer_id"] = r.CustomerId,
                ["customer_name"] = r.CustomerName,
                ["customer_phone"] = r.CustomerPhone,
                ["customer_email"] = r.CustomerEmail
            },
            ["order_meta"] = new Dictionary<string, object?>
            {
                ["return_url"] = string.IsNullOrEmpty(r.ReturnUrl) ? null : r.ReturnUrl,
                ["notify_url"] = string.IsNullOrEmpty(_opt.NotifyUrl) ? null : _opt.NotifyUrl
            }
        };

        using var req = Request(HttpMethod.Post, "/orders");
        req.Content = JsonContent.Create(body, options: Json);
        using var res = await _http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            var (code, message) = ErrorOf(raw);
            _log.LogError("Cashfree create order failed with HTTP {Status}", (int)res.StatusCode);
            if ((int)res.StatusCode is 401 or 403)
                throw new AppException("Online payment isn't available right now (payment gateway set-up). Please contact the store.", 502, "payment_gateway_auth");
            throw new AppException("Could not start payment. Please try again.", 502, "payment_gateway_error");
        }

        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;
        return new GatewayOrderResult(
            r.GatewayOrderId,
            root.GetProperty("payment_session_id").GetString()!,
            root.TryGetProperty("cf_order_id", out var cf) ? cf.ToString() : null,
            raw);
    }

    public async Task<GatewayStatus> GetStatusAsync(string gatewayOrderId, CancellationToken ct = default)
    {
        using var req = Request(HttpMethod.Get, $"/orders/{Uri.EscapeDataString(gatewayOrderId)}");
        using var res = await _http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            _log.LogError("Cashfree get order failed with HTTP {Status}", (int)res.StatusCode);
            throw new AppException("Could not verify payment yet. Please refresh in a moment.", 502, "payment_gateway_error");
        }

        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;
        var status = root.GetProperty("order_status").GetString(); // ACTIVE | PAID | EXPIRED | TERMINATED | TERMINATION_REQUESTED
        var amount = root.GetProperty("order_amount").GetDecimal();
        var cfOrderId = root.TryGetProperty("cf_order_id", out var cf) ? cf.ToString() : null;
        return new GatewayStatus(gatewayOrderId, status == "PAID", status is "EXPIRED" or "TERMINATED", amount, cfOrderId, raw);
    }

    public async Task<string> RefundAsync(string gatewayOrderId, decimal amount, string refundId, string note, CancellationToken ct = default)
    {
        using var req = Request(HttpMethod.Post, $"/orders/{Uri.EscapeDataString(gatewayOrderId)}/refunds");
        req.Content = JsonContent.Create(new Dictionary<string, object>
        {
            ["refund_amount"] = Math.Round(amount, 2),
            ["refund_id"] = refundId,
            ["refund_note"] = note.Length > 100 ? note[..100] : note
        });
        using var res = await _http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            _log.LogError("Cashfree refund failed with HTTP {Status}", (int)res.StatusCode);
            throw new AppException("Refund could not be started with Cashfree. Please refund from the Cashfree dashboard.", 502, "refund_failed");
        }
        return raw;
    }

    /// <summary>Signature = Base64(HMAC_SHA256(timestamp + rawBody, clientSecret)).</summary>
    public Task<string> EnvironmentAsync(string orderId, CancellationToken ct = default) => Task.FromResult(_opt.Environment);

    public Task<bool> VerifyWebhookAsync(string rawBody, string? signature, string? timestamp, CancellationToken ct = default)
    {
        if (!_opt.KeysSet || string.IsNullOrEmpty(signature) || string.IsNullOrEmpty(timestamp)) return Task.FromResult(false);
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_opt.ClientSecret));
        var expected = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(timestamp + rawBody)));
        return Task.FromResult(CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(signature)));
    }

    public string? ExtractOrderIdFromWebhook(string rawBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(rawBody);
            return doc.RootElement.GetProperty("data").GetProperty("order").GetProperty("order_id").GetString();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Unrecognised Cashfree webhook payload");
            return null;
        }
    }
}
