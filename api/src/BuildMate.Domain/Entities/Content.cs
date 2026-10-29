using BuildMate.Domain.Common;
using BuildMate.Domain.Enums;

namespace BuildMate.Domain.Entities;

/// <summary>Home-page banners shown on the storefront and/or the partner app.</summary>
public class Banner : AuditableEntity
{
    public string Title { get; set; } = default!;
    public string? Subtitle { get; set; }
    public string ImageUrl { get; set; } = default!;
    public string? MobileImageUrl { get; set; }
    public BannerLinkType LinkType { get; set; }
    public string? LinkValue { get; set; }
    public ContentPlacement Placement { get; set; } = ContentPlacement.Both;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}

/// <summary>Product rails on the home screen ("Bestselling pipes", "Top brands").</summary>
public class HomeSection : AuditableEntity
{
    public string Title { get; set; } = default!;
    public HomeSectionType Type { get; set; }
    /// <summary>Id of the group / category / brand, depending on Type.</summary>
    public long? ReferenceId { get; set; }
    public int MaxItems { get; set; } = 12;
    public ContentPlacement Placement { get; set; } = ContentPlacement.Both;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Key/value settings editable from the admin (store info, fees, reward rules).</summary>
public class AppSetting
{
    public string Key { get; set; } = default!;
    public string Value { get; set; } = default!;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ServiceRequest : BaseEntity
{
    public string RequestNo { get; set; } = default!;
    public long UserId { get; set; }
    public AppUser User { get; set; } = default!;
    public ServiceType ServiceType { get; set; }
    public string Description { get; set; } = default!;
    public string ContactName { get; set; } = default!;
    public string ContactPhone { get; set; } = default!;
    public string? Address { get; set; }
    public string? Pincode { get; set; }
    public DateTime? PreferredAt { get; set; }
    public ServiceRequestStatus Status { get; set; } = ServiceRequestStatus.Pending;
    /// <summary>Referral partner the request was handed to, if any.</summary>
    public long? AssignedPartnerId { get; set; }
    public AppUser? AssignedPartner { get; set; }
    public string? AdminNotes { get; set; }
    public ICollection<ServiceRequestEvent> Events { get; set; } = new List<ServiceRequestEvent>();
}

public class ServiceRequestEvent : BaseEntity
{
    public long ServiceRequestId { get; set; }
    public ServiceRequest ServiceRequest { get; set; } = default!;
    public ServiceRequestStatus Status { get; set; }
    public string? Note { get; set; }
    public long? UserId { get; set; }
    public string? UserName { get; set; }
}

/// <summary>Transactional outbox for ERP sync. Written in the same DB transaction as the business change.</summary>
public class OutboxMessage : BaseEntity
{
    public string EventType { get; set; } = default!;
    public string Payload { get; set; } = default!;
    public OutboxStatus Status { get; set; } = OutboxStatus.Pending;
    public int Attempts { get; set; }
    public DateTime? NextAttemptAt { get; set; }
    public string? LastError { get; set; }
    public DateTime? ProcessedAt { get; set; }
}
