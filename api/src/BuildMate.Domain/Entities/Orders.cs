using BuildMate.Domain.Common;
using BuildMate.Domain.Enums;

namespace BuildMate.Domain.Entities;

/// <summary>Server-side cart so the same basket follows the user across web and app.</summary>
public class CartItem : BaseEntity
{
    public string PurchaseUnit { get; set; } = "Piece";
    public long UserId { get; set; }
    public AppUser User { get; set; } = default!;
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public decimal Quantity { get; set; }
}

public class Order : BaseEntity
{
    public string OrderNo { get; set; } = default!;
    /// <summary>Null for walk-in retail billing at the counter.</summary>
    public long? UserId { get; set; }
    public AppUser? User { get; set; }
    public SalesChannel Channel { get; set; }
    public CustomerKind CustomerKind { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.PendingPayment;

    public FulfilmentType FulfilmentType { get; set; } = FulfilmentType.StorePickup;
    public DateTime? ScheduledAt { get; set; }

    // Customer snapshot (kept even if the user record changes later)
    public string CustomerName { get; set; } = "";
    public string? CustomerPhone { get; set; }
    public string? CustomerGstin { get; set; }
    public string? ShipLine1 { get; set; }
    public string? ShipLine2 { get; set; }
    public string? ShipCity { get; set; }
    public string? ShipState { get; set; }
    public string? ShipPincode { get; set; }

    // Money — all amounts GST inclusive, in INR
    public decimal SubTotal { get; set; }        // sum of list price x qty
    public decimal DiscountTotal { get; set; }   // regular + special discounts
    public decimal TaxTotal { get; set; }        // GST portion contained in NetTotal
    public decimal ShippingFee { get; set; }
    /// <summary>Rounding to the nearest rupee (−0.49 … +0.50), so cart, payment and invoice all show one whole-rupee total.</summary>
    public decimal RoundOff { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal AmountPaid { get; set; }
    /// <summary>Positive = collect at counter; negative = refund due (after edits at dispatch).</summary>
    public decimal BalanceDue => GrandTotal - AmountPaid;

    public decimal RewardPointsEarned { get; set; }
    public bool RewardsCredited { get; set; }

    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cashfree;
    public DateTime? PaidAt { get; set; }
    /// <summary>Stock is reserved once the order is paid and released at dispatch / cancel.</summary>
    public bool StockReserved { get; set; }

    public string? CustomerNotes { get; set; }
    public string? InternalNotes { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<OrderEvent> Events { get; set; } = new List<OrderEvent>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public Dispatch? Dispatch { get; set; }
}

public class OrderItem : BaseEntity, IPackageSnapshot
{
    public string PurchaseUnit { get; set; } = "Piece";
    public decimal? PackSizeSnapshot { get; set; }
    public decimal? PackMrpSnapshot { get; set; }
    public decimal? BoxPriceSnapshot { get; set; }
    public string? BaseUnitSnapshot { get; set; }

    public long OrderId { get; set; }
    public Order Order { get; set; } = default!;
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public string ProductCode { get; set; } = default!;
    public string ProductName { get; set; } = default!;
    public string? HsnCode { get; set; }
    public decimal Quantity { get; set; }
    public decimal ListPrice { get; set; }
    public decimal DiscountPercent { get; set; }
    /// <summary>Extra discount a store manager applied (on top of regular discount).</summary>
    public decimal SpecialDiscountPercent { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal GstRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal LineTotal { get; set; }
    public decimal RewardPoints { get; set; }
    /// <summary>True if added by staff at the counter (not in the original cart).</summary>
    public bool AddedAtStore { get; set; }
}

/// <summary>Audit trail for every change to an order: who, what, when.</summary>
public class OrderEvent : BaseEntity
{
    public long OrderId { get; set; }
    public Order Order { get; set; } = default!;
    public string Action { get; set; } = default!;
    public string? Details { get; set; }
    public long? UserId { get; set; }
    public string? UserName { get; set; }
}

public class Payment : BaseEntity
{
    public long OrderId { get; set; }
    public Order Order { get; set; } = default!;
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; }
    public decimal Amount { get; set; }
    /// <summary>Our id sent to Cashfree (unique per attempt).</summary>
    public string? GatewayOrderId { get; set; }
    public string? GatewayReference { get; set; }
    public string? PaymentSessionId { get; set; }
    public string? RawResponse { get; set; }
    public long? CollectedById { get; set; }
}

public class Dispatch : BaseEntity
{
    public long OrderId { get; set; }
    public Order Order { get; set; } = default!;
    public string DispatchNo { get; set; } = default!;
    public string InvoiceNo { get; set; } = default!;
    public DateTime DispatchedAt { get; set; } = DateTime.UtcNow;
    public long DispatchedById { get; set; }
    public string? DispatchedByName { get; set; }
    public string? VehicleNo { get; set; }
    public string? DeliveryPerson { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// A customer's request for the store's best price on a basket (usually a site order). Staff price it with an extra
/// discount per line; when the customer accepts, it becomes a normal order and is paid through Cashfree.
/// The basket and the customer's details are snapshotted so later catalogue changes don't alter the quote.
/// </summary>
public class Quotation : BaseEntity
{
    public string QuoteNo { get; set; } = default!;
    public long UserId { get; set; }
    public AppUser User { get; set; } = default!;
    public CustomerKind CustomerKind { get; set; }
    public SalesChannel Channel { get; set; }
    public QuotationStatus Status { get; set; } = QuotationStatus.Requested;

    public FulfilmentType FulfilmentType { get; set; } = FulfilmentType.StorePickup;
    /// <summary>Delivery address chosen when requesting (copied into the order on acceptance).</summary>
    public long? AddressId { get; set; }
    public DateTime? PreferredAt { get; set; }
    public string? CustomerNotes { get; set; }

    // Snapshot of who asked
    public string CustomerName { get; set; } = "";
    public string? CustomerPhone { get; set; }

    // Money — GST inclusive, recomputed whenever lines change
    public decimal SubTotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal ShippingFee { get; set; }
    public decimal RoundOff { get; set; }
    public decimal GrandTotal { get; set; }

    /// <summary>Message from the store shown with the price (terms, delivery date, etc.).</summary>
    public string? StoreMessage { get; set; }
    public DateTime? QuotedAt { get; set; }
    public long? QuotedById { get; set; }
    public string? QuotedByName { get; set; }
    /// <summary>The quoted prices hold until this time (UTC); after that the customer must ask again.</summary>
    public DateTime? ValidUntil { get; set; }
    public DateTime? RespondedAt { get; set; }
    public string? CancelReason { get; set; }
    /// <summary>The order created when the customer accepted.</summary>
    public long? OrderId { get; set; }
    public Order? Order { get; set; }

    public ICollection<QuotationItem> Items { get; set; } = new List<QuotationItem>();
}

public class QuotationItem : BaseEntity, IPackageSnapshot
{
    public string PurchaseUnit { get; set; } = "Piece";
    public decimal? PackSizeSnapshot { get; set; }
    public decimal? PackMrpSnapshot { get; set; }
    public decimal? BoxPriceSnapshot { get; set; }
    public string? BaseUnitSnapshot { get; set; }

    public long QuotationId { get; set; }
    public Quotation Quotation { get; set; } = default!;
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public string ProductCode { get; set; } = default!;
    public string ProductName { get; set; } = default!;
    public decimal Quantity { get; set; }
    public decimal ListPrice { get; set; }
    /// <summary>The customer's regular discount (partner or retail) at the time of the request.</summary>
    public decimal DiscountPercent { get; set; }
    /// <summary>Extra discount the store gives in the quote.</summary>
    public decimal SpecialDiscountPercent { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public decimal GstRate { get; set; }
    public decimal RewardPoints { get; set; }
}
