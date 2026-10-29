using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Notifications;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.ServiceRequests;

public record ServiceRequestCreate(ServiceType ServiceType, string Description, string? ContactName, string? ContactPhone,
    string? Address, string? Pincode, DateTime? PreferredAt);

public record ServiceRequestQuery(string? Search, ServiceType? ServiceType, ServiceRequestStatus? Status,
    DateOnly? From, DateOnly? To, string? Pincode, int Page = 1, int PageSize = 25);

public record ServiceRequestUpdate(ServiceRequestStatus Status, long? AssignedPartnerId, string? Note);

public record ServiceRequestEventDto(DateTime At, ServiceRequestStatus Status, string? Note, string? By);

public record ServiceRequestDto(long Id, string RequestNo, DateTime CreatedAt, ServiceType ServiceType, string Description,
    string ContactName, string ContactPhone, string? Address, string? Pincode, DateTime? PreferredAt,
    ServiceRequestStatus Status, long? AssignedPartnerId, string? AssignedPartnerName, string? AssignedPartnerPhone,
    string? AdminNotes, List<ServiceRequestEventDto> History);

public interface IServiceRequestService
{
    Task<ServiceRequestDto> CreateAsync(long userId, ServiceRequestCreate dto, CancellationToken ct = default);
    Task<List<ServiceRequestDto>> MineAsync(long userId, CancellationToken ct = default);
    Task<ServiceRequestDto> CancelMineAsync(long userId, long id, CancellationToken ct = default);
    Task<PagedResult<ServiceRequestDto>> ListAsync(ServiceRequestQuery q, CancellationToken ct = default);
    Task<ServiceRequestDto> GetAsync(long id, CancellationToken ct = default);
    Task<ServiceRequestDto> UpdateAsync(long id, ServiceRequestUpdate dto, CancellationToken ct = default);
}

