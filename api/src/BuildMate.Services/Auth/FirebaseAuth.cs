using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BuildMate.Services.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace BuildMate.Services.Auth;

public class FirebaseOptions
{
    /// <summary>
    /// Firebase project id (e.g. "buildmate24x7"). Empty = Firebase login is switched off. Several ids may be given,
    /// comma-separated, when the website and the app are registered in different Firebase projects.
    /// </summary>
    public string ProjectId { get; set; } = "";

    public IReadOnlyList<string> ProjectIds =>
        ProjectId.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

/// <summary>A phone number Firebase has verified with an OTP.</summary>
public record FirebaseIdentity(string Uid, string Phone);

public interface IFirebaseTokenVerifier
{
    bool Enabled { get; }
    /// <summary>Validates a Firebase ID token from the website or app and returns the verified phone number.</summary>
    Task<FirebaseIdentity> VerifyAsync(string idToken, CancellationToken ct = default);
}

/// <summary>
/// Verifies Firebase Authentication ID tokens without the Admin SDK or a service-account key: RS256 signature against
/// Google's published keys, issuer https://securetoken.google.com/{project}, audience {project}, expiry, and that the
/// sign-in was by phone. See https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
/// </summary>
public class FirebaseTokenVerifier : IFirebaseTokenVerifier
{
    private const string JwksUrl = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
    private readonly HttpClient _http;
    private readonly FirebaseOptions _opt;
    private readonly ILogger<FirebaseTokenVerifier> _log;
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static IList<SecurityKey>? _keys;
    private static DateTime _keysExpireAt;

    public FirebaseTokenVerifier(HttpClient http, IOptions<FirebaseOptions> opt, ILogger<FirebaseTokenVerifier> log)
    {
        _http = http;
        _opt = opt.Value;
        _log = log;
    }

    public bool Enabled => _opt.ProjectIds.Count > 0;

    private async Task<IList<SecurityKey>> KeysAsync(bool forceRefresh, CancellationToken ct)
    {
        if (!forceRefresh && _keys != null && DateTime.UtcNow < _keysExpireAt) return _keys;
        await Gate.WaitAsync(ct);
        try
        {
            if (!forceRefresh && _keys != null && DateTime.UtcNow < _keysExpireAt) return _keys;
            using var res = await _http.GetAsync(JwksUrl, ct);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadAsStringAsync(ct);
            _keys = new JsonWebKeySet(json).GetSigningKeys();
            // Google rotates these keys; honour the cache lifetime it sends (usually several hours).
            var maxAge = res.Headers.CacheControl?.MaxAge ?? TimeSpan.FromHours(1);
            _keysExpireAt = DateTime.UtcNow.Add(maxAge);
            return _keys;
        }
        finally { Gate.Release(); }
    }

    public async Task<FirebaseIdentity> VerifyAsync(string idToken, CancellationToken ct = default)
    {
        if (!Enabled) throw new AppException("Phone login with Firebase isn't set up on the server.", 501, "firebase_not_configured");
        if (string.IsNullOrWhiteSpace(idToken)) throw new AppException("Missing sign-in token.", 400, "firebase_token_missing");

        var projects = _opt.ProjectIds;
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        ClaimsPrincipal principal;
        try
        {
            principal = await ValidateAsync(handler, idToken, projects, forceRefresh: false, ct);
        }
        catch (SecurityTokenSignatureKeyNotFoundException)
        {
            principal = await ValidateAsync(handler, idToken, projects, forceRefresh: true, ct); // keys rotated
        }
        catch (SecurityTokenExpiredException)
        {
            throw new AppException("Your sign-in expired. Please verify your number again.", 401, "firebase_token_expired");
        }
        catch (Exception e) when (e is SecurityTokenException or ArgumentException)
        {
            _log.LogWarning("Rejected Firebase token: {Reason}", e.Message);
            throw new AppException("We couldn't verify your sign-in. Please try again.", 401, "firebase_token_invalid");
        }

        var uid = principal.FindFirst("sub")?.Value;
        var provider = principal.FindFirst("firebase")?.Value ?? "";
        var phone = principal.FindFirst("phone_number")?.Value;
        if (string.IsNullOrEmpty(uid) || string.IsNullOrEmpty(phone))
            throw new AppException("Sign in with your mobile number.", 401, "firebase_phone_required");
        if (!string.IsNullOrEmpty(provider) && !provider.Contains("\"phone\""))
            throw new AppException("Sign in with your mobile number.", 401, "firebase_phone_required");
        return new FirebaseIdentity(uid, Phone.Normalize(phone));
    }

    private async Task<ClaimsPrincipal> ValidateAsync(JwtSecurityTokenHandler handler, string token, IReadOnlyList<string> projects, bool forceRefresh, CancellationToken ct)
    {
        var keys = await KeysAsync(forceRefresh, ct);
        var p = new TokenValidationParameters
        {
            ValidIssuers = projects.Select(p => $"https://securetoken.google.com/{p}").ToList(),
            ValidAudiences = projects,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = keys,
            ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 },
            ClockSkew = TimeSpan.FromMinutes(2),
        };
        return handler.ValidateToken(token, p, out _);
    }
}
