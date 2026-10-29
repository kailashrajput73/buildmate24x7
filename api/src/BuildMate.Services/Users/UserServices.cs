using BuildMate.Data;
using BuildMate.Domain.Common;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Auth;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Users;

// ---------------------------------------------------------------- Staff & roles (admin)

public record RoleDto(long Id, string Name, string? Description, List<string> Permissions, bool IsSystem, int UserCount);
public record RoleUpsert(string Name, string? Description, List<string> Permissions);
public record PermissionDto(string Key, string Label, string Group);

public record StaffDto(long Id, string Name, string? Email, string? Phone, long? RoleId, string? RoleName, bool IsActive, DateTime? LastLoginAt, int PartnerCount);
public record StaffUpsert(string Name, string Email, string? Phone, long RoleId, bool IsActive, string? Password);

public interface IStaffService
{
    Task<List<RoleDto>> RolesAsync(CancellationToken ct = default);
    Task<RoleDto> SaveRoleAsync(long? id, RoleUpsert dto, CancellationToken ct = default);
    Task DeleteRoleAsync(long id, CancellationToken ct = default);
    IReadOnlyList<PermissionDto> Permissions();
    Task<List<StaffDto>> ListAsync(string? search, CancellationToken ct = default);
    Task<StaffDto> SaveAsync(long? id, StaffUpsert dto, CancellationToken ct = default);
}

public class StaffService : IStaffService
{
    private readonly AppDbContext _db;
    private readonly IAuthService _auth;
    private readonly ICurrentUser _me;

    public StaffService(AppDbContext db, IAuthService auth, ICurrentUser me)
    {
        _db = db;
        _auth = auth;
        _me = me;
    }

    public IReadOnlyList<PermissionDto> Permissions() =>
        Domain.Common.Permissions.Catalogue.Select(p => new PermissionDto(p.Key, p.Label, p.Group)).ToList();

    public Task<List<RoleDto>> RolesAsync(CancellationToken ct = default) =>
        _db.Roles.AsNoTracking().OrderBy(r => r.Name)
            .Select(r => new RoleDto(r.Id, r.Name, r.Description, r.Permissions, r.IsSystem, r.Users.Count)).ToListAsync(ct);

    public async Task<RoleDto> SaveRoleAsync(long? id, RoleUpsert dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new AppException("Role name is required.");
        var valid = Domain.Common.Permissions.AllKeys.ToHashSet();
        var perms = (dto.Permissions ?? new()).Distinct().ToList();
        if (perms.Any(p => p != Domain.Common.Permissions.All && !valid.Contains(p))) throw new AppException("Unknown permission in list.");
        if (await _db.Roles.AnyAsync(r => r.Name.ToLower() == dto.Name.Trim().ToLower() && r.Id != (id ?? 0), ct))
            throw new AppException("A role with this name exists.", 409, "duplicate");

        var role = id == null ? new Role() : await _db.Roles.FindAsync(new object[] { id.Value }, ct) ?? throw new NotFoundException("Role");
        if (role.IsSystem) throw new AppException("The built-in Administrator role can't be changed.");
        role.Name = dto.Name.Trim();
        role.Description = dto.Description?.Trim();
        role.Permissions = perms;
        if (id == null) _db.Roles.Add(role);
        await _db.SaveChangesAsync(ct);
        return (await RolesAsync(ct)).First(r => r.Id == role.Id);
    }

    public async Task DeleteRoleAsync(long id, CancellationToken ct = default)
    {
        var role = await _db.Roles.Include(r => r.Users).FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw new NotFoundException("Role");
        if (role.IsSystem) throw new AppException("The built-in Administrator role can't be deleted.");
        if (role.Users.Any()) throw new AppException("Move the users in this role to another role first.");
        _db.Roles.Remove(role);
        await _db.SaveChangesAsync(ct);
    }

