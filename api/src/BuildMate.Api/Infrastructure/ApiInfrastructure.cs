using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BuildMate.Domain.Common;
using BuildMate.Domain.Enums;
using BuildMate.Services.Auth;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Inventory;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Api.Infrastructure;

/// <summary>Resolves the caller from the validated JWT.</summary>
public class HttpCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _http;
    public HttpCurrentUser(IHttpContextAccessor http) => _http = http;

    private ClaimsPrincipal? Principal => _http.HttpContext?.User;

    public long? Id => long.TryParse(Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public string? Name => Principal?.FindFirstValue(JwtRegisteredClaimNames.Name) ?? Principal?.FindFirstValue(ClaimTypes.Name);
    public UserType? UserType => int.TryParse(Principal?.FindFirstValue(ClaimNames.UserType), out var t) ? (UserType)t : null;

    public bool HasPermission(string permission) =>
        Principal?.HasClaim(ClaimNames.Permission, Permissions.All) == true || Principal?.HasClaim(ClaimNames.Permission, permission) == true;

    public long RequireId() => Id ?? throw new AppException("Please log in.", 401, "unauthenticated");
}

public static class ViewerExtensions
{
    /// <summary>
    /// Channel comes from the X-Client header ("app" for the Flutter app, "web" for the storefront).
    /// Pricing comes from who is logged in: approved partners see partner prices, everyone else retail.
    /// </summary>
    public static Viewer GetViewer(this HttpContext ctx, ICurrentUser me)
    {
        var channel = string.Equals(ctx.Request.Headers["X-Client"], "app", StringComparison.OrdinalIgnoreCase) ? ClientChannel.App : ClientChannel.Web;
        var lang = ctx.Request.Headers.AcceptLanguage.ToString().Split(',', ';').FirstOrDefault()?.Trim().ToLowerInvariant() ?? "en";
        if (lang.Length > 2) lang = lang[..2];
        var kind = me.UserType == Domain.Enums.UserType.Partner ? CustomerKind.Partner : CustomerKind.Retail;
        return new Viewer(channel, kind, string.IsNullOrEmpty(lang) ? "en" : lang);
    }
}

/// <summary>Maps exceptions to RFC 7807 problem responses. Business errors keep their message; everything else is hidden.</summary>
public class ProblemExceptionHandler : IExceptionHandler
{
    private readonly ILogger<ProblemExceptionHandler> _log;
    private readonly IHostEnvironment _env;

    public ProblemExceptionHandler(ILogger<ProblemExceptionHandler> log, IHostEnvironment env)
    {
        _log = log;
        _env = env;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        ProblemDetails problem;
        switch (ex)
        {
            case ImportValidationException iv:
                problem = new ProblemDetails { Status = iv.StatusCode, Title = iv.Message, Type = iv.Code };
                problem.Extensions["errors"] = iv.Errors;
                break;
            case AppException app:
                problem = new ProblemDetails { Status = app.StatusCode, Title = app.Message, Type = app.Code };
                break;
            case DbUpdateException db when db.InnerException?.Message.Contains("23505") == true || db.InnerException?.Message.Contains("duplicate key") == true:
                problem = new ProblemDetails { Status = 409, Title = "This record already exists.", Type = "duplicate" };
                break;
            case OperationCanceledException when ctx.RequestAborted.IsCancellationRequested:
                return true;
            default:
                _log.LogError(ex, "Unhandled error on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
                problem = new ProblemDetails
                {
                    Status = 500,
                    Title = "Something went wrong. Please try again.",
                    Detail = _env.IsDevelopment() ? ex.ToString() : null
                };
                break;
        }
        problem.Extensions["traceId"] = ctx.TraceIdentifier;
        ctx.Response.StatusCode = problem.Status ?? 500;
        await ctx.Response.WriteAsJsonAsync(problem, (System.Text.Json.JsonSerializerOptions?)null, "application/problem+json", ct);
        return true;
    }
}

public static class FileResults
{
    public const string Xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    public static string Stamp(string name) => $"{name}-{Clock.TodayIst:yyyyMMdd}.xlsx";
}
