using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BuildMate.Data;
using BuildMate.Domain.Common;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Notifications;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace BuildMate.Services.Auth;

public class JwtOptions
{
    public string Issuer { get; set; } = "buildmate-api";
    public string Audience { get; set; } = "buildmate-clients";
    /// <summary>At least 32 random characters. Keep in a secret store, never in git.</summary>
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 60;
    public int RefreshTokenDays { get; set; } = 60;
}

public class OtpOptions
{
    public int Length { get; set; } = 6;
    public int ValidMinutes { get; set; } = 5;
    public int MaxAttempts { get; set; } = 5;
    public int MaxPerHour { get; set; } = 5;
    public int ResendCooldownSeconds { get; set; } = 30;
    /// <summary>Test numbers that always accept a fixed OTP (Play Store review, QA). Leave empty in production.</summary>
    public Dictionary<string, string> TestNumbers { get; set; } = new();
}

public static class ClaimNames
{
    public const string UserType = "utype";
    public const string Permission = "perm";
}

public enum OtpAudience { Partner, Customer }

public record OtpRequest(string Phone, OtpAudience? Audience = null);
/// <param name="Audience">Which account to sign in to. Null = whichever exists (partner first); a new number then gets "signup_required".</param>
/// <param name="PartnerType">For new partner accounts: the profession chosen at sign-up.</param>
public record OtpVerifyRequest(string Phone, string Code, OtpAudience? Audience, string? Name, string? Email = null, PartnerType? PartnerType = null);
/// <summary>Sign-in with a Firebase phone-auth ID token (website and app). Same account rules as <see cref="OtpVerifyRequest"/>.</summary>
public record FirebaseLoginRequest(string IdToken, OtpAudience? Audience = null, string? Name = null, string? Email = null, PartnerType? PartnerType = null);
public record StaffLoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);

public record AuthUserDto(long Id, string Name, string? Phone, string? Email, UserType UserType,
    KycStatus? KycStatus, string? RoleName, IReadOnlyList<string> Permissions, string PreferredLanguage);

public record AuthResult(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken, AuthUserDto User, bool IsNewUser);

public interface IAuthService
{
    Task RequestOtpAsync(OtpRequest req, CancellationToken ct = default);
    Task<AuthResult> VerifyOtpAsync(OtpVerifyRequest req, CancellationToken ct = default);
    Task<AuthResult> FirebaseLoginAsync(FirebaseLoginRequest req, CancellationToken ct = default);
    Task<AuthResult> StaffLoginAsync(StaffLoginRequest req, CancellationToken ct = default);
    Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task LogoutAsync(string refreshToken, CancellationToken ct = default);
    Task<AuthUserDto> MeAsync(long userId, CancellationToken ct = default);
    string HashPassword(AppUser user, string password);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly ISmsSender _sms;
    private readonly JwtOptions _jwt;
    private readonly OtpOptions _otp;
    private readonly IHostEnvironment _env;
    private readonly IFirebaseTokenVerifier _firebase;
    private readonly PasswordHasher<AppUser> _hasher = new();

    public AuthService(AppDbContext db, ISmsSender sms, IOptions<JwtOptions> jwt, IOptions<OtpOptions> otp, IHostEnvironment env, IFirebaseTokenVerifier firebase)
    {
        _firebase = firebase;
        _db = db;
        _sms = sms;
        _jwt = jwt.Value;
        _otp = otp.Value;
        _env = env;
    }

    public async Task RequestOtpAsync(OtpRequest req, CancellationToken ct = default)
    {
        var phone = Phone.Normalize(req.Phone);
        var now = DateTime.UtcNow;

        var recent = await _db.OtpCodes.Where(o => o.Phone == phone && o.CreatedAt > now.AddHours(-1))
            .OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        if (recent.Count >= _otp.MaxPerHour)
            throw new AppException("Too many OTP requests. Please try again in an hour.", 429, "otp_rate_limited");
        if (recent.Count > 0 && recent[0].CreatedAt > now.AddSeconds(-_otp.ResendCooldownSeconds))
            throw new AppException($"Please wait {_otp.ResendCooldownSeconds} seconds before requesting another OTP.", 429, "otp_cooldown");

        // Blocked accounts get the same response (no account enumeration) but no SMS.
        if (req.Audience != null)
        {
            var userType = req.Audience == OtpAudience.Partner ? UserType.Partner : UserType.Customer;
            var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Phone == phone && u.UserType == userType, ct);
            if (user is { IsActive: false }) return;
        }

