using System.Security.Cryptography;
using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using BuildMate.Services.Files;
using BuildMate.Services.Notifications;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Partners;

// ---------------------------------------------------------------- DTOs

/// <summary>KYC for the signed-in user, partner or customer.</summary>
public record MyKycDto(UserType UserType, KycStatus Status, string? Remarks, DateTime? SubmittedAt, string? Gstin, List<KycDocumentDto> Documents);

public record ReferralDto(string Code, int ReferredCount, decimal PointsEarned, decimal ReferrerPoints, decimal WelcomePoints, string? ReferredByName);

public record CustomerKycListDto(long UserId, string Name, string? Phone, DateTime CreatedAt, KycStatus KycStatus, DateTime? KycSubmittedAt,
    decimal RewardBalance, string? ReferralCode, int DocumentCount);

public record CustomerKycDetailDto(long UserId, string Name, string? Phone, string? Email, DateTime CreatedAt, KycStatus KycStatus,
    DateTime? KycSubmittedAt, DateTime? KycReviewedAt, string? KycRemarks, string? Gstin, decimal RewardBalance, string? ReferralCode,
    string? ReferredByName, List<KycDocumentDto> Documents);

public record CustomerKycQuery(KycStatus? Status, string? Search, int Page = 1, int PageSize = 25);

public interface IMemberService
{
    Task<MyKycDto> GetKycAsync(long userId, CancellationToken ct = default);
    Task<KycDocumentDto> UploadKycAsync(long userId, KycDocumentType type, string? number, Stream file, string fileName, long length, CancellationToken ct = default);
    Task<MyKycDto> SubmitKycAsync(long userId, string? gstin, CancellationToken ct = default);

    Task<RewardSummaryDto> RewardsAsync(long userId, CancellationToken ct = default);
    Task<PagedResult<RewardTxnDto>> RewardHistoryAsync(long userId, PageRequest page, CancellationToken ct = default);

    Task<ReferralDto> GetReferralAsync(long userId, CancellationToken ct = default);
    /// <summary>Links a brand-new account to the person who invited it and posts the referral points. Caller saves.</summary>
    Task ApplyReferralAsync(AppUser newUser, string? code, CancellationToken ct = default);

    // Admin: customer KYC review and points.
    Task<PagedResult<CustomerKycListDto>> ListCustomersAsync(CustomerKycQuery q, CancellationToken ct = default);
    Task<CustomerKycDetailDto> GetCustomerAsync(long userId, CancellationToken ct = default);
    Task<CustomerKycDetailDto> DecideCustomerKycAsync(long userId, KycDecision d, CancellationToken ct = default);
    Task<RewardTxnDto> AdjustCustomerRewardsAsync(long userId, RewardAdjust dto, CancellationToken ct = default);
    Task<(Stream Stream, string ContentType, string FileName)> OpenCustomerDocumentAsync(long userId, long docId, CancellationToken ct = default);
}

/// <summary>
/// KYC, reward points and Refer &amp; Earn for every signed-in shopper. Partners use their existing partner profile
/// (same data as the partner endpoints and the admin Partners page); retail customers get a customer profile,
/// created the first time they upload a document or earn points.
/// </summary>
public class MemberService : IMemberService
{
    // No 0/O/1/I so codes are easy to read out and type.
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly AppDbContext _db;
    private readonly IPartnerService _partners;
    private readonly IFileStorage _files;
    private readonly INotificationService _notify;
    private readonly ISettingsService _settings;
    private readonly ICurrentUser _me;

    public MemberService(AppDbContext db, IPartnerService partners, IFileStorage files, INotificationService notify, ISettingsService settings, ICurrentUser me)
    {
        _db = db;
        _partners = partners;
        _files = files;
        _notify = notify;
        _settings = settings;
        _me = me;
    }

    private async Task<AppUser> UserAsync(long userId, CancellationToken ct) =>
        await _db.Users.Include(u => u.PartnerProfile).Include(u => u.CustomerProfile)
            .FirstOrDefaultAsync(u => u.Id == userId && (u.UserType == UserType.Partner || u.UserType == UserType.Customer), ct)
        ?? throw new NotFoundException("Account");

