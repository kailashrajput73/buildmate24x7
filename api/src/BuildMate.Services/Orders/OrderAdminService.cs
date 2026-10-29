using BuildMate.Data;
using BuildMate.Domain.Common;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Erp;
using BuildMate.Services.Inventory;
using BuildMate.Services.Notifications;
using BuildMate.Services.Partners;
using BuildMate.Services.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace BuildMate.Services.Orders;

/// <summary>Store-side order handling: scheduling, edits before dispatch, dispatch + invoice, cancellations, counter sales.</summary>
public interface IOrderAdminService
{
    Task<OrderDetailDto> ScheduleAsync(long orderId, OrderScheduleUpdate dto, CancellationToken ct = default);
    Task<OrderDetailDto> SetStatusAsync(long orderId, OrderStatusUpdate dto, CancellationToken ct = default);
    Task<OrderDetailDto> EditItemsAsync(long orderId, OrderEditRequest dto, CancellationToken ct = default);
    Task<OrderDetailDto> AddNoteAsync(long orderId, string note, CancellationToken ct = default);
    Task<OrderDetailDto> CancelAsync(long orderId, CancelRequest dto, CancellationToken ct = default);
    Task<OrderDetailDto> DispatchAsync(long orderId, DispatchRequest dto, CancellationToken ct = default);
    Task<OrderDetailDto> MarkDeliveredAsync(long orderId, CancellationToken ct = default);
    Task<OrderDetailDto> CounterSaleAsync(CounterSaleRequest dto, CancellationToken ct = default);
}

public class OrderAdminService : IOrderAdminService
{
    private readonly AppDbContext _db;
    private readonly IOrderService _orders;
    private readonly IStockService _stock;
    private readonly IPartnerService _partners;
    private readonly IPaymentGateway _gateway;
    private readonly INotificationService _notify;
    private readonly IOutbox _outbox;
    private readonly ICurrentUser _me;
    private readonly IInvoiceNumbers _invoiceNumbers;

    public OrderAdminService(AppDbContext db, IOrderService orders, IStockService stock, IPartnerService partners,
        IPaymentGateway gateway, INotificationService notify, IOutbox outbox, ICurrentUser me, IInvoiceNumbers invoiceNumbers)
    {
        _invoiceNumbers = invoiceNumbers;
        _db = db;
        _orders = orders;
        _stock = stock;
        _partners = partners;
        _gateway = gateway;
        _notify = notify;
        _outbox = outbox;
        _me = me;
    }

    private async Task<(Order Order, IDbContextTransaction Tx)> LockAsync(long orderId, CancellationToken ct)
    {
        var tx = await _db.Database.BeginTransactionAsync(ct);
        var order = await _db.LockOrderAsync(orderId, ct);
        if (order == null) { await tx.DisposeAsync(); throw new NotFoundException("Order"); }
        await _db.Entry(order).Collection(o => o.Items).LoadAsync(ct);
        await _db.Entry(order).Reference(o => o.Dispatch).LoadAsync(ct);
        return (order, tx);
    }

    private async Task<OrderDetailDto> CommitAsync(Order order, IDbContextTransaction tx, CancellationToken ct)
    {
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await _orders.GetAsync(order.Id, null, ct);
    }

    // ------------------------------------------------------------------ Schedule & status

