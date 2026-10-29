using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Erp;
using BuildMate.Services.Files;
using BuildMate.Services.Notifications;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Partners;

// ---------------------------------------------------------------- DTOs

public record PartnerQuery(string? Search, string? Pincode, string? City, string? Area, long? ManagerId,
    KycStatus? KycStatus, PartnerType? PartnerType, bool? IsActive, string? Sort, int Page = 1, int PageSize = 25);

public record PartnerListDto(long UserId, string Name, string? Phone, string? BusinessName, PartnerType PartnerType,
    string? City, string? Area, string? Pincode, KycStatus KycStatus, string? ManagerName, decimal RewardBalance,
    int OrderCount, decimal TotalPurchase, DateTime? LastOrderAt, bool IsActive, DateTime CreatedAt);

public record KycDocumentDto(long Id, KycDocumentType DocumentType, string? DocumentNumberMasked, string FileKey, DateTime UploadedAt);

public record PartnerDetailDto(long UserId, string Name, string? Phone, string? Email, bool IsActive, DateTime CreatedAt, DateTime? LastLoginAt,
    PartnerType PartnerType, string? BusinessName, string? AddressLine, string? Area, string? City, string? State, string? Pincode,
    double? Latitude, double? Longitude, string? Gstin, bool LocationVerified,
    KycStatus KycStatus, DateTime? KycSubmittedAt, string? KycReviewedByName, DateTime? KycReviewedAt, string? KycRemarks,
    long? ManagerId, string? ManagerName, bool CreatedByAdmin, decimal RewardBalance,
    List<KycDocumentDto> Documents, PartnerStatsDto Stats);

public record PartnerStatsDto(int OrderCount, decimal TotalPurchase, decimal AverageOrderValue, DateTime? LastOrderAt,
    decimal PointsEarned, List<TopItemDto> TopProducts);

public record TopItemDto(long Id, string Name, decimal Quantity, decimal Amount);

/// <summary>Profile fields a partner fills during registration (and admins can edit).</summary>
public record PartnerProfileInput(string Name, PartnerType PartnerType, string? BusinessName, string? AddressLine, string? Area,
    string? City, string? State, string? Pincode, double? Latitude, double? Longitude, string? Gstin, string? Email, string? PreferredLanguage);

public record AdminPartnerCreate(string Phone, PartnerProfileInput Profile, long? ManagerId, bool ApproveNow);

public record KycDecision(bool Approve, string? Remarks, bool LocationVerified);

public record RewardAdjust(decimal Points, string Note);

public record RewardTxnDto(long Id, DateTime CreatedAt, RewardTransactionType Type, decimal Points, decimal BalanceAfter, long? OrderId, string? OrderNo, string? Note);

public record RewardSummaryDto(decimal Balance, decimal LifetimeEarned, decimal ThisMonthEarned, decimal PointValueRupees, List<RewardTxnDto> Recent);

// ---------------------------------------------------------------- Service

public interface IPartnerService
{
    // Admin
    Task<PagedResult<PartnerListDto>> ListAsync(PartnerQuery q, CancellationToken ct = default);
    Task<PartnerDetailDto> GetAsync(long userId, CancellationToken ct = default);
    Task<PartnerDetailDto> CreateByAdminAsync(AdminPartnerCreate dto, CancellationToken ct = default);
    Task<PartnerDetailDto> UpdateByAdminAsync(long userId, PartnerProfileInput dto, long? managerId, bool isActive, CancellationToken ct = default);
    Task<PartnerDetailDto> DecideKycAsync(long userId, KycDecision d, CancellationToken ct = default);
    Task<RewardTxnDto> AdjustRewardsAsync(long userId, RewardAdjust dto, CancellationToken ct = default);
    Task<PagedResult<RewardTxnDto>> RewardHistoryAsync(long userId, PageRequest page, CancellationToken ct = default);

    // Partner self-service
    Task<PartnerDetailDto> SubmitProfileAsync(long userId, PartnerProfileInput dto, CancellationToken ct = default);
    Task<KycDocumentDto> AddKycDocumentAsync(long userId, KycDocumentType type, string? number, Stream file, string fileName, long length, CancellationToken ct = default);
    Task<PartnerDetailDto> SubmitKycAsync(long userId, CancellationToken ct = default);
    Task<RewardSummaryDto> RewardSummaryAsync(long userId, CancellationToken ct = default);