public class ServiceRequestService : IServiceRequestService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;
    private readonly INotificationService _notify;

    public ServiceRequestService(AppDbContext db, ICurrentUser me, INotificationService notify)
    {
        _db = db;
        _me = me;
        _notify = notify;
    }

    public async Task<ServiceRequestDto> CreateAsync(long userId, ServiceRequestCreate dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Description) || dto.Description.Trim().Length < 5)
            throw new AppException("Describe the work you need done.");
        var open = await _db.ServiceRequests.CountAsync(r => r.UserId == userId && r.Status == ServiceRequestStatus.Pending, ct);
        if (open >= 5) throw new AppException("You already have 5 open requests. We'll get back to you soon.", 429);

        var user = await _db.Users.FirstAsync(u => u.Id == userId, ct);
        var req = new ServiceRequest
        {
            RequestNo = $"SR{await _db.NextSequenceValueAsync(Sequences.ServiceRequestNo, ct):D6}",
            UserId = userId,
            ServiceType = dto.ServiceType,
            Description = dto.Description.Trim(),
            ContactName = string.IsNullOrWhiteSpace(dto.ContactName) ? (string.IsNullOrWhiteSpace(user.Name) ? "Customer" : user.Name) : dto.ContactName.Trim(),
            ContactPhone = string.IsNullOrWhiteSpace(dto.ContactPhone) ? user.Phone ?? "" : Phone.Normalize(dto.ContactPhone),
            Address = dto.Address?.Trim(),
            Pincode = dto.Pincode?.Trim(),
            PreferredAt = dto.PreferredAt
        };
        req.Events.Add(new ServiceRequestEvent { Status = ServiceRequestStatus.Pending, Note = "Request created", UserId = userId });
        _db.ServiceRequests.Add(req);
        await _db.SaveChangesAsync(ct);
        return await GetAsync(req.Id, ct);
    }

    private IQueryable<ServiceRequest> Query() => _db.ServiceRequests.AsNoTracking()
        .Include(r => r.AssignedPartner).Include(r => r.Events);

    public async Task<List<ServiceRequestDto>> MineAsync(long userId, CancellationToken ct = default) =>
        (await Query().Where(r => r.UserId == userId).OrderByDescending(r => r.Id).Take(50).ToListAsync(ct)).Select(r => ToDto(r, false)).ToList();

    public async Task<ServiceRequestDto> CancelMineAsync(long userId, long id, CancellationToken ct = default)
    {
        var r = await _db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct) ?? throw new NotFoundException("Request");
        if (r.Status != ServiceRequestStatus.Pending) throw new AppException("Only pending requests can be cancelled.");
        r.Status = ServiceRequestStatus.Cancelled;
        _db.ServiceRequestEvents.Add(new ServiceRequestEvent { ServiceRequestId = r.Id, Status = r.Status, Note = "Cancelled by customer", UserId = userId });
        await _db.SaveChangesAsync(ct);
        return ToDto(await Query().FirstAsync(x => x.Id == id, ct), false);
    }

    public async Task<PagedResult<ServiceRequestDto>> ListAsync(ServiceRequestQuery q, CancellationToken ct = default)
    {
        var query = Query();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = $"%{q.Search.Trim()}%";
            query = query.Where(r => EF.Functions.ILike(r.RequestNo, s) || EF.Functions.ILike(r.ContactName, s)
                                     || EF.Functions.ILike(r.ContactPhone, s) || EF.Functions.ILike(r.Description, s));
        }
        if (q.ServiceType != null) query = query.Where(r => r.ServiceType == q.ServiceType);
        if (q.Status != null) query = query.Where(r => r.Status == q.Status);
        if (!string.IsNullOrWhiteSpace(q.Pincode)) query = query.Where(r => r.Pincode == q.Pincode);
        if (q.From != null) { var f = Clock.IstDateStartUtc(q.From.Value.ToDateTime(TimeOnly.MinValue)); query = query.Where(r => r.CreatedAt >= f); }
        if (q.To != null) { var t = Clock.IstDateStartUtc(q.To.Value.ToDateTime(TimeOnly.MinValue).AddDays(1)); query = query.Where(r => r.CreatedAt < t); }

        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(r => r.Id).Page(page).AsSplitQuery().ToListAsync(ct);
        return new PagedResult<ServiceRequestDto>(rows.Select(r => ToDto(r, true)).ToList(), total, page.SafePage, page.SafeSize);
    }

    public async Task<ServiceRequestDto> GetAsync(long id, CancellationToken ct = default) =>
        ToDto(await Query().FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw new NotFoundException("Request"), true);

    public async Task<ServiceRequestDto> UpdateAsync(long id, ServiceRequestUpdate dto, CancellationToken ct = default)
    {
        var r = await _db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Request");
        if (dto.AssignedPartnerId != null && !await _db.PartnerProfiles.AnyAsync(p => p.UserId == dto.AssignedPartnerId && p.KycStatus == KycStatus.Approved, ct))
            throw new AppException("Assign an approved referral partner.");

        var statusChanged = r.Status != dto.Status;
        var assigneeChanged = r.AssignedPartnerId != dto.AssignedPartnerId;
        r.Status = dto.Status;
        r.AssignedPartnerId = dto.AssignedPartnerId;
        if (!string.IsNullOrWhiteSpace(dto.Note)) r.AdminNotes = dto.Note.Trim();
        _db.ServiceRequestEvents.Add(new ServiceRequestEvent
        {
            ServiceRequestId = r.Id, Status = r.Status, Note = dto.Note?.Trim(), UserId = _me.Id, UserName = _me.Name
        });

        if (statusChanged)
            await _notify.NotifyAsync(r.UserId, $"Service request {r.RequestNo}", r.Status switch
            {
                ServiceRequestStatus.InProgress => "A technician has been assigned and will contact you shortly.",
                ServiceRequestStatus.Completed => "Marked as completed. Thank you!",
                ServiceRequestStatus.Cancelled => "Your request was cancelled." + (string.IsNullOrWhiteSpace(dto.Note) ? "" : $" {dto.Note}"),
                _ => "Status updated."
            }, $"service:{r.Id}", ct);
        if (assigneeChanged && r.AssignedPartnerId != null)
            await _notify.NotifyAsync(r.AssignedPartnerId.Value, "New service job assigned",
                $"{r.ServiceType} work for {r.ContactName} ({r.Pincode}). Call {r.ContactPhone}.", $"service:{r.Id}", ct);

        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static ServiceRequestDto ToDto(ServiceRequest r, bool staff) => new(
        r.Id, r.RequestNo, r.CreatedAt, r.ServiceType, r.Description, r.ContactName, r.ContactPhone, r.Address, r.Pincode, r.PreferredAt,
        r.Status, r.AssignedPartnerId, r.AssignedPartner?.Name, r.AssignedPartner?.Phone, staff ? r.AdminNotes : null,
        r.Events.OrderBy(e => e.Id).Select(e => new ServiceRequestEventDto(e.CreatedAt, e.Status, e.Note, staff ? e.UserName : null)).ToList());
}