    public Task<List<StaffDto>> ListAsync(string? search, CancellationToken ct = default)
    {
        var q = _db.Users.AsNoTracking().Where(u => u.UserType == UserType.Staff);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = $"%{search.Trim()}%";
            q = q.Where(u => EF.Functions.ILike(u.Name, s) || EF.Functions.ILike(u.Email ?? "", s) || EF.Functions.ILike(u.Phone ?? "", s));
        }
        return q.OrderBy(u => u.Name)
            .Select(u => new StaffDto(u.Id, u.Name, u.Email, u.Phone, u.RoleId, u.Role != null ? u.Role.Name : null, u.IsActive, u.LastLoginAt,
                _db.PartnerProfiles.Count(p => p.ManagerId == u.Id)))
            .ToListAsync(ct);
    }

    public async Task<StaffDto> SaveAsync(long? id, StaffUpsert dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new AppException("Name is required.");
        var email = (dto.Email ?? "").Trim().ToLowerInvariant();
        if (!email.Contains('@')) throw new AppException("Enter a valid email.");
        if (await _db.Users.AnyAsync(u => u.Email == email && u.Id != (id ?? 0), ct)) throw new AppException("This email is already used.", 409, "duplicate");
        if (!await _db.Roles.AnyAsync(r => r.Id == dto.RoleId, ct)) throw new NotFoundException("Role");
        if (id == _me.Id && !dto.IsActive) throw new AppException("You can't deactivate your own account.");

        var u = id == null ? new AppUser { UserType = UserType.Staff }
            : await _db.Users.FirstOrDefaultAsync(x => x.Id == id && x.UserType == UserType.Staff, ct) ?? throw new NotFoundException("Staff user");
        if (id == null && string.IsNullOrWhiteSpace(dto.Password)) throw new AppException("Set a password for the new user.");

        u.Name = dto.Name.Trim();
        u.Email = email;
        u.Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : Phone.Normalize(dto.Phone);
        u.RoleId = dto.RoleId;
        u.IsActive = dto.IsActive;
        if (!string.IsNullOrWhiteSpace(dto.Password)) u.PasswordHash = _auth.HashPassword(u, dto.Password);
        if (id == null) _db.Users.Add(u);

        if (!dto.IsActive)
        {
            var tokens = await _db.RefreshTokens.Where(t => t.UserId == u.Id && t.RevokedAt == null).ToListAsync(ct);
            foreach (var t in tokens) t.RevokedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        return (await ListAsync(null, ct)).First(x => x.Id == u.Id);
    }
}

// ---------------------------------------------------------------- Account (customers & partners)

public record AddressDto(long Id, string Name, string Phone, string Line1, string? Line2, string? Landmark, string City, string State, string Pincode, bool IsDefault);
public record AddressUpsert(string Name, string Phone, string Line1, string? Line2, string? Landmark, string City, string State, string Pincode, bool IsDefault);
public record ProfileUpdate(string Name, string? Email, string? PreferredLanguage);
public record NotificationDto(long Id, DateTime CreatedAt, string Title, string Body, string? Link, bool IsRead);
public record DeviceRegistration(string Token, DevicePlatform Platform);

public interface IAccountService
{
    Task<List<AddressDto>> AddressesAsync(long userId, CancellationToken ct = default);
    Task<AddressDto> SaveAddressAsync(long userId, long? id, AddressUpsert dto, CancellationToken ct = default);
    Task DeleteAddressAsync(long userId, long id, CancellationToken ct = default);
    Task UpdateProfileAsync(long userId, ProfileUpdate dto, CancellationToken ct = default);
    Task<PagedResult<NotificationDto>> NotificationsAsync(long userId, PageRequest page, CancellationToken ct = default);
    Task<int> UnreadCountAsync(long userId, CancellationToken ct = default);
    Task MarkReadAsync(long userId, long? id, CancellationToken ct = default);
    Task RegisterDeviceAsync(long userId, DeviceRegistration dto, CancellationToken ct = default);
    Task UnregisterDeviceAsync(long userId, string token, CancellationToken ct = default);
    Task DeleteAccountAsync(long userId, CancellationToken ct = default);
}

public class AccountService : IAccountService
{
    private readonly AppDbContext _db;
    public AccountService(AppDbContext db) => _db = db;

    private static AddressDto ToDto(Address a) => new(a.Id, a.Name, a.Phone, a.Line1, a.Line2, a.Landmark, a.City, a.State, a.Pincode, a.IsDefault);

    public async Task<List<AddressDto>> AddressesAsync(long userId, CancellationToken ct = default) =>
        (await _db.Addresses.AsNoTracking().Where(a => a.UserId == userId).OrderByDescending(a => a.IsDefault).ThenByDescending(a => a.Id).ToListAsync(ct))
        .Select(ToDto).ToList();