    /// <summary>Credits (or reverses) points and writes the ledger. Caller saves.</summary>
    Task PostRewardAsync(long userId, RewardTransactionType type, decimal points, long? orderId, string? note, CancellationToken ct);
}

public class PartnerService : IPartnerService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;
    private readonly IFileStorage _files;
    private readonly INotificationService _notify;
    private readonly IOutbox _outbox;
    private readonly Content.ISettingsService _settings;

    public PartnerService(AppDbContext db, ICurrentUser me, IFileStorage files, INotificationService notify, IOutbox outbox, Content.ISettingsService settings)
    {
        _db = db;
        _me = me;
        _files = files;
        _notify = notify;
        _outbox = outbox;
        _settings = settings;
    }

    private static readonly OrderStatus[] Counted = { OrderStatus.Paid, OrderStatus.Processing, OrderStatus.ReadyForPickup, OrderStatus.OutForDelivery, OrderStatus.Completed };

    public async Task<PagedResult<PartnerListDto>> ListAsync(PartnerQuery q, CancellationToken ct = default)
    {
        var query = _db.PartnerProfiles.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = $"%{q.Search.Trim()}%";
            query = query.Where(p => EF.Functions.ILike(p.User.Name, s) || EF.Functions.ILike(p.User.Phone ?? "", s) || EF.Functions.ILike(p.BusinessName ?? "", s));
        }
        if (!string.IsNullOrWhiteSpace(q.Pincode)) query = query.Where(p => p.Pincode == q.Pincode.Trim());
        if (!string.IsNullOrWhiteSpace(q.City)) query = query.Where(p => EF.Functions.ILike(p.City ?? "", $"%{q.City.Trim()}%"));
        if (!string.IsNullOrWhiteSpace(q.Area)) query = query.Where(p => EF.Functions.ILike(p.Area ?? "", $"%{q.Area.Trim()}%"));
        if (q.ManagerId != null) query = query.Where(p => p.ManagerId == q.ManagerId);
        if (q.KycStatus != null) query = query.Where(p => p.KycStatus == q.KycStatus);
        if (q.PartnerType != null) query = query.Where(p => p.PartnerType == q.PartnerType);
        if (q.IsActive != null) query = query.Where(p => p.User.IsActive == q.IsActive);

        // Correlated subqueries are written inline so EF translates them into a single SQL statement.
        var projected = query.Select(p => new PartnerListDto(
            p.UserId, p.User.Name, p.User.Phone, p.BusinessName, p.PartnerType, p.City, p.Area, p.Pincode,
            p.KycStatus, p.Manager != null ? p.Manager.Name : null, p.RewardBalance,
            _db.Orders.Count(o => o.UserId == p.UserId && Counted.Contains(o.Status)),
            _db.Orders.Where(o => o.UserId == p.UserId && Counted.Contains(o.Status)).Sum(o => (decimal?)o.GrandTotal) ?? 0,
            _db.Orders.Where(o => o.UserId == p.UserId && Counted.Contains(o.Status)).Max(o => (DateTime?)o.CreatedAt),
            p.User.IsActive, p.CreatedAt));

        projected = q.Sort switch
        {
            "purchase" => projected.OrderByDescending(x => x.TotalPurchase),
            "rewards" => projected.OrderByDescending(x => x.RewardBalance),
            "name" => projected.OrderBy(x => x.Name),
            "last_order" => projected.OrderByDescending(x => x.LastOrderAt),
            _ => projected.OrderByDescending(x => x.CreatedAt)
        };

        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var items = await projected.Page(page).ToListAsync(ct);
        return new PagedResult<PartnerListDto>(items, total, page.SafePage, page.SafeSize);
    }

    public async Task<PartnerDetailDto> GetAsync(long userId, CancellationToken ct = default)
    {
        var p = await _db.PartnerProfiles.AsNoTracking()
            .Include(x => x.User).Include(x => x.Manager).Include(x => x.KycReviewedBy).Include(x => x.Documents)
            .FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new NotFoundException("Partner");

        var orders = _db.Orders.AsNoTracking().Where(o => o.UserId == userId && Counted.Contains(o.Status));
        var count = await orders.CountAsync(ct);
        var total = await orders.SumAsync(o => (decimal?)o.GrandTotal, ct) ?? 0;
        var last = await orders.MaxAsync(o => (DateTime?)o.CreatedAt, ct);
        var earned = await _db.RewardTransactions.Where(r => r.PartnerUserId == userId && r.Type == RewardTransactionType.Earned)
            .SumAsync(r => (decimal?)r.Points, ct) ?? 0;
        var top = await _db.OrderItems.AsNoTracking().Where(i => i.Order.UserId == userId && Counted.Contains(i.Order.Status))
            .GroupBy(i => new { i.ProductId, i.ProductName })
            .Select(g => new TopItemDto(g.Key.ProductId, g.Key.ProductName, g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal)))
            .OrderByDescending(x => x.Amount).Take(5).ToListAsync(ct);

        return new PartnerDetailDto(p.UserId, p.User.Name, p.User.Phone, p.User.Email, p.User.IsActive, p.CreatedAt, p.User.LastLoginAt,
            p.PartnerType, p.BusinessName, p.AddressLine, p.Area, p.City, p.State, p.Pincode, p.Latitude, p.Longitude, p.Gstin, p.LocationVerified,
            p.KycStatus, p.KycSubmittedAt, p.KycReviewedBy?.Name, p.KycReviewedAt, p.KycRemarks,
            p.ManagerId, p.Manager?.Name, p.CreatedByAdmin, p.RewardBalance,
            p.Documents.OrderBy(d => d.Id).Select(d => new KycDocumentDto(d.Id, d.DocumentType, d.DocumentNumberMasked, d.FileKey, d.CreatedAt)).ToList(),
            new PartnerStatsDto(count, total, count == 0 ? 0 : Pricing.Round(total / count), last, earned, top));
    }

    public async Task<PartnerDetailDto> CreateByAdminAsync(AdminPartnerCreate dto, CancellationToken ct = default)
    {
        var phone = Phone.Normalize(dto.Phone);
        if (await _db.Users.AnyAsync(u => u.Phone == phone && u.UserType == UserType.Partner, ct))
            throw new AppException("A partner with this mobile number already exists.", 409, "duplicate");
        await ValidateManagerAsync(dto.ManagerId, ct);

        var user = new AppUser { UserType = UserType.Partner, Phone = phone };
        var profile = new PartnerProfile { User = user, CreatedByAdmin = true, ManagerId = dto.ManagerId };
        ApplyProfile(user, profile, dto.Profile);
        if (dto.ApproveNow)
        {
            profile.KycStatus = KycStatus.Approved;
            profile.KycReviewedById = _me.Id;
            profile.KycReviewedAt = DateTime.UtcNow;
            profile.KycRemarks = "Created and approved by admin";
        }
        else profile.KycStatus = KycStatus.Pending;
        profile.KycSubmittedAt = DateTime.UtcNow;

        _db.Users.Add(user);
        _db.PartnerProfiles.Add(profile);
        await _db.SaveChangesAsync(ct);
        return await GetAsync(user.Id, ct);
    }

    public async Task<PartnerDetailDto> UpdateByAdminAsync(long userId, PartnerProfileInput dto, long? managerId, bool isActive, CancellationToken ct = default)
    {
        var p = await _db.PartnerProfiles.Include(x => x.User).FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new NotFoundException("Partner");
        await ValidateManagerAsync(managerId, ct);
        ApplyProfile(p.User, p, dto);
        p.ManagerId = managerId;
        p.User.IsActive = isActive;
        await _db.SaveChangesAsync(ct);
        return await GetAsync(userId, ct);
    }

    public async Task<PartnerDetailDto> DecideKycAsync(long userId, KycDecision d, CancellationToken ct = default)
    {
        var p = await _db.PartnerProfiles.Include(x => x.User).FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new NotFoundException("Partner");
        if (!d.Approve && string.IsNullOrWhiteSpace(d.Remarks)) throw new AppException("Please give a reason so the partner knows what to fix.");

        p.KycStatus = d.Approve ? KycStatus.Approved : KycStatus.Rejected;
        p.KycReviewedById = _me.Id;
        p.KycReviewedAt = DateTime.UtcNow;
        p.KycRemarks = d.Remarks?.Trim();
        p.LocationVerified = d.LocationVerified;

        await _notify.NotifyAsync(userId,
            d.Approve ? "Your account is approved 🎉" : "KYC needs attention",
            d.Approve ? "You can now order with partner pricing and earn reward points." : $"Reason: {p.KycRemarks}. Please update and resubmit.",
            "kyc", ct);
        if (d.Approve) _outbox.Add(ErpEvents.PartnerApproved, new { p.UserId, p.User.Name, p.User.Phone, p.BusinessName, p.Gstin, p.City, p.Pincode });
        await _db.SaveChangesAsync(ct);
        return await GetAsync(userId, ct);
    }

    public async Task<RewardTxnDto> AdjustRewardsAsync(long userId, RewardAdjust dto, CancellationToken ct = default)
    {
        if (dto.Points == 0) throw new AppException("Points cannot be zero.");
        if (string.IsNullOrWhiteSpace(dto.Note)) throw new AppException("Add a note explaining the adjustment.");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var type = dto.Points < 0 && dto.Note.Contains("redeem", StringComparison.OrdinalIgnoreCase)
            ? RewardTransactionType.Redeemed : RewardTransactionType.Adjusted;
        await PostRewardAsync(userId, type, dto.Points, null, dto.Note.Trim(), ct);
        await _notify.NotifyAsync(userId, "Reward points updated",
            $"{(dto.Points > 0 ? "+" : "")}{dto.Points:0.##} points. {dto.Note.Trim()}", "rewards", ct);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        var t = await _db.RewardTransactions.AsNoTracking().Where(r => r.PartnerUserId == userId).OrderByDescending(r => r.Id).FirstAsync(ct);
        return new RewardTxnDto(t.Id, t.CreatedAt, t.Type, t.Points, t.BalanceAfter, t.OrderId, null, t.Note);
    }

    public async Task PostRewardAsync(long userId, RewardTransactionType type, decimal points, long? orderId, string? note, CancellationToken ct)
    {
        var p = await _db.LockPartnerAsync(userId, ct) ?? throw new NotFoundException("Partner");
        var newBalance = p.RewardBalance + points;
        if (newBalance < 0) throw new AppException($"Partner only has {p.RewardBalance:0.##} points.", 409, "insufficient_points");
        p.RewardBalance = newBalance;
        _db.RewardTransactions.Add(new RewardTransaction
        {
            PartnerUserId = userId, Type = type, Points = points, BalanceAfter = newBalance,
            OrderId = orderId, Note = note, CreatedById = _me.Id
        });
    }

    public async Task<PagedResult<RewardTxnDto>> RewardHistoryAsync(long userId, PageRequest page, CancellationToken ct = default)
    {
        var q = _db.RewardTransactions.AsNoTracking().Where(r => r.PartnerUserId == userId);
        var total = await q.CountAsync(ct);
        var items = await q.OrderByDescending(r => r.Id).Page(page)
            .Select(r => new RewardTxnDto(r.Id, r.CreatedAt, r.Type, r.Points, r.BalanceAfter, r.OrderId,
                r.OrderId == null ? null : _db.Orders.Where(o => o.Id == r.OrderId).Select(o => o.OrderNo).FirstOrDefault(), r.Note))
            .ToListAsync(ct);
        return new PagedResult<RewardTxnDto>(items, total, page.SafePage, page.SafeSize);
    }

    // ---------------------------------------------------------------- Partner self-service

    public async Task<PartnerDetailDto> SubmitProfileAsync(long userId, PartnerProfileInput dto, CancellationToken ct = default)
    {
        var p = await _db.PartnerProfiles.Include(x => x.User).FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new NotFoundException("Partner");
        ApplyProfile(p.User, p, dto);
        // Editing identity details after approval does not revoke approval, but is logged via UpdatedAt.
        await _db.SaveChangesAsync(ct);
        return await GetAsync(userId, ct);
    }

    public async Task<KycDocumentDto> AddKycDocumentAsync(long userId, KycDocumentType type, string? number, Stream file, string fileName, long length, CancellationToken ct = default)
    {
        var p = await _db.PartnerProfiles.Include(x => x.Documents).FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new NotFoundException("Partner");
        if (p.KycStatus == KycStatus.Approved) throw new AppException("Your KYC is already approved. Contact the store to change documents.");
        var contentType = UploadRules.Validate(fileName, length, 8 * 1024 * 1024);
        var key = await _files.SaveAsync(file, fileName, contentType, $"kyc/{userId}", isPrivate: true, ct);

        // Replace an earlier upload of the same document type.
        foreach (var old in p.Documents.Where(d => d.DocumentType == type).ToList()) _db.KycDocuments.Remove(old);
        var doc = new KycDocument { PartnerProfileId = p.Id, DocumentType = type, DocumentNumberMasked = Mask(number), FileKey = key };
        _db.KycDocuments.Add(doc);
        await _db.SaveChangesAsync(ct);
        return new KycDocumentDto(doc.Id, doc.DocumentType, doc.DocumentNumberMasked, doc.FileKey, doc.CreatedAt);
    }

    public async Task<PartnerDetailDto> SubmitKycAsync(long userId, CancellationToken ct = default)
    {
        var p = await _db.PartnerProfiles.Include(x => x.User).Include(x => x.Documents).FirstOrDefaultAsync(x => x.UserId == userId, ct)
                ?? throw new NotFoundException("Partner");
        if (string.IsNullOrWhiteSpace(p.User.Name) || string.IsNullOrWhiteSpace(p.Pincode) || string.IsNullOrWhiteSpace(p.City))
            throw new AppException("Please complete your name, city and pincode first.");
        if (!p.Documents.Any(d => d.DocumentType is KycDocumentType.Aadhaar or KycDocumentType.Pan))
            throw new AppException("Upload your Aadhaar or PAN card to continue.");
        if (p.KycStatus == KycStatus.Approved) return await GetAsync(userId, ct);

        p.KycStatus = KycStatus.Pending;
        p.KycSubmittedAt = DateTime.UtcNow;
        p.KycRemarks = null;
        await _db.SaveChangesAsync(ct);
        return await GetAsync(userId, ct);
    }

    public async Task<RewardSummaryDto> RewardSummaryAsync(long userId, CancellationToken ct = default)
    {
        var p = await _db.PartnerProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId, ct) ?? throw new NotFoundException("Partner");
        var monthStart = Clock.IstDateStartUtc(new DateTime(Clock.TodayIst.Year, Clock.TodayIst.Month, 1));
        var earned = _db.RewardTransactions.Where(r => r.PartnerUserId == userId && r.Type == RewardTransactionType.Earned);
        var lifetime = await earned.SumAsync(r => (decimal?)r.Points, ct) ?? 0;
        var month = await earned.Where(r => r.CreatedAt >= monthStart).SumAsync(r => (decimal?)r.Points, ct) ?? 0;
        var recent = await RewardHistoryAsync(userId, new PageRequest(1, 10), ct);
        var settings = await _settings.GetAsync(ct);
        return new RewardSummaryDto(p.RewardBalance, lifetime, month, settings.RewardPointValue, recent.Items.ToList());
    }

    // ---------------------------------------------------------------- helpers

    private async Task ValidateManagerAsync(long? managerId, CancellationToken ct)
    {
        if (managerId != null && !await _db.Users.AnyAsync(u => u.Id == managerId && u.UserType == UserType.Staff && u.IsActive, ct))
            throw new AppException("Selected manager is not an active staff member.");
    }

    private static void ApplyProfile(AppUser u, PartnerProfile p, PartnerProfileInput d)
    {
        if (string.IsNullOrWhiteSpace(d.Name)) throw new AppException("Name is required.");
        if (!string.IsNullOrWhiteSpace(d.Pincode) && (d.Pincode.Trim().Length != 6 || !d.Pincode.Trim().All(char.IsDigit)))
            throw new AppException("Pincode must be 6 digits.");
        if (!string.IsNullOrWhiteSpace(d.Gstin) && d.Gstin.Trim().Length != 15) throw new AppException("GSTIN must be 15 characters.");

        u.Name = d.Name.Trim();
        u.Email = string.IsNullOrWhiteSpace(d.Email) ? null : d.Email.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(d.PreferredLanguage)) u.PreferredLanguage = d.PreferredLanguage.Trim().ToLowerInvariant();
        p.PartnerType = d.PartnerType;
        p.BusinessName = d.BusinessName?.Trim();
        p.AddressLine = d.AddressLine?.Trim();
        p.Area = d.Area?.Trim();
        p.City = d.City?.Trim();
        p.State = d.State?.Trim();
        p.Pincode = d.Pincode?.Trim();
        p.Latitude = d.Latitude;
        p.Longitude = d.Longitude;
        p.Gstin = string.IsNullOrWhiteSpace(d.Gstin) ? null : d.Gstin.Trim().ToUpperInvariant();
    }

    /// <summary>Keeps only the last 4 characters: never store full Aadhaar/PAN numbers.</summary>
    private static string? Mask(string? number)
    {
        if (string.IsNullOrWhiteSpace(number)) return null;
        var clean = new string(number.Where(char.IsLetterOrDigit).ToArray());
        return clean.Length <= 4 ? new string('X', clean.Length) : new string('X', clean.Length - 4) + clean[^4..];
    }
}
