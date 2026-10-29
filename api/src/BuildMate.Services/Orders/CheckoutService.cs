using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using BuildMate.Services.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BuildMate.Services.Orders;

public interface ICheckoutService
{
    Task<CheckoutResult> CheckoutAsync(long userId, CheckoutRequest req, Viewer v, CancellationToken ct = default);
    /// <summary>Starts a new payment attempt for an unpaid order (e.g. after the user closed the payment page).</summary>
    Task<CheckoutResult> RetryPaymentAsync(long userId, long orderId, string? returnUrl, CancellationToken ct = default);
    /// <summary>The customer accepts a priced quotation: it becomes an order at the quoted prices and payment starts.</summary>
    Task<CheckoutResult> AcceptQuotationAsync(long userId, long quotationId, string? returnUrl, CancellationToken ct = default);
    /// <summary>Called by the client after returning from Cashfree. Verifies with Cashfree server-to-server.</summary>
    Task<PaymentConfirmResult> ConfirmAsync(long userId, long orderId, CancellationToken ct = default);
    /// <summary>Cashfree webhook. Signature-verified, then re-checked against the Cashfree API.</summary>
    Task HandleWebhookAsync(string rawBody, string? signature, string? timestamp, CancellationToken ct = default);
}

public class CheckoutService : ICheckoutService
{
    private readonly AppDbContext _db;
    private readonly ICartService _cart;
    private readonly IOrderService _orders;
    private readonly IPaymentGateway _gateway;
    private readonly ISettingsService _settings;
    private readonly CashfreeOptions _cf;
    private readonly ILogger<CheckoutService> _log;

    public CheckoutService(AppDbContext db, ICartService cart, IOrderService orders, IPaymentGateway gateway,
        ISettingsService settings, IOptions<CashfreeOptions> cf, ILogger<CheckoutService> log)
    {
        _db = db;
        _cart = cart;
        _orders = orders;
        _gateway = gateway;
        _settings = settings;
        _cf = cf.Value;
        _log = log;
    }