    public async Task<OrderDetailDto> ScheduleAsync(long orderId, OrderScheduleUpdate dto, CancellationToken ct = default)
    {
        var (order, tx) = await LockAsync(orderId, ct);
        await using var _ = tx;
        if (!OrderService.Editable(order)) throw new AppException("This order can no longer be rescheduled.", 409, "not_editable");
        if (dto.FulfilmentType == FulfilmentType.HomeDelivery && string.IsNullOrWhiteSpace(order.ShipLine1))
            throw new AppException("This order has no delivery address. Keep it as store pickup or update the address first.");

        order.FulfilmentType = dto.FulfilmentType;
        order.ScheduledAt = dto.ScheduledAt;
        if (order.Status == OrderStatus.Paid) order.Status = OrderStatus.Processing;
        var when = dto.ScheduledAt == null ? "time to be confirmed" : Clock.ToIst(dto.ScheduledAt.Value).ToString("dd MMM, h:mm tt");
        var label = dto.FulfilmentType == FulfilmentType.StorePickup ? "Store pickup" : "Home delivery";
        _orders.AddEvent(order, OrderActions.Scheduled, $"{label} · {when}{(string.IsNullOrWhiteSpace(dto.Note) ? "" : " · " + dto.Note)}");
        if (order.UserId != null)
            await _notify.NotifyAsync(order.UserId.Value, $"{label} scheduled", $"Order {order.OrderNo}: {when}.", $"order:{order.Id}", ct);
        return await CommitAsync(order, tx, ct);
    }

    public async Task<OrderDetailDto> SetStatusAsync(long orderId, OrderStatusUpdate dto, CancellationToken ct = default)
    {
        var (order, tx) = await LockAsync(orderId, ct);
        await using var _ = tx;
        var allowed = dto.Status is OrderStatus.Processing or OrderStatus.ReadyForPickup;
        if (!allowed) throw new AppException("Use Dispatch, Mark delivered or Cancel for that change.");
        if (!OrderService.Editable(order)) throw new AppException("Order status can't be changed at this stage.", 409, "not_editable");

        order.Status = dto.Status;
        _orders.AddEvent(order, OrderActions.StatusChanged, $"{dto.Status}{(string.IsNullOrWhiteSpace(dto.Note) ? "" : " · " + dto.Note)}");
        if (order.UserId != null && dto.Status == OrderStatus.ReadyForPickup)
            await _notify.NotifyAsync(order.UserId.Value, "Ready for pickup", $"Order {order.OrderNo} is packed and ready at the store.", $"order:{order.Id}", ct);
        return await CommitAsync(order, tx, ct);
    }