    private async Task<CustomerProfile> CustomerProfileAsync(AppUser user, CancellationToken ct)
    {
        if (user.CustomerProfile != null) return user.CustomerProfile;
        var p = new CustomerProfile { UserId = user.Id };
        _db.CustomerProfiles.Add(p);
        await _db.SaveChangesAsync(ct);
        user.CustomerProfile = p;
        return p;
    }

    private static KycDocumentDto Doc(KycDocument d) => new(d.Id, d.DocumentType, d.DocumentNumberMasked, d.FileKey, d.CreatedAt);

    // ---------------------------------------------------------------- KYC

    public async Task<MyKycDto> GetKycAsync(long userId, CancellationToken ct = default)
    {
        var user = await UserAsync(userId, ct);
        if (user.UserType == UserType.Partner)
        {
            var p = user.PartnerProfile ?? throw new NotFoundException("Partner");
            var docs = await _db.KycDocuments.AsNoTracking().Where(d => d.PartnerProfileId == p.Id).OrderBy(d => d.Id).ToListAsync(ct);
            return new MyKycDto(user.UserType, p.KycStatus, p.KycRemarks, p.KycSubmittedAt, p.Gstin, docs.Select(Doc).ToList());
        }
        var c = user.CustomerProfile;
        if (c == null) return new MyKycDto(user.UserType, KycStatus.NotSubmitted, null, null, null, new());
        var cdocs = await _db.KycDocuments.AsNoTracking().Where(d => d.CustomerProfileId == c.Id).OrderBy(d => d.Id).ToListAsync(ct);
        return new MyKycDto(user.UserType, c.KycStatus, c.KycRemarks, c.KycSubmittedAt, c.Gstin, cdocs.Select(Doc).ToList());
    }

    public async Task<KycDocumentDto> UploadKycAsync(long userId, KycDocumentType type, string? number, Stream file, string fileName, long length, CancellationToken ct = default)
    {
        var user = await UserAsync(userId, ct);
        if (user.UserType == UserType.Partner)
            return await _partners.AddKycDocumentAsync(userId, type, number, file, fileName, length, ct);

        var c = await CustomerProfileAsync(user, ct);
        if (c.KycStatus == KycStatus.Approved) throw new AppException("Your KYC is already approved. Contact the store to change documents.");
        var contentType = UploadRules.Validate(fileName, length, 8 * 1024 * 1024);
        var key = await _files.SaveAsync(file, fileName, contentType, $"kyc/{userId}", isPrivate: true, ct);

        var old = await _db.KycDocuments.Where(d => d.CustomerProfileId == c.Id && d.DocumentType == type).ToListAsync(ct);
        _db.KycDocuments.RemoveRange(old);
        var doc = new KycDocument { CustomerProfileId = c.Id, DocumentType = type, DocumentNumberMasked = PartnerService.Mask(number), FileKey = key };
        _db.KycDocuments.Add(doc);
        await _db.SaveChangesAsync(ct);
        return Doc(doc);
    }