        var code = _otp.TestNumbers.TryGetValue(phone, out var fixedCode)
            ? fixedCode
            : RandomNumberGenerator.GetInt32(0, (int)Math.Pow(10, _otp.Length)).ToString($"D{_otp.Length}");

        foreach (var old in recent.Where(o => !o.Consumed)) old.Consumed = true;
        _db.OtpCodes.Add(new OtpCode { Phone = phone, CodeHash = Sha256(phone + ":" + code), ExpiresAt = now.AddMinutes(_otp.ValidMinutes) });
        await _db.SaveChangesAsync(ct);

        if (!_otp.TestNumbers.ContainsKey(phone)) await _sms.SendOtpAsync(phone, code, ct);
    }

    public async Task<AuthResult> VerifyOtpAsync(OtpVerifyRequest req, CancellationToken ct = default)
    {
        var phone = Phone.Normalize(req.Phone);
        var otp = await _db.OtpCodes.Where(o => o.Phone == phone && !o.Consumed && o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync(ct);
        if (otp == null) throw new AppException("OTP expired. Please request a new one.", 400, "otp_expired");

        otp.Attempts++;
        var ok = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(otp.CodeHash), Encoding.UTF8.GetBytes(Sha256(phone + ":" + (req.Code ?? "").Trim())));
        if (!ok)
        {
            if (otp.Attempts >= _otp.MaxAttempts) otp.Consumed = true;
            await _db.SaveChangesAsync(ct);
            throw new AppException("Incorrect OTP.", 400, "otp_invalid");
        }
        otp.Consumed = true;
        await _db.SaveChangesAsync(ct);
        return await SignInByPhoneAsync(phone, req.Audience, req.Name, req.Email, req.PartnerType, ct);
    }

    public async Task<AuthResult> FirebaseLoginAsync(FirebaseLoginRequest req, CancellationToken ct = default)
    {
        var identity = await _firebase.VerifyAsync(req.IdToken, ct);
        return await SignInByPhoneAsync(identity.Phone, req.Audience, req.Name, req.Email, req.PartnerType, ct);
    }

    /// <summary>
    /// One phone number can have a partner account and a customer account. With an audience, that account is used
    /// (and created if new: partners start with KYC "not submitted"). Without one, the partner account is preferred,
    /// then the customer account; a number with neither gets 409 "signup_required" so the client can ask for name and
    /// profession and call again (the Firebase token stays valid for an hour).
    /// </summary>
    private async Task<AuthResult> SignInByPhoneAsync(string phone, OtpAudience? audience, string? name, string? email, PartnerType? partnerType, CancellationToken ct)
    {
        var accounts = await _db.Users.Include(u => u.PartnerProfile)
            .Where(u => u.Phone == phone && (u.UserType == UserType.Partner || u.UserType == UserType.Customer)).ToListAsync(ct);
        AppUser? user;
        UserType userType;
        if (audience == null)
        {
            user = accounts.FirstOrDefault(u => u.UserType == UserType.Partner && u.IsActive) ?? accounts.FirstOrDefault(u => u.UserType == UserType.Customer && u.IsActive)
                   ?? accounts.FirstOrDefault();
            if (user == null) throw new AppException("No account for this number yet. Create one to continue.", 409, "signup_required");
            userType = user.UserType;
        }
        else
        {
            userType = audience == OtpAudience.Partner ? UserType.Partner : UserType.Customer;
            user = accounts.FirstOrDefault(u => u.UserType == userType);
        }

        var isNew = false;
        if (user == null)
        {
            isNew = true;
            user = new AppUser { Phone = phone, UserType = userType, Name = name?.Trim() ?? "" };
            if (userType == UserType.Partner)
                user.PartnerProfile = new PartnerProfile { PartnerType = partnerType ?? PartnerType.Other, KycStatus = KycStatus.NotSubmitted };
            _db.Users.Add(user);
        }
        else if (!user.IsActive)
        {
            throw new ForbiddenException("This account is disabled. Please contact the store.");
        }

        if (string.IsNullOrWhiteSpace(user.Name) && !string.IsNullOrWhiteSpace(name)) user.Name = name.Trim();
        // E-mail is optional and unique across all accounts; one already in use is simply not stored here.
        var mail = email?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(user.Email) && !string.IsNullOrEmpty(mail) && mail.Contains('@') && mail.Length <= 200
            && !await _db.Users.AnyAsync(u => u.Email == mail, ct))
            user.Email = mail;
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await IssueAsync(user, isNew, ct);
    }

    public async Task<AuthResult> StaffLoginAsync(StaffLoginRequest req, CancellationToken ct = default)
    {
        var email = (req.Email ?? "").Trim().ToLowerInvariant();
        var user = await _db.Users.Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == email && u.UserType == UserType.Staff, ct);
        if (user?.PasswordHash == null ||
            _hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password ?? "") == PasswordVerificationResult.Failed)
            throw new AppException("Incorrect email or password.", 401, "invalid_credentials");
        if (!user.IsActive) throw new ForbiddenException("This account is disabled.");

        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await IssueAsync(user, false, ct);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = Sha256(refreshToken ?? "");
        var token = await _db.RefreshTokens.Include(t => t.User).ThenInclude(u => u.Role)
            .Include(t => t.User).ThenInclude(u => u.PartnerProfile)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token == null || token.RevokedAt != null || token.ExpiresAt < DateTime.UtcNow || !token.User.IsActive)
            throw new AppException("Session expired. Please log in again.", 401, "refresh_invalid");

        token.RevokedAt = DateTime.UtcNow; // rotation
        await _db.SaveChangesAsync(ct);
        return await IssueAsync(token.User, false, ct);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = Sha256(refreshToken ?? "");
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token != null && token.RevokedAt == null)
        {
            token.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task<AuthUserDto> MeAsync(long userId, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking().Include(u => u.Role).Include(u => u.PartnerProfile)
            .FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new NotFoundException("User");
        return ToDto(user);
    }

    public string HashPassword(AppUser user, string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            throw new AppException("Password must be at least 8 characters.");
        return _hasher.HashPassword(user, password);
    }

    private async Task<AuthResult> IssueAsync(AppUser user, bool isNew, CancellationToken ct)
    {
        if (user.UserType == UserType.Staff && user.Role == null && user.RoleId != null)
            await _db.Entry(user).Reference(u => u.Role).LoadAsync(ct);
        if (user.UserType == UserType.Partner && user.PartnerProfile == null)
            await _db.Entry(user).Reference(u => u.PartnerProfile).LoadAsync(ct);

        var dto = ToDto(user);
        var expires = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Name, user.Name ?? ""),
            new(ClaimNames.UserType, ((int)user.UserType).ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };
        claims.AddRange(dto.Permissions.Select(p => new Claim(ClaimNames.Permission, p)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SigningKey));
        var jwt = new JwtSecurityToken(_jwt.Issuer, _jwt.Audience, claims, DateTime.UtcNow, expires,
            new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        var access = new JwtSecurityTokenHandler().WriteToken(jwt);

        var refresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = Sha256(refresh),
            ExpiresAt = DateTime.UtcNow.AddDays(_jwt.RefreshTokenDays)
        });
        await _db.SaveChangesAsync(ct);

        return new AuthResult(access, expires, refresh, dto, isNew);
    }

    private static AuthUserDto ToDto(AppUser u)
    {
        IReadOnlyList<string> perms = u.UserType == UserType.Staff ? (u.Role?.Permissions ?? new List<string>()) : Array.Empty<string>();
        return new AuthUserDto(u.Id, u.Name, u.Phone, u.Email, u.UserType, u.PartnerProfile?.KycStatus,
            u.Role?.Name, perms, u.PreferredLanguage);
    }

    internal static string Sha256(string input) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
}