    public async Task<AddressDto> SaveAddressAsync(long userId, long? id, AddressUpsert dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Line1) || string.IsNullOrWhiteSpace(dto.City) || string.IsNullOrWhiteSpace(dto.State))
            throw new AppException("Name, address, city and state are required.");
        var pin = (dto.Pincode ?? "").Trim();
        if (pin.Length != 6 || !pin.All(char.IsDigit)) throw new AppException("Pincode must be 6 digits.");

        var a = id == null ? new Address { UserId = userId }
            : await _db.Addresses.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct) ?? throw new NotFoundException("Address");
        a.Name = dto.Name.Trim();
        a.Phone = Phone.Normalize(dto.Phone);
        a.Line1 = dto.Line1.Trim();
        a.Line2 = dto.Line2?.Trim();
        a.Landmark = dto.Landmark?.Trim();
        a.City = dto.City.Trim();
        a.State = dto.State.Trim();
        a.Pincode = pin;

        var others = await _db.Addresses.Where(x => x.UserId == userId && x.Id != (id ?? 0)).ToListAsync(ct);
        a.IsDefault = dto.IsDefault || others.Count == 0;
        if (a.IsDefault) foreach (var o in others) o.IsDefault = false;
        if (id == null) _db.Addresses.Add(a);
        await _db.SaveChangesAsync(ct);
        return ToDto(a);
    }

    public async Task DeleteAddressAsync(long userId, long id, CancellationToken ct = default)
    {
        var a = await _db.Addresses.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct) ?? throw new NotFoundException("Address");
        _db.Addresses.Remove(a);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateProfileAsync(long userId, ProfileUpdate dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new AppException("Name is required.");
        var u = await _db.Users.FirstAsync(x => x.Id == userId, ct);
        u.Name = dto.Name.Trim();
        u.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(dto.PreferredLanguage)) u.PreferredLanguage = dto.PreferredLanguage.Trim().ToLowerInvariant();
        await _db.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<NotificationDto>> NotificationsAsync(long userId, PageRequest page, CancellationToken ct = default)
    {
        var q = _db.Notifications.AsNoTracking().Where(n => n.UserId == userId);
        var total = await q.CountAsync(ct);
        var items = await q.OrderByDescending(n => n.Id).Page(page)
            .Select(n => new NotificationDto(n.Id, n.CreatedAt, n.Title, n.Body, n.Link, n.IsRead)).ToListAsync(ct);
        return new PagedResult<NotificationDto>(items, total, page.SafePage, page.SafeSize);
    }

    public Task<int> UnreadCountAsync(long userId, CancellationToken ct = default) =>
        _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead, ct);

    public async Task MarkReadAsync(long userId, long? id, CancellationToken ct = default)
    {
        var q = _db.Notifications.Where(n => n.UserId == userId && !n.IsRead);
        if (id != null) q = q.Where(n => n.Id == id);
        await q.ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
    }

    public async Task RegisterDeviceAsync(long userId, DeviceRegistration dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Token)) return;
        var existing = await _db.DeviceTokens.FirstOrDefaultAsync(t => t.Token == dto.Token, ct);
        if (existing == null) _db.DeviceTokens.Add(new DeviceToken { UserId = userId, Token = dto.Token, Platform = dto.Platform });
        else { existing.UserId = userId; existing.Platform = dto.Platform; }
        await _db.SaveChangesAsync(ct);
    }

    public async Task UnregisterDeviceAsync(long userId, string token, CancellationToken ct = default) =>
        await _db.DeviceTokens.Where(t => t.UserId == userId && t.Token == token).ExecuteDeleteAsync(ct);

    /// <summary>
    /// Account deletion (required by Play Store / App Store). Personal data is anonymised;
    /// order and invoice records are kept as required for GST compliance.
    /// </summary>
    public async Task DeleteAccountAsync(long userId, CancellationToken ct = default)
    {
        var u = await _db.Users.Include(x => x.PartnerProfile).ThenInclude(p => p!.Documents).FirstAsync(x => x.Id == userId, ct);
        if (u.UserType == UserType.Staff) throw new AppException("Staff accounts are managed by an administrator.");
        u.Name = "Deleted user";
        u.Email = null;
        u.Phone = null;
        u.IsActive = false;
        if (u.PartnerProfile != null)
        {
            u.PartnerProfile.AddressLine = null;
            u.PartnerProfile.Latitude = null;
            u.PartnerProfile.Longitude = null;
            _db.KycDocuments.RemoveRange(u.PartnerProfile.Documents);
        }
        await _db.Addresses.Where(a => a.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.CartItems.Where(a => a.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.DeviceTokens.Where(a => a.UserId == userId).ExecuteDeleteAsync(ct);
        await _db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), ct);
        await _db.SaveChangesAsync(ct);
    }
}
