using BuildMate.Domain.Common;
using BuildMate.Domain.Enums;

namespace BuildMate.Domain.Entities;

public class AppUser : BaseEntity
{
    public UserType UserType { get; set; }
    /// <summary>10-digit Indian mobile number (no +91). Unique per user type.</summary>
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Staff only — partners and customers log in with OTP.</summary>
    public string? PasswordHash { get; set; }
    public long? RoleId { get; set; }
    public Role? Role { get; set; }
    public string PreferredLanguage { get; set; } = "en";
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }

    public PartnerProfile? PartnerProfile { get; set; }
    public ICollection<Address> Addresses { get; set; } = new List<Address>();
}

public class Role : BaseEntity
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    /// <summary>Permission keys, see Permissions class. "*" = everything.</summary>
    public List<string> Permissions { get; set; } = new();
    public bool IsSystem { get; set; }
    public ICollection<AppUser> Users { get; set; } = new List<AppUser>();
}

public class PartnerProfile : BaseEntity
{
    public long UserId { get; set; }
    public AppUser User { get; set; } = default!;
    public PartnerType PartnerType { get; set; }
    public string? BusinessName { get; set; }
    public string? AddressLine { get; set; }
    public string? Area { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Pincode { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? Gstin { get; set; }

    public KycStatus KycStatus { get; set; } = KycStatus.NotSubmitted;
    public DateTime? KycSubmittedAt { get; set; }
    public long? KycReviewedById { get; set; }
    public AppUser? KycReviewedBy { get; set; }
    public DateTime? KycReviewedAt { get; set; }
    public string? KycRemarks { get; set; }
    public bool LocationVerified { get; set; }

    /// <summary>Sales manager responsible for this partner.</summary>
    public long? ManagerId { get; set; }
    public AppUser? Manager { get; set; }
    /// <summary>True when an admin created the partner directly (no self-registration).</summary>
    public bool CreatedByAdmin { get; set; }

    public decimal RewardBalance { get; set; }
    public ICollection<KycDocument> Documents { get; set; } = new List<KycDocument>();
}

public class KycDocument : BaseEntity
{
    public long PartnerProfileId { get; set; }
    public PartnerProfile PartnerProfile { get; set; } = default!;
    public KycDocumentType DocumentType { get; set; }
    /// <summary>Stored masked (e.g. XXXX-XXXX-1234) — never the full Aadhaar number.</summary>
    public string? DocumentNumberMasked { get; set; }
    public string FileKey { get; set; } = default!;
}

public class Address : BaseEntity
{
    public long UserId { get; set; }
    public AppUser User { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Phone { get; set; } = default!;
    public string Line1 { get; set; } = default!;
    public string? Line2 { get; set; }
    public string? Landmark { get; set; }
    public string City { get; set; } = default!;
    public string State { get; set; } = default!;
    public string Pincode { get; set; } = default!;
    public bool IsDefault { get; set; }
}

public class OtpCode : BaseEntity
{
    public string Phone { get; set; } = default!;
    public string CodeHash { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public bool Consumed { get; set; }
}

public class RefreshToken : BaseEntity
{
    public long UserId { get; set; }
    public AppUser User { get; set; } = default!;
    public string TokenHash { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public class RewardTransaction : BaseEntity
{
    public long PartnerUserId { get; set; }
    public AppUser PartnerUser { get; set; } = default!;
    public RewardTransactionType Type { get; set; }
    public decimal Points { get; set; }
    public decimal BalanceAfter { get; set; }
    public long? OrderId { get; set; }
    public string? Note { get; set; }
    public long? CreatedById { get; set; }
}

public class DeviceToken : BaseEntity
{
    public long UserId { get; set; }
    public string Token { get; set; } = default!;
    public DevicePlatform Platform { get; set; }
}

public class Notification : BaseEntity
{
    public long UserId { get; set; }
    public string Title { get; set; } = default!;
    public string Body { get; set; } = default!;
    /// <summary>Deep-link hint, e.g. "order:123".</summary>
    public string? Link { get; set; }
    public bool IsRead { get; set; }
}