    public async Task<MyKycDto> SubmitKycAsync(long userId, string? gstin, CancellationToken ct = default)
    {
        var user = await UserAsync(userId, ct);
        if (user.UserType == UserType.Partner)
        {
            await _partners.SubmitKycAsync(userId, ct);
            return await GetKycAsync(userId, ct);
        }

        var c = await CustomerProfileAsync(user, ct);
        if (string.IsNullOrWhiteSpace(user.Name)) throw new AppException("Please add your name first.");
        var types = await _db.KycDocuments.Where(d => d.CustomerProfileId == c.Id).Select(d => d.DocumentType).ToListAsync(ct);
        if (!types.Any(t => t is KycDocumentType.Aadhaar or KycDocumentType.Pan))
            throw new AppException("Upload your Aadhaar or PAN card to continue.");
        var g = gstin?.Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(g) && g.Length != 15) throw new AppException("GSTIN must be 15 characters.");
        if (!string.IsNullOrEmpty(g)) c.Gstin = g;
        if (c.KycStatus != KycStatus.Approved)
        {
            c.KycStatus = KycStatus.Pending;
            c.KycSubmittedAt = DateTime.UtcNow;
            c.KycRemarks = null;
        }
        await _db.SaveChangesAsync(ct);
        return await GetKycAsync(userId, ct);
    }

    // ---------------------------------------------------------------- Rewards

    public async Task<RewardSummaryDto> RewardsAsync(long userId, CancellationToken ct = default)
    {
        var user = await UserAsync(userId, ct);
        if (user.UserType == UserType.Partner) return await _partners.RewardSummaryAsync(userId, ct);

        var monthStart = Clock.IstDateStartUtc(new DateTime(Clock.TodayIst.Year, Clock.TodayIst.Month, 1));
        var earned = _db.RewardTransactions.Where(r => r.PartnerUserId == userId && r.Points > 0 &&
            (r.Type == RewardTransactionType.Earned || r.Type == RewardTransactionType.Referral));
        var lifetime = await earned.SumAsync(r => (decimal?)r.Points, ct) ?? 0;
        var month = await earned.Where(r => r.CreatedAt >= monthStart).SumAsync(r => (decimal?)r.Points, ct) ?? 0;
        var recent = await _partners.RewardHistoryAsync(userId, new PageRequest(1, 10), ct);
        var settings = await _settings.GetAsync(ct);
        return new RewardSummaryDto(user.CustomerProfile?.RewardBalance ?? 0, lifetime, month, settings.RewardPointValue, recent.Items.ToList());
    }

    public Task<PagedResult<RewardTxnDto>> RewardHistoryAsync(long userId, PageRequest page, CancellationToken ct = default) =>
        _partners.RewardHistoryAsync(userId, page, ct);

    /// <summary>Adds points to a partner or customer balance with a ledger line. Call inside a transaction; caller saves.</summary>
    private async Task PostAsync(AppUser user, RewardTransactionType type, decimal points, string note, CancellationToken ct)
    {
        if (points == 0) return;
        decimal balance;
        if (user.UserType == UserType.Partner)
        {
            var p = await _db.LockPartnerAsync(user.Id, ct) ?? throw new NotFoundException("Partner");
            p.RewardBalance += points;
            if (p.RewardBalance < 0) throw new AppException($"Only {p.RewardBalance - points:0.##} points available.", 409, "insufficient_points");
            balance = p.RewardBalance;
        }
        else
        {
            await CustomerProfileAsync(user, ct);
            var c = await _db.LockCustomerProfileAsync(user.Id, ct) ?? throw new NotFoundException("Customer");
            c.RewardBalance += points;
            if (c.RewardBalance < 0) throw new AppException($"Only {c.RewardBalance - points:0.##} points available.", 409, "insufficient_points");
            balance = c.RewardBalance;
        }
        _db.RewardTransactions.Add(new RewardTransaction
        {
            PartnerUserId = user.Id, Type = type, Points = points, BalanceAfter = balance, Note = note, CreatedById = _me.Id,
        });
    }

    // ---------------------------------------------------------------- Refer & Earn

    private static string NewCode()
    {
        Span<char> c = stackalloc char[6];
        for (var i = 0; i < c.Length; i++) c[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return "BM" + new string(c);
    }

    public async Task<ReferralDto> GetReferralAsync(long userId, CancellationToken ct = default)
    {
        var user = await UserAsync(userId, ct);
        if (string.IsNullOrEmpty(user.ReferralCode))
        {
            for (var attempt = 0; ; attempt++)
            {
                var code = NewCode();
                if (await _db.Users.AnyAsync(u => u.ReferralCode == code, ct)) continue;
                user.ReferralCode = code;
                try { await _db.SaveChangesAsync(ct); break; }
                catch (DbUpdateException) when (attempt < 5) { user.ReferralCode = null; }
            }
        }
        var count = await _db.Users.CountAsync(u => u.ReferredById == userId, ct);
        var earned = await _db.RewardTransactions.Where(r => r.PartnerUserId == userId && r.Type == RewardTransactionType.Referral && r.Points > 0)
            .SumAsync(r => (decimal?)r.Points, ct) ?? 0;
        var by = user.ReferredById == null ? null : await _db.Users.Where(u => u.Id == user.ReferredById).Select(u => u.Name).FirstOrDefaultAsync(ct);
        var s = await _settings.GetAsync(ct);
        return new ReferralDto(user.ReferralCode!, count, earned, s.ReferralRewardPoints, s.ReferralWelcomePoints, by);
    }

    public async Task ApplyReferralAsync(AppUser newUser, string? code, CancellationToken ct = default)
    {
        var c = code?.Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(c)) return;
        var referrer = await _db.Users.Include(u => u.PartnerProfile).Include(u => u.CustomerProfile)
            .FirstOrDefaultAsync(u => u.ReferralCode == c && u.IsActive, ct);
        if (referrer == null) throw new AppException("This referral code is not valid. Clear the optional code to continue without a referral.");
        if (referrer.Phone == newUser.Phone) return;

        newUser.ReferredById = referrer.Id;
        var s = await _settings.GetAsync(ct);
        if (s.ReferralRewardPoints <= 0 && s.ReferralWelcomePoints <= 0) return;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        await _db.SaveChangesAsync(ct); // the new user needs an id for the ledger
        if (s.ReferralRewardPoints > 0)
        {
            await PostAsync(referrer, RewardTransactionType.Referral, s.ReferralRewardPoints, $"Referral: {newUser.Name} joined with your code", ct);
            await _notify.NotifyAsync(referrer.Id, "You earned referral points 🎉",
                $"{newUser.Name} joined BuildMate with your code. +{s.ReferralRewardPoints:0.##} points.", "rewards", ct);
        }
        if (s.ReferralWelcomePoints > 0)
            await PostAsync(newUser, RewardTransactionType.Referral, s.ReferralWelcomePoints, $"Welcome bonus (invited by {referrer.Name})", ct);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    // ---------------------------------------------------------------- Admin: customers

    public async Task<PagedResult<CustomerKycListDto>> ListCustomersAsync(CustomerKycQuery q, CancellationToken ct = default)
    {
        var users = _db.Users.AsNoTracking().Where(u => u.UserType == UserType.Customer);
        if (q.Status != null)
            users = q.Status == KycStatus.NotSubmitted
                ? users.Where(u => u.CustomerProfile == null || u.CustomerProfile.KycStatus == KycStatus.NotSubmitted)
                : users.Where(u => u.CustomerProfile != null && u.CustomerProfile.KycStatus == q.Status);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim().ToLower();
            users = users.Where(u => u.Name.ToLower().Contains(s) || (u.Phone != null && u.Phone.Contains(s)) || (u.ReferralCode != null && u.ReferralCode.ToLower() == s));
        }
        var page = new PageRequest(q.Page, q.PageSize);
        var total = await users.CountAsync(ct);
        var items = await users
            .OrderByDescending(u => u.CustomerProfile != null && u.CustomerProfile.KycStatus == KycStatus.Pending)
            .ThenByDescending(u => u.CreatedAt)
            .Page(page)
            .Select(u => new CustomerKycListDto(u.Id, u.Name, u.Phone, u.CreatedAt,
                u.CustomerProfile == null ? KycStatus.NotSubmitted : u.CustomerProfile.KycStatus,
                u.CustomerProfile == null ? null : u.CustomerProfile.KycSubmittedAt,
                u.CustomerProfile == null ? 0 : u.CustomerProfile.RewardBalance,
                u.ReferralCode,
                u.CustomerProfile == null ? 0 : u.CustomerProfile.Documents.Count))
            .ToListAsync(ct);
        return new PagedResult<CustomerKycListDto>(items, total, page.SafePage, page.SafeSize);
    }

    public async Task<CustomerKycDetailDto> GetCustomerAsync(long userId, CancellationToken ct = default)
    {
        var u = await _db.Users.AsNoTracking().Include(x => x.CustomerProfile).ThenInclude(c => c!.Documents)
            .FirstOrDefaultAsync(x => x.Id == userId && x.UserType == UserType.Customer, ct) ?? throw new NotFoundException("Customer");
        var by = u.ReferredById == null ? null : await _db.Users.Where(x => x.Id == u.ReferredById).Select(x => x.Name).FirstOrDefaultAsync(ct);
        var c = u.CustomerProfile;
        return new CustomerKycDetailDto(u.Id, u.Name, u.Phone, u.Email, u.CreatedAt, c?.KycStatus ?? KycStatus.NotSubmitted,
            c?.KycSubmittedAt, c?.KycReviewedAt, c?.KycRemarks, c?.Gstin, c?.RewardBalance ?? 0, u.ReferralCode, by,
            c?.Documents.OrderBy(d => d.Id).Select(Doc).ToList() ?? new());
    }

    public async Task<CustomerKycDetailDto> DecideCustomerKycAsync(long userId, KycDecision d, CancellationToken ct = default)
    {
        var u = await _db.Users.Include(x => x.CustomerProfile).FirstOrDefaultAsync(x => x.Id == userId && x.UserType == UserType.Customer, ct)
                ?? throw new NotFoundException("Customer");
        if (!d.Approve && string.IsNullOrWhiteSpace(d.Remarks)) throw new AppException("Please give a reason so the customer knows what to fix.");
        var c = await CustomerProfileAsync(u, ct);
        c.KycStatus = d.Approve ? KycStatus.Approved : KycStatus.Rejected;
        c.KycReviewedById = _me.Id;
        c.KycReviewedAt = DateTime.UtcNow;
        c.KycRemarks = d.Remarks?.Trim();
        await _notify.NotifyAsync(userId,
            d.Approve ? "Your KYC is approved" : "KYC needs attention",
            d.Approve ? "Thank you — your documents are verified." : $"Reason: {c.KycRemarks}. Please update and resubmit.",
            "kyc", ct);
        await _db.SaveChangesAsync(ct);
        return await GetCustomerAsync(userId, ct);
    }

    public async Task<RewardTxnDto> AdjustCustomerRewardsAsync(long userId, RewardAdjust dto, CancellationToken ct = default)
    {
        if (dto.Points == 0) throw new AppException("Points cannot be zero.");
        if (string.IsNullOrWhiteSpace(dto.Note)) throw new AppException("Add a note explaining the adjustment.");
        var u = await _db.Users.Include(x => x.CustomerProfile).FirstOrDefaultAsync(x => x.Id == userId && x.UserType == UserType.Customer, ct)
                ?? throw new NotFoundException("Customer");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var type = dto.Points < 0 && dto.Note.Contains("redeem", StringComparison.OrdinalIgnoreCase) ? RewardTransactionType.Redeemed : RewardTransactionType.Adjusted;
        await PostAsync(u, type, dto.Points, dto.Note.Trim(), ct);
        await _notify.NotifyAsync(userId, "Reward points updated", $"{(dto.Points > 0 ? "+" : "")}{dto.Points:0.##} points. {dto.Note.Trim()}", "rewards", ct);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        var t = await _db.RewardTransactions.AsNoTracking().Where(r => r.PartnerUserId == userId).OrderByDescending(r => r.Id).FirstAsync(ct);
        return new RewardTxnDto(t.Id, t.CreatedAt, t.Type, t.Points, t.BalanceAfter, t.OrderId, null, t.Note);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)> OpenCustomerDocumentAsync(long userId, long docId, CancellationToken ct = default)
    {
        var doc = await _db.KycDocuments.AsNoTracking().Include(d => d.CustomerProfile)
            .FirstOrDefaultAsync(d => d.Id == docId && d.CustomerProfile != null && d.CustomerProfile.UserId == userId, ct)
            ?? throw new NotFoundException("Document");
        var (stream, type) = await _files.OpenAsync(doc.FileKey, ct);
        return (stream, type, $"{doc.DocumentType}-{userId}{Path.GetExtension(doc.FileKey)}");
    }
}