    public async Task<CheckoutResult> CheckoutAsync(long userId, CheckoutRequest req, Viewer v, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        if (req.FulfilmentType == FulfilmentType.HomeDelivery && !settings.HomeDeliveryEnabled) throw new AppException("Home delivery is not available right now.");
        if (req.FulfilmentType == FulfilmentType.StorePickup && !settings.StorePickupEnabled) throw new AppException("Store pickup is not available right now.");

        var cart = await _cart.GetAsync(userId, v, req.FulfilmentType, ct);
        if (cart.Items.Count == 0) throw new AppException("Your cart is empty.");
        if (!cart.CanCheckout) throw new AppException(string.Join(" ", cart.Issues), 409, "cart_invalid");

        var user = await _db.Users.Include(u => u.PartnerProfile).FirstAsync(u => u.Id == userId, ct);
        Address? address = null;
        if (req.FulfilmentType == FulfilmentType.HomeDelivery)
        {
            if (req.AddressId == null) throw new AppException("Choose a delivery address.");
            address = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == req.AddressId && a.UserId == userId, ct) ?? throw new NotFoundException("Address");
            if (settings.DeliveryPincodes.Count > 0 && !settings.DeliveryPincodes.Contains(address.Pincode))
                throw new AppException($"Sorry, we don't deliver to {address.Pincode} yet. Choose store pickup instead.", 409, "pincode_unserviceable");
        }
        if (req.PreferredAt != null && req.PreferredAt < DateTime.UtcNow.AddMinutes(-5)) throw new AppException("Preferred time must be in the future.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        await _db.LockUserAsync(userId, ct);
        var products = (await _db.LockProductsAsync(cart.Items.Select(i => i.ProductId), ct)).ToDictionary(p => p.Id);

        var order = new Order
        {
            OrderNo = await NewOrderNoAsync(ct),
            UserId = userId,
            Channel = v.Channel == ClientChannel.App ? SalesChannel.App : SalesChannel.Web,
            CustomerKind = v.Kind,
            Status = OrderStatus.PendingPayment,
            FulfilmentType = req.FulfilmentType,
            ScheduledAt = req.PreferredAt,
            CustomerName = string.IsNullOrWhiteSpace(user.Name) ? (address?.Name ?? "Customer") : user.Name,
            CustomerPhone = user.Phone,
            CustomerGstin = user.PartnerProfile?.Gstin,
            ShipLine1 = address?.Line1, ShipLine2 = address?.Line2, ShipCity = address?.City,
            ShipState = address?.State ?? user.PartnerProfile?.State, ShipPincode = address?.Pincode,
            CustomerNotes = req.Notes?.Trim(),
            PaymentMethod = PaymentMethod.Cashfree
        };

        foreach (var line in cart.Items)
        {
            var p = products[line.ProductId];
            if (p.AvailableQty < line.Quantity)
                throw new AppException($"Only {Math.Max(0, p.AvailableQty):0.###} of {p.Name} left. Please update your cart.", 409, "insufficient_stock");
            order.Items.Add(new OrderItem
            {
                ProductId = p.Id, ProductCode = p.Code, ProductName = p.Name, HsnCode = p.HsnCode,
                Quantity = line.Quantity, ListPrice = p.ListPrice, DiscountPercent = Pricing.DiscountFor(p, v.Kind),
                GstRate = p.GstRate,
                RewardPoints = v.Kind == CustomerKind.Partner ? Pricing.Round(p.RewardPointsPerUnit * line.Quantity) : 0
            });
        }
        order.ShippingFee = _cart.DeliveryFee(settings, req.FulfilmentType, order.Items.Sum(i => Pricing.UnitPrice(i.ListPrice, i.DiscountPercent) * i.Quantity));
        Pricing.Recalculate(order);

        // Guard against the price changing between cart view and checkout.
        if (Math.Abs(order.GrandTotal - Pricing.RoundRupee(Pricing.Round(cart.Total + order.ShippingFee))) > 0.01m)
            throw new AppException("Prices changed while you were checking out. Please review your cart.", 409, "price_changed");

        // Same cart submitted again within a few minutes (double tap, refresh, back button): reuse that order.
        var match = await FindRecentDuplicateAsync(userId, order, ct);
        var duplicate = match == null ? null : await _db.LockOrderAsync(match.Id, ct);
        if (duplicate?.Status != OrderStatus.PendingPayment) duplicate = null;
        if (duplicate != null)
        {
            _log.LogInformation("Checkout for user {UserId} matched pending order {OrderNo}; reusing it", userId, duplicate.OrderNo);
            var resumed = await ResumePaymentAsync(duplicate, user, req.ReturnUrl, ct);
            await tx.CommitAsync(ct);
            return resumed ?? throw new AppException($"Order {duplicate.OrderNo} for these items is already paid.", 409, "already_paid");
        }

        _db.Orders.Add(order);
        _orders.AddEvent(order, OrderActions.Placed, $"{order.Items.Count} item(s), ₹{order.GrandTotal:0.00}, {order.FulfilmentType}");
        await _db.SaveChangesAsync(ct);

        var result = await StartPaymentAsync(order, user, req.ReturnUrl, ct);
        await tx.CommitAsync(ct);
        return result;
    }

