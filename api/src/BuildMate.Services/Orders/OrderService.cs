using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using BuildMate.Services.Erp;
using BuildMate.Services.Notifications;
using BuildMate.Services.Partners;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Orders;

/// <summary>Order reads, payment settlement and invoices — shared by customers, partners and staff.</summary>
public interface IOrderService
{
    Task<PagedResult<OrderListDto>> ListAsync(OrderListQuery q, CancellationToken ct = default);
    Task<OrderDetailDto> GetAsync(long orderId, long? mustBelongToUserId, CancellationToken ct = default);
    Task<InvoiceDto> InvoiceAsync(long orderId, long? mustBelongToUserId, CancellationToken ct = default);

    /// <summary>Idempotently marks an order paid. Call inside a transaction after locking the order.</summary>
    Task MarkPaidAsync(Order order, Payment payment, decimal amount, string? reference, string? raw, CancellationToken ct);
    void AddEvent(Order order, string action, string? details);
    Task ReserveAsync(Order order, CancellationToken ct);
    Task ReleaseReservationAsync(Order order, CancellationToken ct);
    Task<OrderDetailDto> CancelByCustomerAsync(long orderId, long userId, CancellationToken ct = default);
}

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;
    private readonly INotificationService _notify;
    private readonly IOutbox _outbox;
    private readonly ISettingsService _settings;

    public OrderService(AppDbContext db, ICurrentUser me, INotificationService notify, IOutbox outbox, ISettingsService settings)
    {
        _db = db;
        _me = me;
        _notify = notify;
        _outbox = outbox;
        _settings = settings;
    }

    // ------------------------------------------------------------------ Queries

    public async Task<PagedResult<OrderListDto>> ListAsync(OrderListQuery q, CancellationToken ct = default)
    {
        var query = _db.Orders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = $"%{q.Search.Trim()}%";
            query = query.Where(o => EF.Functions.ILike(o.OrderNo, s) || EF.Functions.ILike(o.CustomerName, s)
                                     || EF.Functions.ILike(o.CustomerPhone ?? "", s)
                                     || (o.Dispatch != null && EF.Functions.ILike(o.Dispatch.InvoiceNo, s)));
        }
        if (q.Status != null) query = query.Where(o => o.Status == q.Status);
        if (q.Channel != null) query = query.Where(o => o.Channel == q.Channel);
        if (q.CustomerKind != null) query = query.Where(o => o.CustomerKind == q.CustomerKind);
        if (q.UserId != null) query = query.Where(o => o.UserId == q.UserId);
        if (q.FulfilmentType != null) query = query.Where(o => o.FulfilmentType == q.FulfilmentType);
        if (q.ProductId != null) query = query.Where(o => o.Items.Any(i => i.ProductId == q.ProductId));
        if (q.CategoryId != null) query = query.Where(o => o.Items.Any(i => i.Product.CategoryId == q.CategoryId));
        if (q.ManagerId != null) query = query.Where(o => o.User != null && o.User.PartnerProfile != null && o.User.PartnerProfile.ManagerId == q.ManagerId);
        if (q.From != null) { var f = Clock.IstDateStartUtc(q.From.Value.ToDateTime(TimeOnly.MinValue)); query = query.Where(o => o.CreatedAt >= f); }
        if (q.To != null) { var t = Clock.IstDateStartUtc(q.To.Value.ToDateTime(TimeOnly.MinValue).AddDays(1)); query = query.Where(o => o.CreatedAt < t); }

        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(o => o.Id).Page(page)
            .Select(o => new OrderListDto(o.Id, o.OrderNo, o.CreatedAt, o.Channel, o.CustomerKind, o.Status, o.PaymentStatus,
                o.FulfilmentType, o.ScheduledAt, o.CustomerName, o.CustomerPhone, o.Items.Count, o.GrandTotal,
                o.GrandTotal - o.AmountPaid, o.RewardPointsEarned, o.Dispatch != null ? o.Dispatch.InvoiceNo : null))
            .ToListAsync(ct);
        return new PagedResult<OrderListDto>(items, total, page.SafePage, page.SafeSize);
    }

    public async Task<OrderDetailDto> GetAsync(long orderId, long? mustBelongToUserId, CancellationToken ct = default)
    {
        var o = await _db.Orders.AsNoTracking()
            .Include(x => x.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Locations).ThenInclude(l => l.RackLocation)
            .Include(x => x.Events).Include(x => x.Payments).Include(x => x.Dispatch)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == orderId, ct) ?? throw new NotFoundException("Order");
        if (mustBelongToUserId != null && o.UserId != mustBelongToUserId) throw new NotFoundException("Order");
        var staffView = mustBelongToUserId == null;
        return ToDetail(o, staffView);
    }

    internal static bool Editable(Order o) => o.Dispatch == null && o.Status is OrderStatus.Paid or OrderStatus.Processing or OrderStatus.ReadyForPickup;

    internal static OrderDetailDto ToDetail(Order o, bool staffView)
    {
        var editable = Editable(o);
        return new OrderDetailDto(o.Id, o.OrderNo, o.CreatedAt, o.Channel, o.CustomerKind, o.Status, o.PaymentStatus, o.PaymentMethod, o.PaidAt,
            o.FulfilmentType, o.ScheduledAt, o.UserId, o.CustomerName, o.CustomerPhone, o.CustomerGstin,
            o.ShipLine1, o.ShipLine2, o.ShipCity, o.ShipState, o.ShipPincode,
            o.SubTotal, o.DiscountTotal, o.TaxTotal, o.ShippingFee, o.GrandTotal, o.AmountPaid, o.BalanceDue,
            o.RewardPointsEarned, o.RewardsCredited, o.CustomerNotes, staffView ? o.InternalNotes : null, o.CancelReason,
            editable, editable, o.Dispatch == null && o.Status is not (OrderStatus.Cancelled or OrderStatus.Completed),
            o.Items.OrderBy(i => i.Id).Select(i => new OrderItemDto(i.Id, i.ProductId, i.ProductCode, i.ProductName, i.HsnCode,
                i.Product?.ImageUrls.FirstOrDefault(), i.Quantity, i.ListPrice, i.DiscountPercent, i.SpecialDiscountPercent, i.UnitPrice,
                i.GstRate, i.TaxAmount, i.LineTotal, i.RewardPoints, i.AddedAtStore,
                staffView && i.Product != null ? i.Product.Locations.Select(l => l.RackLocation.Label).OrderBy(x => x).ToList() : new List<string>(), i.PurchaseUnit, i.PackSizeSnapshot, Packaging.PurchaseQuantity(i, i.Quantity), i.PackMrpSnapshot, i.BoxPriceSnapshot, i.BaseUnitSnapshot)).ToList(),
            staffView
                ? o.Events.OrderBy(e => e.Id).Select(e => new OrderEventDto(e.CreatedAt, e.Action, e.Details, e.UserName)).ToList()
                : o.Events.Where(e => CustomerVisibleEvents.Contains(e.Action)).OrderBy(e => e.Id).Select(e => new OrderEventDto(e.CreatedAt, e.Action, e.Details, null)).ToList(),
            o.Payments.OrderBy(p => p.Id).Select(p => new PaymentDto(p.Id, p.CreatedAt, p.Method, p.Status, p.Amount, p.GatewayReference)).ToList(),
            o.Dispatch == null ? null : new DispatchDto(o.Dispatch.DispatchNo, o.Dispatch.InvoiceNo, o.Dispatch.DispatchedAt,
                staffView ? o.Dispatch.DispatchedByName : null, o.Dispatch.VehicleNo, o.Dispatch.DeliveryPerson, o.Dispatch.Notes));
    }

    private static readonly HashSet<string> CustomerVisibleEvents = new()
    {
        OrderActions.Placed, OrderActions.Paid, OrderActions.Scheduled, OrderActions.StatusChanged,
        OrderActions.Dispatched, OrderActions.Delivered, OrderActions.Cancelled, OrderActions.Refunded
    };

    // ------------------------------------------------------------------ Payment settlement

    public async Task MarkPaidAsync(Order order, Payment payment, decimal amount, string? reference, string? raw, CancellationToken ct)
    {
        if (payment.Status == PaymentStatus.Success) return; // already settled (webhook + redirect race)

        payment.Status = PaymentStatus.Success;
        payment.GatewayReference = reference;
        payment.RawResponse = raw;
        order.AmountPaid += amount;

        if (order.Status is OrderStatus.PendingPayment or OrderStatus.PaymentFailed)
        {
            order.Status = OrderStatus.Paid;
            order.PaymentStatus = PaymentStatus.Success;
            order.PaidAt = DateTime.UtcNow;
            AddEvent(order, OrderActions.Paid, $"₹{amount:0.00} received via {payment.Method}");

            await ReserveAsync(order, ct);

            // Items are bought — remove them from the user's cart.
            if (order.UserId != null)
            {
                var productIds = order.Items.Select(i => i.ProductId).ToList();
                var cartRows = await _db.CartItems.Where(c => c.UserId == order.UserId && productIds.Contains(c.ProductId)).ToListAsync(ct);
                _db.CartItems.RemoveRange(cartRows.Where(c => order.Items.Any(i => i.ProductId == c.ProductId && i.PurchaseUnit == c.PurchaseUnit)));
                await _notify.NotifyAsync(order.UserId.Value, $"Order {order.OrderNo} confirmed",
                    order.FulfilmentType == FulfilmentType.StorePickup
                        ? "Payment received. We'll let you know when it's ready for pickup."
                        : "Payment received. We'll schedule your delivery shortly.",
                    $"order:{order.Id}", ct);
            }

            _outbox.Add(ErpEvents.OrderPaid, ErpPayload(order));
        }
        else if (order.Status == OrderStatus.Cancelled)
        {
            // Paid after cancellation (late payment) — flag for refund.
            AddEvent(order, OrderActions.Note, $"Payment of ₹{amount:0.00} received after cancellation — refund required.");
        }
    }

    /// <summary>Reserves stock for a paid order so it can't be sold twice.</summary>
    public async Task ReserveAsync(Order order, CancellationToken ct)
    {
        if (order.StockReserved) return;
        var products = (await _db.LockProductsAsync(order.Items.Select(i => i.ProductId), ct)).ToDictionary(p => p.Id);
        var shortages = new List<string>();
        foreach (var g in order.Items.GroupBy(i => i.ProductId))
        {
            var p = products[g.Key];
            var qty = g.Sum(i => i.Quantity);
            if (p.AvailableQty < qty) shortages.Add($"{p.Name} (need {qty:0.###}, available {Math.Max(0, p.AvailableQty):0.###})");
            p.ReservedQty += qty;
        }
        order.StockReserved = true;
        if (shortages.Count > 0)
            AddEvent(order, OrderActions.StockShort, "Stock short at payment: " + string.Join("; ", shortages));
    }

    public async Task ReleaseReservationAsync(Order order, CancellationToken ct)
    {
        if (!order.StockReserved) return;
        var products = (await _db.LockProductsAsync(order.Items.Select(i => i.ProductId), ct)).ToDictionary(p => p.Id);
        foreach (var g in order.Items.GroupBy(i => i.ProductId))
            products[g.Key].ReservedQty = Math.Max(0, products[g.Key].ReservedQty - g.Sum(i => i.Quantity));
        order.StockReserved = false;
    }

    public void AddEvent(Order order, string action, string? details) =>
        _db.OrderEvents.Add(new OrderEvent
        {
            Order = order, Action = action, Details = details,
            UserId = _me.Id, UserName = _me.UserType == UserType.Staff ? _me.Name : null
        });

    public async Task<OrderDetailDto> CancelByCustomerAsync(long orderId, long userId, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var order = await _db.LockOrderAsync(orderId, ct);
        if (order == null || order.UserId != userId) throw new NotFoundException("Order");
        if (order.Status is not (OrderStatus.PendingPayment or OrderStatus.PaymentFailed))
            throw new AppException("This order is already paid. Please call the store to cancel it.", 409, "not_cancellable");
        order.Status = OrderStatus.Cancelled;
        order.CancelledAt = DateTime.UtcNow;
        order.CancelReason = "Cancelled by customer before payment";
        AddEvent(order, OrderActions.Cancelled, order.CancelReason);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(orderId, userId, ct);
    }

    // ------------------------------------------------------------------ Invoice

    public async Task<InvoiceDto> InvoiceAsync(long orderId, long? mustBelongToUserId, CancellationToken ct = default)
    {
        var o = await _db.Orders.AsNoTracking().Include(x => x.Items).ThenInclude(i => i.Product).Include(x => x.Dispatch)
            .FirstOrDefaultAsync(x => x.Id == orderId, ct) ?? throw new NotFoundException("Order");
        if (mustBelongToUserId != null && o.UserId != mustBelongToUserId) throw new NotFoundException("Order");
        if (o.Dispatch == null) throw new AppException("The invoice is generated when the order is dispatched.", 409, "no_invoice");

        var s = await _settings.GetAsync(ct);
        // Store pickup: goods change hands at the store, so the place of supply is the store's state.
        var placeOfSupply = o.FulfilmentType == FulfilmentType.StorePickup || string.IsNullOrWhiteSpace(o.ShipState) ? s.State : o.ShipState!;
        var interState = !string.IsNullOrWhiteSpace(s.State) && !placeOfSupply.Equals(s.State, StringComparison.OrdinalIgnoreCase);

        var lines = new List<InvoiceLineDto>();
        var n = 0;
        InvoiceLineDto Line(string? code, string desc, string? hsn, decimal qty, string unit, decimal disc, decimal gst, decimal lineTotal, decimal tax)
        {
            var taxable = lineTotal - tax;
            var half = Pricing.Round(tax / 2);
            return new InvoiceLineDto(++n, code, desc, hsn, qty, unit.ToUpperInvariant(), qty == 0 ? 0 : Pricing.Round(taxable / qty), disc, taxable, gst,
                interState ? 0 : half, interState ? 0 : tax - half, interState ? tax : 0, lineTotal);
        }
        foreach (var i in o.Items.OrderBy(i => i.Id))
            lines.Add(Line(i.ProductCode, i.PurchaseUnit == "Box" ? $"{i.ProductName} ({i.PackSizeSnapshot:0.###} {i.BaseUnitSnapshot} per box)" : i.ProductName, i.HsnCode, Packaging.PurchaseQuantity(i, i.Quantity), i.PurchaseUnit == "Box" ? "box" : i.BaseUnitSnapshot ?? i.Product?.Unit ?? "pcs",
                i.DiscountPercent + i.SpecialDiscountPercent, i.GstRate, i.LineTotal, i.TaxAmount));
        if (o.ShippingFee > 0)
            lines.Add(Line(null, "Delivery charges", Pricing.DeliverySac, 1, "", 0, Pricing.DeliveryGstRate, o.ShippingFee, Pricing.InclusiveTax(o.ShippingFee, Pricing.DeliveryGstRate)));

        var summary = lines.GroupBy(l => l.GstRate).OrderBy(g => g.Key)
            .Select(g => new InvoiceTaxRowDto(g.Key, g.Sum(l => l.TaxableValue), g.Sum(l => l.Cgst), g.Sum(l => l.Sgst), g.Sum(l => l.Igst))).ToList();
        var buyerAddress = string.Join(", ", new[] { o.ShipLine1, o.ShipLine2, o.ShipCity, o.ShipPincode }.Where(x => !string.IsNullOrWhiteSpace(x)));
        var buyerState = string.IsNullOrWhiteSpace(o.ShipState) ? null : o.ShipState;
        var terms = (s.InvoiceTerms ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        var taxTotal = lines.Sum(l => l.Cgst + l.Sgst + l.Igst);

        return new InvoiceDto(o.Dispatch.InvoiceNo, o.Dispatch.DispatchedAt, o.Dispatch.DispatchedAt, o.OrderNo,
            o.AmountPaid >= o.GrandTotal ? "CASH MEMO" : "DEBIT MEMO",
            s.StoreName, s.InvoiceLogoUrl,
            new InvoicePartyDto(s.LegalName, string.Join(", ", new[] { s.AddressLine, s.City, s.State, s.Pincode }.Where(x => !string.IsNullOrWhiteSpace(x))),
                s.State, GstStates.CodeFor(s.State, s.Gstin), s.Gstin, s.Pan, s.SupportPhone),
            new InvoicePartyDto(o.CustomerName, string.IsNullOrEmpty(buyerAddress) ? null : buyerAddress, buyerState,
                GstStates.CodeFor(buyerState, o.CustomerGstin), o.CustomerGstin, null, o.CustomerPhone),
            new InvoiceBankDto(s.BankName, s.BankBranch, s.BankAccountNo, s.BankIfsc),
            placeOfSupply, GstStates.CodeFor(placeOfSupply), interState,
            lines, summary,
            o.Items.Sum(i => Packaging.PurchaseQuantity(i, i.Quantity)), lines.Sum(l => l.TaxableValue), lines.Sum(l => l.Cgst), lines.Sum(l => l.Sgst), lines.Sum(l => l.Igst), taxTotal,
            o.RoundOff, o.GrandTotal, AmountInWords.Words(o.GrandTotal), o.AmountPaid, Math.Max(0, o.GrandTotal - o.AmountPaid),
            terms, o.RewardPointsEarned);
    }

    internal static object ErpPayload(Order o) => new
    {
        o.Id, o.OrderNo, Channel = o.Channel.ToString(), CustomerKind = o.CustomerKind.ToString(), o.UserId,
        o.CustomerName, o.CustomerPhone, o.CustomerGstin, o.ShipState, o.SubTotal, o.DiscountTotal, o.TaxTotal,
        o.ShippingFee, o.RoundOff, o.GrandTotal, o.AmountPaid, InvoiceNo = o.Dispatch?.InvoiceNo, PaymentMethod = o.PaymentMethod.ToString(),
        Items = o.Items.Select(i => new { i.ProductCode, i.ProductName, i.HsnCode, i.Quantity, i.PurchaseUnit, i.PackSizeSnapshot, i.PackMrpSnapshot, i.BoxPriceSnapshot, i.BaseUnitSnapshot, i.ListPrice, i.DiscountPercent, i.SpecialDiscountPercent, i.UnitPrice, i.GstRate, i.TaxAmount, i.LineTotal })
    };
}

