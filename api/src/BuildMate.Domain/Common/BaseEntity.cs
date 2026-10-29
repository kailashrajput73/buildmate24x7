namespace BuildMate.Domain.Common;

/// <summary>Base class for all persisted entities.</summary>
public abstract class BaseEntity
{
    public long Id { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Entities that track which staff user created / last changed them.</summary>
public abstract class AuditableEntity : BaseEntity
{
    public long? CreatedById { get; set; }
    public long? UpdatedById { get; set; }
}
