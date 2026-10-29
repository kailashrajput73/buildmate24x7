using BuildMate.Domain.Common;
using BuildMate.Domain.Enums;

namespace BuildMate.Domain.Entities;

/// <summary>A physical rack with a grid of locations (rows x columns).</summary>
public class Rack : AuditableEntity
{
    /// <summary>Short code used as the location prefix, e.g. "A".</summary>
    public string Code { get; set; } = default!;
    public string? Name { get; set; }
    public int Rows { get; set; }
    public int Columns { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<RackLocation> Locations { get; set; } = new List<RackLocation>();
}

public class RackLocation : BaseEntity
{
    public long RackId { get; set; }
    public Rack Rack { get; set; } = default!;
    /// <summary>e.g. A1, A2, B5 — row letter/number plus column.</summary>
    public string Label { get; set; } = default!;
    public int RowNo { get; set; }
    public int ColumnNo { get; set; }
    public ICollection<ProductLocation> Products { get; set; } = new List<ProductLocation>();
}

/// <summary>Which rack location(s) hold a product and roughly how much.</summary>
public class ProductLocation : BaseEntity
{
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public long RackLocationId { get; set; }
    public RackLocation RackLocation { get; set; } = default!;
    public decimal Quantity { get; set; }
}

public class Purchase : AuditableEntity
{
    public string PurchaseNo { get; set; } = default!;
    public string? SupplierName { get; set; }
    public string? SupplierGstin { get; set; }
    public string? SupplierInvoiceNo { get; set; }
    public DateOnly PurchaseDate { get; set; }
    public decimal TotalAmount { get; set; }
    public string? Notes { get; set; }
    public ICollection<PurchaseItem> Items { get; set; } = new List<PurchaseItem>();
}

public class PurchaseItem : BaseEntity
{
    public long PurchaseId { get; set; }
    public Purchase Purchase { get; set; } = default!;
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public decimal Quantity { get; set; }
    /// <summary>Supplier list price per unit.</summary>
    public decimal ListPrice { get; set; }
    public decimal PurchaseDiscountPercent { get; set; }
    /// <summary>ListPrice less purchase discount.</summary>
    public decimal NetRate { get; set; }
    public decimal LineTotal { get; set; }
    public long? RackLocationId { get; set; }
    public RackLocation? RackLocation { get; set; }
}

/// <summary>Immutable stock ledger. Every change to Product.StockQty writes one row.</summary>
public class StockMovement : BaseEntity
{
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public StockMovementType Type { get; set; }
    /// <summary>Signed quantity: positive = in, negative = out.</summary>
    public decimal Quantity { get; set; }
    public decimal BalanceAfter { get; set; }
    public decimal UnitCost { get; set; }
    public string? ReferenceType { get; set; }
    public long? ReferenceId { get; set; }
    public string? ReferenceNo { get; set; }
    public string? Note { get; set; }
    public long? UserId { get; set; }
}