    public async Task<CheckoutResult> AcceptQuotationAsync(long userId, long quotationId, string? returnUrl, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        await _db.LockUserAsync(userId, ct);
        var q = await _db.LockQuotationAsync(quotationId, ct);
        if (q == null || q.UserId != userId) throw new NotFoundException("Quotation");
        var user = await _db.Users.Include(u => u.PartnerProfile).FirstAsync(u => u.Id == userId, ct);

        // Accepted already (double tap, or coming back to pay): continue with that order.
        if (q.Status == QuotationStatus.Accepted && q.OrderId != null)
        {
            var existing = await _db.LockOrderAsync(q.OrderId.Value, ct) ?? throw new NotFoundException("Order");
            if (existing.Status is not (OrderStatus.PendingPayment or OrderStatus.PaymentFailed))
                throw new AppException($"Order {existing.OrderNo} for this quotation is already paid.", 409, "already_paid");
            var resumed = await ResumePaymentAsync(existing, user, returnUrl, ct);
            await tx.CommitAsync(ct);
            return resumed ?? throw new AppException($"Order {existing.OrderNo} for this quotation is already paid.", 409, "already_paid");
        }
        var status = QuotationService.EffectiveStatus(q, DateTime.UtcNow);
        if (status == QuotationStatus.Requested) throw new AppException("The store hasn't priced this quotation yet.", 409, "quote_not_ready");
        if (status == QuotationStatus.Expired) throw new AppException("This price has expired. Ask the store to send a fresh quotation.", 409, "quote_expired");
        if (status != QuotationStatus.Quoted) throw new AppException("This quotation is closed.", 409, "quote_closed");
        if (q.CustomerKind == CustomerKind.Partner && user.PartnerProfile?.KycStatus != KycStatus.Approved)
            throw new AppException("Your account is awaiting KYC approval. You can order once approved.", 409, "kyc_pending");

        Address? address = null;
        if (q.FulfilmentType == FulfilmentType.HomeDelivery)
            address = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == q.AddressId && a.UserId == userId, ct)
                      ?? throw new AppException("The delivery address on this quotation was removed. Ask the store for a new quotation.", 409, "address_missing");

        var products = (await _db.LockProductsAsync(q.Items.Select(i => i.ProductId), ct)).ToDictionary(p => p.Id);
        var order = new Order
        {
            OrderNo = await NewOrderNoAsync(ct),
            UserId = userId,
            Channel = q.Channel,
            CustomerKind = q.CustomerKind,
            Status = OrderStatus.PendingPayment,
            FulfilmentType = q.FulfilmentType,
            ScheduledAt = q.PreferredAt is { } at && at > DateTime.UtcNow ? at : null,
            CustomerName = string.IsNullOrWhiteSpace(user.Name) ? q.CustomerName : user.Name,
            CustomerPhone = user.Phone,
            CustomerGstin = user.PartnerProfile?.Gstin,
            ShipLine1 = address?.Line1, ShipLine2 = address?.Line2, ShipCity = address?.City,
            ShipState = address?.State ?? user.PartnerProfile?.State, ShipPincode = address?.Pincode,
            CustomerNotes = q.CustomerNotes,
            PaymentMethod = PaymentMethod.Cashfree,
            ShippingFee = q.ShippingFee,
        };
        foreach (var i in q.Items)
        {
            var p = products[i.ProductId];
            if (p.AvailableQty < i.Quantity)
                throw new AppException($"Only {Math.Max(0, p.AvailableQty):0.###} of {p.Name} in stock right now. Call the store to arrange the rest.", 409, "insufficient_stock");
            order.Items.Add(new OrderItem
            {
                ProductId = p.Id, ProductCode = p.Code, ProductName = p.Name, HsnCode = p.HsnCode,
                Quantity = i.Quantity, ListPrice = i.ListPrice, DiscountPercent = i.DiscountPercent,
                SpecialDiscountPercent = i.SpecialDiscountPercent, GstRate = i.GstRate, RewardPoints = i.RewardPoints,
            });
        }
        Pricing.Recalculate(order);
        if (order.GrandTotal != q.GrandTotal)
            throw new AppException("The quotation total doesn't match. Please ask the store to re-send it.", 409, "quote_mismatch");

        q.Status = QuotationStatus.Accepted;
        q.RespondedAt = DateTime.UtcNow;
        _db.Orders.Add(order);
        _orders.AddEvent(order, OrderActions.Placed, $"From quotation {q.QuoteNo}: {order.Items.Count} item(s), ₹{order.GrandTotal:0.00}, {order.FulfilmentType}");
        await _db.SaveChangesAsync(ct);
        q.OrderId = order.Id;
        await _db.SaveChangesAsync(ct);

