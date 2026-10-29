using BuildMate.Data;
using BuildMate.Domain.Entities;
using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Notification = BuildMate.Domain.Entities.Notification;

namespace BuildMate.Services.Notifications;

// ---------------------------------------------------------------- SMS / OTP

public class SmsOptions
{
    /// <summary>"Log" (dev — OTP is written to the log) or "Msg91".</summary>
    public string Provider { get; set; } = "Log";
    public string? Msg91AuthKey { get; set; }
    public string? Msg91OtpTemplateId { get; set; }
}

public interface ISmsSender
{
    Task SendOtpAsync(string phone10, string code, CancellationToken ct = default);
}

public class LogSmsSender : ISmsSender
{
    private readonly ILogger<LogSmsSender> _log;
    public LogSmsSender(ILogger<LogSmsSender> log) => _log = log;

    public Task SendOtpAsync(string phone10, string code, CancellationToken ct = default)
    {
        _log.LogWarning("DEV OTP for {Phone}: {Code}", phone10, code);
        return Task.CompletedTask;
    }
}

/// <summary>MSG91 OTP API (DLT-registered template required for Indian SMS).</summary>
public class Msg91SmsSender : ISmsSender
{
    private readonly HttpClient _http;
    private readonly SmsOptions _opt;

    public Msg91SmsSender(HttpClient http, IOptions<SmsOptions> opt)
    {
        _http = http;
        _opt = opt.Value;
    }

    public async Task SendOtpAsync(string phone10, string code, CancellationToken ct = default)
    {
        var url = $"https://control.msg91.com/api/v5/otp?template_id={Uri.EscapeDataString(_opt.Msg91OtpTemplateId ?? "")}" +
                  $"&mobile=91{phone10}&otp={code}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("authkey", _opt.Msg91AuthKey);
        using var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }
}

// ---------------------------------------------------------------- Push

public class PushOptions
{
    /// <summary>Path to the Firebase service-account JSON. Push is disabled when empty.</summary>
    public string? FirebaseCredentialPath { get; set; }
}

public interface IPushSender
{
    Task SendAsync(IReadOnlyList<string> tokens, string title, string body, string? link, CancellationToken ct = default);
}

public class NullPushSender : IPushSender
{
    public Task SendAsync(IReadOnlyList<string> tokens, string title, string body, string? link, CancellationToken ct = default) => Task.CompletedTask;
}

public class FcmPushSender : IPushSender
{
    private readonly FirebaseMessaging _messaging;
    private readonly ILogger<FcmPushSender> _log;

    public FcmPushSender(IOptions<PushOptions> opt, ILogger<FcmPushSender> log)
    {
        _log = log;
        var app = FirebaseApp.DefaultInstance ?? FirebaseApp.Create(new AppOptions
        {
            Credential = GoogleCredential.FromFile(opt.Value.FirebaseCredentialPath)
        });
        _messaging = FirebaseMessaging.GetMessaging(app);
    }

    public async Task SendAsync(IReadOnlyList<string> tokens, string title, string body, string? link, CancellationToken ct = default)
    {
        if (tokens.Count == 0) return;
        var msg = new MulticastMessage
        {
            Tokens = tokens.ToList(),
            Notification = new FirebaseAdmin.Messaging.Notification { Title = title, Body = body },
            Data = new Dictionary<string, string> { ["link"] = link ?? "" }
        };
        try
        {
            await _messaging.SendEachForMulticastAsync(msg, ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "FCM send failed");
        }
    }
}

// ---------------------------------------------------------------- In-app notifications

public interface INotificationService
{
    /// <summary>Stores an in-app notification and pushes it to the user's devices. Caller saves changes.</summary>
    Task NotifyAsync(long userId, string title, string body, string? link = null, CancellationToken ct = default);
}

public class NotificationService : INotificationService
{
    private readonly AppDbContext _db;
    private readonly IPushSender _push;

    public NotificationService(AppDbContext db, IPushSender push)
    {
        _db = db;
        _push = push;
    }

    public async Task NotifyAsync(long userId, string title, string body, string? link = null, CancellationToken ct = default)
    {
        _db.Notifications.Add(new Notification { UserId = userId, Title = title, Body = body, Link = link });
        var tokens = await _db.DeviceTokens.Where(t => t.UserId == userId).Select(t => t.Token).ToListAsync(ct);
        await _push.SendAsync(tokens, title, body, link, ct);
    }
}