public static class OrderActions
{
    public const string Placed = "Order placed";
    public const string PaymentStarted = "Payment started";
    public const string Paid = "Payment received";
    public const string PaymentFailed = "Payment failed";
    public const string Scheduled = "Pickup / delivery scheduled";
    public const string StatusChanged = "Status updated";
    public const string ItemsEdited = "Items updated";
    public const string BalanceCollected = "Balance collected";
    public const string Dispatched = "Dispatched";
    public const string Delivered = "Delivered";
    public const string Cancelled = "Cancelled";
    public const string Refunded = "Refund initiated";
    public const string RewardsCredited = "Reward points credited";
    public const string StockShort = "Stock alert";
    public const string Note = "Note";
}

/// <summary>Indian-system amount in words for GST invoices (lakh / crore).</summary>
public static class AmountInWords
{
    private static readonly string[] Ones = { "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
    private static readonly string[] Tens = { "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };

    /// <summary>As printed on the store's invoices: "Sixteen Thousand Three Hundred Sixty Seven Only".</summary>
    public static string Words(decimal amount)
    {
        var rupees = (long)Math.Floor(Math.Abs(amount));
        var paise = (int)Math.Round((Math.Abs(amount) - rupees) * 100);
        var words = rupees == 0 ? "Zero" : Convert(rupees);
        return $"{words}{(paise > 0 ? $" and {Convert(paise)} Paise" : "")} Only";
    }

    public static string Rupees(decimal amount)
    {
        var rupees = (long)Math.Floor(Math.Abs(amount));
        var paise = (int)Math.Round((Math.Abs(amount) - rupees) * 100);
        var words = rupees == 0 ? "Zero" : Convert(rupees);
        return $"Rupees {words}{(paise > 0 ? $" and {Convert(paise)} Paise" : "")} Only";
    }

    private static string Convert(long n)
    {
        var parts = new List<string>();
        void Chunk(long value, string label) { if (value > 0) parts.Add($"{Small((int)value)} {label}"); }
        Chunk(n / 10000000, "Crore"); n %= 10000000;
        Chunk(n / 100000, "Lakh"); n %= 100000;
        Chunk(n / 1000, "Thousand"); n %= 1000;
        Chunk(n / 100, "Hundred"); n %= 100;
        if (n > 0) parts.Add(Small((int)n));
        return string.Join(" ", parts);
    }

    private static string Small(int n) => n < 20 ? Ones[n] : n < 100 ? $"{Tens[n / 10]} {Ones[n % 10]}".Trim() : $"{Convert(n)}";
}