        var result = await StartPaymentAsync(order, user, returnUrl, ct);
        await tx.CommitAsync(ct);
        return result;
    }

    public async Task<CheckoutResult> RetryPaymentAsync(long userId, long orderId, string? returnUrl, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var order = await _db.LockOrderAsync(orderId, ct);
        if (order == null || order.UserId != userId) throw new NotFoundException("Order");
        if (order.Status is not (OrderStatus.PendingPayment or OrderStatus.PaymentFailed))
            throw new AppException("This order doesn't need payment.", 409, "not_payable");
        if (order.CreatedAt < DateTime.UtcNow.AddDays(-2))
            throw new AppException("This order has expired. Please place a new order.", 409, "order_expired");

        // If an earlier attempt actually succeeded (webhook delayed), settle instead of charging again.
        var confirm = await SettleFromGatewayAsync(order, ct);
        if (confirm) { await _db.SaveChangesAsync(ct); await tx.CommitAsync(ct); throw new AppException("This order is already paid.", 409, "already_paid"); }

        var user = await _db.Users.FirstAsync(u => u.Id == userId, ct);
        var result = await StartPaymentAsync(order, user, returnUrl, ct);
        await tx.CommitAsync(ct);
        return result;
    }

    private static readonly TimeSpan DuplicateWindow = TimeSpan.FromMinutes(15);
    // Cashfree payment sessions last about 30 minutes; hand back an existing one only while it is safely alive.
    private static readonly TimeSpan SessionReuseWindow = TimeSpan.FromMinutes(20);

    private async Task<Order?> FindRecentDuplicateAsync(long userId, Order draft, CancellationToken ct)
    {
        var since = DateTime.UtcNow - DuplicateWindow;
        var candidates = await _db.Orders.AsNoTracking().Include(o => o.Items)
            .Where(o => o.UserId == userId && o.Status == OrderStatus.PendingPayment && o.CreatedAt >= since
                        && o.FulfilmentType == draft.FulfilmentType && o.GrandTotal == draft.GrandTotal)
            .OrderByDescending(o => o.Id).Take(3).ToListAsync(ct);
        static string Key(IEnumerable<OrderItem> items) =>
            string.Join("|", items.OrderBy(i => i.ProductId).Select(i => $"{i.ProductId}:{i.Quantity:0.###}"));
        var key = Key(draft.Items);
        return candidates.FirstOrDefault(o => Key(o.Items) == key && o.ShipLine1 == draft.ShipLine1 && o.ShipPincode == draft.ShipPincode
                                              && o.ScheduledAt == draft.ScheduledAt);
    }

    /// <summary>Returns the payment session to continue with, or null if the gateway says the order was in fact paid (caller commits).</summary>
    private async Task<CheckoutResult?> ResumePaymentAsync(Order order, AppUser user, string? returnUrl, CancellationToken ct)
    {
        var last = await _db.Payments.Where(p => p.OrderId == order.Id && p.Method == PaymentMethod.Cashfree)
            .OrderByDescending(p => p.Id).FirstOrDefaultAsync(ct);
        if (last is { Status: PaymentStatus.Pending, PaymentSessionId: not null, GatewayOrderId: not null }
            && last.CreatedAt >= DateTime.UtcNow - SessionReuseWindow)
            return new CheckoutResult(order.Id, order.OrderNo, order.GrandTotal, last.GatewayOrderId, last.PaymentSessionId, _cf.Environment);
        if (await SettleFromGatewayAsync(order, ct))
        {
            await _db.SaveChangesAsync(ct);
            return null;
        }
        return await StartPaymentAsync(order, user, returnUrl, ct);
    }

    private async Task<CheckoutResult> StartPaymentAsync(Order order, AppUser user, string? returnUrl, CancellationToken ct)
    {
        var attempt = await _db.Payments.CountAsync(p => p.OrderId == order.Id, ct) + 1;
        var gatewayOrderId = $"{order.OrderNo}-{attempt}";
        var ret = string.IsNullOrWhiteSpace(returnUrl) ? _cf.WebReturnUrl : returnUrl;
        ret = ret.Replace("{order_id}", gatewayOrderId).Replace("{orderId}", order.Id.ToString());

        var gw = await _gateway.CreateOrderAsync(new GatewayOrderRequest(
            gatewayOrderId, order.GrandTotal, $"U{user.Id}", order.CustomerName, user.Phone ?? "", user.Email, ret), ct);

        _db.Payments.Add(new Payment
        {
            OrderId = order.Id, Method = PaymentMethod.Cashfree, Status = PaymentStatus.Pending, Amount = order.GrandTotal,
            GatewayOrderId = gatewayOrderId, PaymentSessionId = gw.PaymentSessionId, GatewayReference = gw.CfOrderId, RawResponse = gw.Raw
        });
        _orders.AddEvent(order, OrderActions.PaymentStarted, $"Attempt {attempt}");
        await _db.SaveChangesAsync(ct);
        return new CheckoutResult(order.Id, order.OrderNo, order.GrandTotal, gatewayOrderId, gw.PaymentSessionId, _cf.Environment);
    }

    public async Task<PaymentConfirmResult> ConfirmAsync(long userId, long orderId, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var order = await _db.LockOrderAsync(orderId, ct);
        if (order == null || order.UserId != userId) throw new NotFoundException("Order");

        if (order.Status is OrderStatus.PendingPayment or OrderStatus.PaymentFailed)
            await SettleFromGatewayAsync(order, ct);

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var msg = order.Status switch
        {
            OrderStatus.PendingPayment => "We haven't received the payment yet. If money was deducted, it will be confirmed in a few minutes.",
            OrderStatus.PaymentFailed => "Payment failed. You can try again.",
            OrderStatus.Cancelled => "This order was cancelled.",
            _ => "Payment received. Thank you!"
        };
        return new PaymentConfirmResult(order.Id, order.OrderNo, order.Status, order.PaymentStatus, msg);
    }

    public async Task HandleWebhookAsync(string rawBody, string? signature, string? timestamp, CancellationToken ct = default)
    {
        if (!_gateway.VerifyWebhook(rawBody, signature, timestamp))
            throw new AppException("Invalid signature", 401, "bad_signature");
        var gatewayOrderId = _gateway.ExtractOrderIdFromWebhook(rawBody);
        if (gatewayOrderId == null) return;

        var payment = await _db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.GatewayOrderId == gatewayOrderId, ct);
        if (payment == null)
        {
            _log.LogWarning("Webhook for unknown Cashfree order {Id}", gatewayOrderId);
            return;
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var order = await _db.LockOrderAsync(payment.OrderId, ct);
        if (order != null) await SettleFromGatewayAsync(order, ct);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Checks every pending Cashfree attempt for this (locked) order against the Cashfree API.
    /// Never trusts client or webhook payload amounts. Returns true if the order is now paid.
    /// </summary>
    private async Task<bool> SettleFromGatewayAsync(Order order, CancellationToken ct)
    {
        await _db.Entry(order).Collection(o => o.Items).LoadAsync(ct);
        var pending = await _db.Payments.Where(p => p.OrderId == order.Id && p.Method == PaymentMethod.Cashfree && p.Status == PaymentStatus.Pending)
            .OrderByDescending(p => p.Id).ToListAsync(ct);
        var anyFailed = false;
        foreach (var p in pending)
        {
            var status = await _gateway.GetStatusAsync(p.GatewayOrderId!, ct);
            if (status.IsPaid)
            {
                if (status.Amount != p.Amount)
                {
                    _log.LogError("Amount mismatch on {Gw}: expected {Expected}, got {Got}", p.GatewayOrderId, p.Amount, status.Amount);
                    _orders.AddEvent(order, OrderActions.Note, $"Payment amount mismatch on {p.GatewayOrderId}. Needs manual review.");
                    continue;
                }
                await _orders.MarkPaidAsync(order, p, status.Amount, status.Reference, status.Raw, ct);
                return true;
            }
            if (status.IsTerminalFailure)
            {
                p.Status = PaymentStatus.Failed;
                p.RawResponse = status.Raw;
                anyFailed = true;
            }
        }
        if (anyFailed && order.Status == OrderStatus.PendingPayment && pending.All(p => p.Status == PaymentStatus.Failed))
        {
            order.Status = OrderStatus.PaymentFailed;
            order.PaymentStatus = PaymentStatus.Failed;
            _orders.AddEvent(order, OrderActions.PaymentFailed, null);
        }
        return order.Status == OrderStatus.Paid;
    }

    private async Task<string> NewOrderNoAsync(CancellationToken ct) =>
        $"BM{Clock.TodayIst:yyMM}{await _db.NextSequenceValueAsync(Sequences.OrderNo, ct):D5}";
}
