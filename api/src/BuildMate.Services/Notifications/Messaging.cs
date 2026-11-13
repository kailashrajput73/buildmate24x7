using BuildMate.Data;
using BuildMate.Domain.Entities;
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

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_opt.Msg91AuthKey) &&
        !string.IsNullOrWhiteSpace(_opt.Msg91OtpTemplateId);

    public async Task SendOtpAsync(string phone10, string code, CancellationToken ct = default)
    {
        var authKey = _opt.Msg91AuthKey?.Trim();
        var templateId = _opt.Msg91OtpTemplateId?.Trim();
        if (string.IsNullOrWhiteSpace(authKey) || string.IsNullOrWhiteSpace(templateId))
            throw new InvalidOperationException("MSG91 OTP settings are missing.");
        var url = $"https://control.msg91.com/api/v5/otp?template_id={Uri.EscapeDataString(templateId)}" +
                  $"&mobile=91{phone10}&otp={code}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("authkey", authKey);
        using var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
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

    public NotificationService(AppDbContext db) => _db = db;

    public async Task NotifyAsync(long userId, string title, string body, string? link = null, CancellationToken ct = default)
    {
        _db.Notifications.Add(new Notification { UserId = userId, Title = title, Body = body, Link = link });
    }
}
