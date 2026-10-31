using BuildMate.Domain.Enums;

namespace BuildMate.Services.Orders;

// ---------------------------------------------------------------- Cart

public record CartLineDto(long ProductId, string Code, string Name, string BrandName, string Unit, string? ImageUrl,
    decimal Quantity, decimal ListPrice, decimal DiscountPercent, decimal UnitPrice, decimal LineTotal, decimal Mrp,
    decimal AvailableQty, decimal? RewardPoints, string? Issue, string PurchaseUnit = "Piece", decimal? PackSize = null, decimal BaseQuantity = 0);

public record CartDto(List<CartLineDto> Items, int ItemCount, decimal SubTotal, decimal DiscountTotal, decimal Total,
    decimal RewardPoints, decimal DeliveryFee, decimal FreeDeliveryAbove, decimal MinOrderValue,
    bool CanCheckout, List<string> Issues, bool StorePickupEnabled, bool HomeDeliveryEnabled,
    // Total + delivery, rounded to the rupee — exactly what checkout charges.
    decimal RoundOff = 0, decimal Payable = 0);

public record CartUpdate(long ProductId, decimal Quantity, string PurchaseUnit = "Piece");

// ---------------------------------------------------------------- Checkout

public record CheckoutRequest(FulfilmentType FulfilmentType, long? AddressId, DateTime? PreferredAt, string? Notes, string? ReturnUrl);

public record CheckoutResult(long OrderId, string OrderNo, decimal Amount, string GatewayOrderId, string PaymentSessionId, string Environment);

public record PaymentConfirmResult(long OrderId, string OrderNo, OrderStatus Status, PaymentStatus PaymentStatus, string Message);

// ---------------------------------------------------------------- Orders

public record OrderListQuery(string? Search, OrderStatus? Status, SalesChannel? Channel, CustomerKind? CustomerKind,
    long? UserId, long? ProductId, long? CategoryId, long? ManagerId, FulfilmentType? FulfilmentType,
    DateOnly? From, DateOnly? To, int Page = 1, int PageSize = 25);

public record OrderListDto(long Id, string OrderNo, DateTime CreatedAt, SalesChannel Channel, CustomerKind CustomerKind,
    OrderStatus Status, PaymentStatus PaymentStatus, FulfilmentType FulfilmentType, DateTime? ScheduledAt,
    string CustomerName, string? CustomerPhone, int ItemCount, decimal GrandTotal, decimal BalanceDue, decimal RewardPointsEarned,
    string? InvoiceNo);

public record OrderItemDto(long Id, long ProductId, string ProductCode, string ProductName, string? HsnCode, string? ImageUrl,
    decimal Quantity, decimal ListPrice, decimal DiscountPercent, decimal SpecialDiscountPercent, decimal UnitPrice,
    decimal GstRate, decimal TaxAmount, decimal LineTotal, decimal RewardPoints, bool AddedAtStore, List<string> RackLocations, string PurchaseUnit = "Piece", decimal? PackSize = null, decimal PurchaseQuantity = 0, decimal? PackMrp = null, decimal? BoxPrice = null, string? BaseUnit = null);

public record OrderEventDto(DateTime At, string Action, string? Details, string? By);

public record PaymentDto(long Id, DateTime At, PaymentMethod Method, PaymentStatus Status, decimal Amount, string? Reference);

public record DispatchDto(string DispatchNo, string InvoiceNo, DateTime DispatchedAt, string? DispatchedBy, string? VehicleNo, string? DeliveryPerson, string? Notes);

public record OrderDetailDto(long Id, string OrderNo, DateTime CreatedAt, SalesChannel Channel, CustomerKind CustomerKind,
    OrderStatus Status, PaymentStatus PaymentStatus, PaymentMethod PaymentMethod, DateTime? PaidAt,
    FulfilmentType FulfilmentType, DateTime? ScheduledAt,
    long? UserId, string CustomerName, string? CustomerPhone, string? CustomerGstin,
    string? ShipLine1, string? ShipLine2, string? ShipCity, string? ShipState, string? ShipPincode,
    decimal SubTotal, decimal DiscountTotal, decimal TaxTotal, decimal ShippingFee, decimal GrandTotal,
    decimal AmountPaid, decimal BalanceDue, decimal RewardPointsEarned, bool RewardsCredited,
    string? CustomerNotes, string? InternalNotes, string? CancelReason, bool CanEdit, bool CanDispatch, bool CanCancel,
    List<OrderItemDto> Items, List<OrderEventDto> Events, List<PaymentDto> Payments, DispatchDto? Dispatch);

// ---------------------------------------------------------------- Admin actions

public record OrderScheduleUpdate(FulfilmentType FulfilmentType, DateTime? ScheduledAt, string? Note);
public record OrderStatusUpdate(OrderStatus Status, string? Note);

/// <summary>Full replacement of order lines (used by the store manager before dispatch).</summary>
public record OrderLineEdit(long ProductId, decimal Quantity, decimal SpecialDiscountPercent, string PurchaseUnit = "Piece");
public record OrderEditRequest(List<OrderLineEdit> Lines, decimal? ShippingFee, string? Note);

public record CancelRequest(string Reason, bool RefundOnline);

public record DispatchRequest(string? VehicleNo, string? DeliveryPerson, string? Notes,
    PaymentMethod? BalanceCollectedVia, string? BalanceReference);

public record CounterLine(long ProductId, decimal Quantity, decimal SpecialDiscountPercent);
public record CounterSaleRequest(string? CustomerName, string? CustomerPhone, string? CustomerGstin, long? PartnerUserId,
    List<CounterLine> Lines, PaymentMethod PaymentMethod, string? PaymentReference, string? Notes);

// ---------------------------------------------------------------- Invoice

/// <summary>One invoice row. Rate is per unit before GST (after any discount), so Rate × Qty ≈ Taxable, as on the store's own invoices.</summary>
public record InvoiceLineDto(int No, string? Code, string Description, string? HsnCode, decimal Quantity, string Unit,
    decimal Rate, decimal DiscountPercent, decimal TaxableValue, decimal GstRate, decimal Cgst, decimal Sgst, decimal Igst, decimal Total);

public record InvoicePartyDto(string Name, string? Address, string? State, string? StateCode, string? Gstin, string? Pan, string? Phone);
public record InvoiceBankDto(string? BankName, string? Branch, string? AccountNo, string? Ifsc);
public record InvoiceTaxRowDto(decimal GstRate, decimal TaxableValue, decimal Cgst, decimal Sgst, decimal Igst);

/// <summary>Tax invoice in the layout of the store's own invoices (SES/25-26/068).</summary>
public record InvoiceDto(
    string InvoiceNo, DateTime InvoiceDate, DateTime DateOfSupply, string OrderNo,
    // MemoType: "CASH MEMO" when fully paid, "DEBIT MEMO" when a balance is due.
    string MemoType,
    string StoreName, string? LogoUrl, InvoicePartyDto Seller, InvoicePartyDto Buyer, InvoiceBankDto Bank,
    string PlaceOfSupply, string? PlaceOfSupplyCode, bool InterState,
    List<InvoiceLineDto> Lines, List<InvoiceTaxRowDto> TaxSummary,
    decimal TotalQuantity, decimal TaxableTotal, decimal CgstTotal, decimal SgstTotal, decimal IgstTotal, decimal TotalTax,
    decimal RoundOff, decimal GrandTotal, string AmountInWords, decimal AmountPaid, decimal BalanceDue,
    List<string> Terms, decimal RewardPointsEarned);