    public async Task<OrderDetailDto> AddNoteAsync(long orderId, string note, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(note)) throw new AppException("Note is empty.");
        var (order, tx) = await LockAsync(orderId, ct);
        await using var _ = tx;
        order.InternalNotes = string.IsNullOrWhiteSpace(order.InternalNotes) ? note.Trim() : order.InternalNotes + "\n" + note.Trim();
        _orders.AddEvent(order, OrderActions.Note, note.Trim());
        return await CommitAsync(order, tx, ct);
    }

    // ------------------------------------------------------------------ Edit items before dispatch

    public async Task<OrderDetailDto> EditItemsAsync(long orderId, OrderEditRequest dto, CancellationToken ct = default)
    {
        if (dto.Lines == null || dto.Lines.Count == 0) throw new AppException("An order needs at least one item. Cancel it instead.");
        if (dto.Lines.Any(l => l.Quantity <= 0)) throw new AppException("Quantities must be more than zero.");
        if (dto.Lines.GroupBy(l => l.ProductId).Any(g => g.Count() > 1)) throw new AppException("Each product should appear once.");
        if (dto.Lines.Any(l => l.SpecialDiscountPercent is < 0 or > 50)) throw new AppException("Special discount must be between 0 and 50%.");
        if (dto.Lines.Any(l => l.SpecialDiscountPercent > 0) && !_me.HasPermission(Permissions.OrdersSpecialDiscount))
            throw new ForbiddenException("You don't have permission to give special discounts.");

        var (order, tx) = await LockAsync(orderId, ct);
        await using var _ = tx;
        if (!OrderService.Editable(order)) throw new AppException("Only paid orders that haven't been dispatched can be edited.", 409, "not_editable");

        var allIds = dto.Lines.Select(l => l.ProductId).Union(order.Items.Select(i => i.ProductId)).ToList();
        var products = (await _db.LockProductsAsync(allIds, ct)).ToDictionary(p => p.Id);
        var changes = new List<string>();

        // Removed lines
        foreach (var item in order.Items.Where(i => dto.Lines.All(l => l.ProductId != i.ProductId)).ToList())
        {
            if (order.StockReserved) products[item.ProductId].ReservedQty = Math.Max(0, products[item.ProductId].ReservedQty - item.Quantity);
            changes.Add($"Removed {item.ProductName} ×{item.Quantity:0.###}");
            order.Items.Remove(item);
            _db.OrderItems.Remove(item);
        }

        foreach (var line in dto.Lines)
        {
            if (!products.TryGetValue(line.ProductId, out var p)) throw new NotFoundException($"Product {line.ProductId}");
            var item = order.Items.FirstOrDefault(i => i.ProductId == line.ProductId);
            var oldQty = item?.Quantity ?? 0;
            var delta = line.Quantity - oldQty;
            if (delta > 0 && p.AvailableQty < delta)
                throw new AppException($"Only {Math.Max(0, p.AvailableQty):0.###} more of {p.Name} available.", 409, "insufficient_stock");

            if (item == null)
            {
                item = new OrderItem
                {
                    ProductId = p.Id, ProductCode = p.Code, ProductName = p.Name, HsnCode = p.HsnCode,
                    ListPrice = p.ListPrice, DiscountPercent = Pricing.DiscountFor(p, order.CustomerKind), GstRate = p.GstRate,
                    AddedAtStore = true
                };
                order.Items.Add(item);
                changes.Add($"Added {p.Name} ×{line.Quantity:0.###}");
            }
            else if (delta != 0) changes.Add($"{p.Name}: {oldQty:0.###} → {line.Quantity:0.###}");

            if (item.SpecialDiscountPercent != line.SpecialDiscountPercent)
                changes.Add($"{p.Name}: special discount {item.SpecialDiscountPercent:0.##}% → {line.SpecialDiscountPercent:0.##}%");

            item.Quantity = line.Quantity;
            item.SpecialDiscountPercent = line.SpecialDiscountPercent;
            item.RewardPoints = order.CustomerKind == CustomerKind.Partner ? Pricing.Round(p.RewardPointsPerUnit * line.Quantity) : 0;
            if (order.StockReserved) p.ReservedQty += delta;
        }

        if (dto.ShippingFee != null && dto.ShippingFee != order.ShippingFee)
        {
            if (dto.ShippingFee < 0) throw new AppException("Delivery fee cannot be negative.");
            changes.Add($"Delivery fee ₹{order.ShippingFee:0.00} → ₹{dto.ShippingFee:0.00}");
            order.ShippingFee = dto.ShippingFee.Value;
        }

        if (changes.Count == 0) return await _orders.GetAsync(orderId, null, ct);

        var before = order.GrandTotal;
        Pricing.Recalculate(order);
        changes.Add($"Total ₹{before:0.00} → ₹{order.GrandTotal:0.00}");
        if (!string.IsNullOrWhiteSpace(dto.Note)) changes.Add(dto.Note.Trim());
        _orders.AddEvent(order, OrderActions.ItemsEdited, string.Join("; ", changes));
        return await CommitAsync(order, tx, ct);
    }

    // ------------------------------------------------------------------ Cancel

    public async Task<OrderDetailDto> CancelAsync(long orderId, CancelRequest dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Reason)) throw new AppException("Give a reason for cancelling.");
        var (order, tx) = await LockAsync(orderId, ct);
        await using var _ = tx;
        if (order.Dispatch != null || order.Status is OrderStatus.Completed or OrderStatus.Cancelled)
            throw new AppException("Dispatched or closed orders can't be cancelled. Record a return instead.", 409, "not_cancellable");

        await _orders.ReleaseReservationAsync(order, ct);
        order.Status = OrderStatus.Cancelled;
        order.CancelledAt = DateTime.UtcNow;
        order.CancelReason = dto.Reason.Trim();
        _orders.AddEvent(order, OrderActions.Cancelled, order.CancelReason);

        if (order.AmountPaid > 0 && dto.RefundOnline)
        {
            var paid = await _db.Payments.Where(p => p.OrderId == order.Id && p.Method == PaymentMethod.Cashfree && p.Status == PaymentStatus.Success)
                .OrderByDescending(p => p.Id).FirstOrDefaultAsync(ct);
            if (paid?.GatewayOrderId != null)
            {
                var refundAmount = Math.Min(order.AmountPaid, paid.Amount);
                await _gateway.RefundAsync(paid.GatewayOrderId, refundAmount, $"RF-{order.OrderNo}", order.CancelReason, ct);
                paid.Status = refundAmount >= paid.Amount ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;
                order.PaymentStatus = paid.Status;
                _orders.AddEvent(order, OrderActions.Refunded, $"₹{refundAmount:0.00} refund initiated to original payment method");
            }
        }

        if (order.UserId != null)
            await _notify.NotifyAsync(order.UserId.Value, $"Order {order.OrderNo} cancelled",
                order.AmountPaid > 0 && dto.RefundOnline ? "Your refund has been initiated and should reach you in 5–7 working days." : order.CancelReason,
                $"order:{order.Id}", ct);
        if (order.PaidAt != null) _outbox.Add(ErpEvents.OrderCancelled, new { order.Id, order.OrderNo, order.CancelReason });
        return await CommitAsync(order, tx, ct);
    }

    // ------------------------------------------------------------------ Dispatch

    public async Task<OrderDetailDto> DispatchAsync(long orderId, DispatchRequest dto, CancellationToken ct = default)
    {
        var (order, tx) = await LockAsync(orderId, ct);
        await using var _ = tx;
        await DispatchCoreAsync(order, dto, ct);
        return await CommitAsync(order, tx, ct);
    }

    private async Task DispatchCoreAsync(Order order, DispatchRequest dto, CancellationToken ct)
    {
        if (!OrderService.Editable(order)) throw new AppException("Only paid orders that haven't been dispatched can be dispatched.", 409, "not_dispatchable");

        // Settle any difference created by edits at the counter.
        var balance = order.BalanceDue;
        if (balance > 0.009m)
        {
            if (dto.BalanceCollectedVia == null || dto.BalanceCollectedVia == PaymentMethod.Cashfree)
                throw new AppException($"Collect the balance of ₹{balance:0.00} (cash, UPI or card) before dispatch.", 409, "balance_due");
            _db.Payments.Add(new Payment
            {
                OrderId = order.Id, Method = dto.BalanceCollectedVia.Value, Status = PaymentStatus.Success, Amount = balance,
                GatewayReference = dto.BalanceReference, CollectedById = _me.Id
            });
            order.AmountPaid += balance;
            _orders.AddEvent(order, OrderActions.BalanceCollected, $"₹{balance:0.00} via {dto.BalanceCollectedVia}");
        }
        else if (balance < -0.009m)
        {
            _orders.AddEvent(order, OrderActions.Note, $"Customer overpaid by ₹{-balance:0.00} after edits — refund the difference.");
        }

        // One timestamp for the dispatch record and the products' movement dates.
        var dispatchedAt = DateTime.UtcNow;

        // Deduct physical stock and release the reservation.
        var products = (await _db.LockProductsAsync(order.Items.Select(i => i.ProductId), ct)).ToDictionary(p => p.Id);
        foreach (var g in order.Items.GroupBy(i => i.ProductId))
        {
            var p = products[g.Key];
            var qty = g.Sum(i => i.Quantity);
            if (order.StockReserved) p.ReservedQty = Math.Max(0, p.ReservedQty - qty);
            _stock.Apply(p, StockMovementType.SaleOut, -qty, 0, "Order", order.Id, order.OrderNo, order.CustomerName);
            // Movement classification: saved in this same transaction, so a dispatch that fails or rolls back records nothing.
            ProductMovement.RecordDispatch(p, dispatchedAt);
        }
        order.StockReserved = false;

        var fy = Clock.FinancialYear(Clock.TodayIst);
        var dispatch = new Dispatch
        {
            OrderId = order.Id,
            DispatchNo = $"DS{fy}{await _db.NextSequenceValueAsync(Sequences.DispatchNo, ct):D5}",
            InvoiceNo = await _invoiceNumbers.TakeAsync(ct),
            DispatchedAt = dispatchedAt,
            DispatchedById = _me.RequireId(),
            DispatchedByName = _me.Name,
            VehicleNo = dto.VehicleNo?.Trim(),
            DeliveryPerson = dto.DeliveryPerson?.Trim(),
            Notes = dto.Notes?.Trim()
        };
        _db.Dispatches.Add(dispatch);
        order.Dispatch = dispatch;
        order.Status = order.FulfilmentType == FulfilmentType.HomeDelivery ? OrderStatus.OutForDelivery : OrderStatus.Completed;
        _orders.AddEvent(order, OrderActions.Dispatched, $"Invoice {dispatch.InvoiceNo}{(dispatch.VehicleNo != null ? " · Vehicle " + dispatch.VehicleNo : "")}");

        // Reward points are credited on dispatch (goods actually handed over), not on payment.
        if (order.CustomerKind == CustomerKind.Partner && order.UserId != null && order.RewardPointsEarned > 0 && !order.RewardsCredited)
        {
            await _partners.PostRewardAsync(order.UserId.Value, RewardTransactionType.Earned, order.RewardPointsEarned, order.Id, $"Order {order.OrderNo}", ct);
            order.RewardsCredited = true;
            _orders.AddEvent(order, OrderActions.RewardsCredited, $"{order.RewardPointsEarned:0.##} points");
        }

        if (order.UserId != null)
            await _notify.NotifyAsync(order.UserId.Value,
                order.FulfilmentType == FulfilmentType.HomeDelivery ? "Out for delivery 🚚" : "Order collected — thank you!",
                $"Order {order.OrderNo} · Invoice {dispatch.InvoiceNo}" + (order.RewardsCredited ? $" · +{order.RewardPointsEarned:0.##} points" : ""),
                $"order:{order.Id}", ct);

        _outbox.Add(ErpEvents.OrderDispatched, new { Order = OrderService.ErpPayload(order), dispatch.InvoiceNo, dispatch.DispatchNo, DispatchedAt = dispatch.DispatchedAt });
    }

    public async Task<OrderDetailDto> MarkDeliveredAsync(long orderId, CancellationToken ct = default)
    {
        var (order, tx) = await LockAsync(orderId, ct);
        await using var _ = tx;
        if (order.Status != OrderStatus.OutForDelivery) throw new AppException("Only orders out for delivery can be marked delivered.", 409);
        order.Status = OrderStatus.Completed;
        _orders.AddEvent(order, OrderActions.Delivered, null);
        if (order.UserId != null)
            await _notify.NotifyAsync(order.UserId.Value, "Delivered ✅", $"Order {order.OrderNo} has been delivered.", $"order:{order.Id}", ct);
        return await CommitAsync(order, tx, ct);
    }

    // ------------------------------------------------------------------ Counter sale (walk-in retail billing)

    public async Task<OrderDetailDto> CounterSaleAsync(CounterSaleRequest dto, CancellationToken ct = default)
    {
        if (dto.Lines == null || dto.Lines.Count == 0) throw new AppException("Scan or add at least one product.");
        if (dto.Lines.Any(l => l.Quantity <= 0)) throw new AppException("Quantities must be more than zero.");
        if (dto.PaymentMethod == PaymentMethod.Cashfree) throw new AppException("Choose cash, UPI or card for counter sales.");
        if (dto.Lines.Any(l => l.SpecialDiscountPercent is < 0 or > 50)) throw new AppException("Special discount must be between 0 and 50%.");
        if (dto.Lines.Any(l => l.SpecialDiscountPercent > 0) && !_me.HasPermission(Permissions.OrdersSpecialDiscount))
            throw new ForbiddenException("You don't have permission to give special discounts.");

        AppUser? partner = null;
        if (dto.PartnerUserId != null)
        {
            partner = await _db.Users.Include(u => u.PartnerProfile).FirstOrDefaultAsync(u => u.Id == dto.PartnerUserId && u.UserType == UserType.Partner, ct)
                      ?? throw new NotFoundException("Partner");
            if (partner.PartnerProfile?.KycStatus != KycStatus.Approved) throw new AppException("This partner's KYC isn't approved yet.");
        }
        var kind = partner != null ? CustomerKind.Partner : CustomerKind.WalkIn;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var lines = dto.Lines.GroupBy(l => l.ProductId)
            .Select(g => new CounterLine(g.Key, g.Sum(x => x.Quantity), g.Max(x => x.SpecialDiscountPercent))).ToList();
        var products = (await _db.LockProductsAsync(lines.Select(l => l.ProductId), ct)).ToDictionary(p => p.Id);

        var order = new Order
        {
            OrderNo = $"BM{Clock.TodayIst:yyMM}{await _db.NextSequenceValueAsync(Sequences.OrderNo, ct):D5}",
            UserId = partner?.Id,
            Channel = SalesChannel.Store,
            CustomerKind = kind,
            Status = OrderStatus.Paid,
            FulfilmentType = FulfilmentType.StorePickup,
            CustomerName = partner?.Name ?? (string.IsNullOrWhiteSpace(dto.CustomerName) ? "Walk-in customer" : dto.CustomerName.Trim()),
            CustomerPhone = partner?.Phone ?? (string.IsNullOrWhiteSpace(dto.CustomerPhone) ? null : Phone.Normalize(dto.CustomerPhone)),
            CustomerGstin = partner?.PartnerProfile?.Gstin ?? dto.CustomerGstin?.Trim().ToUpperInvariant(),
            CustomerNotes = dto.Notes?.Trim(),
            PaymentMethod = dto.PaymentMethod,
            PaymentStatus = PaymentStatus.Success,
            PaidAt = DateTime.UtcNow
        };
        foreach (var l in lines)
        {
            if (!products.TryGetValue(l.ProductId, out var p)) throw new NotFoundException($"Product {l.ProductId}");
            if (p.AvailableQty < l.Quantity) throw new AppException($"Only {Math.Max(0, p.AvailableQty):0.###} of {p.Name} available.", 409, "insufficient_stock");
            order.Items.Add(new OrderItem
            {
                ProductId = p.Id, ProductCode = p.Code, ProductName = p.Name, HsnCode = p.HsnCode, Quantity = l.Quantity,
                ListPrice = p.ListPrice, DiscountPercent = Pricing.DiscountFor(p, kind), SpecialDiscountPercent = l.SpecialDiscountPercent,
                GstRate = p.GstRate, AddedAtStore = true,
                RewardPoints = kind == CustomerKind.Partner ? Pricing.Round(p.RewardPointsPerUnit * l.Quantity) : 0
            });
        }
        Pricing.Recalculate(order);
        order.AmountPaid = order.GrandTotal;
        _db.Orders.Add(order);
        _db.Payments.Add(new Payment { Order = order, Method = dto.PaymentMethod, Status = PaymentStatus.Success, Amount = order.GrandTotal, GatewayReference = dto.PaymentReference, CollectedById = _me.Id });
        _orders.AddEvent(order, OrderActions.Placed, $"Counter sale · {dto.PaymentMethod}");
        await _db.SaveChangesAsync(ct);

        await DispatchCoreAsync(order, new DispatchRequest(null, null, "Counter sale", null, null), ct);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await _orders.GetAsync(order.Id, null, ct);
    }
}
