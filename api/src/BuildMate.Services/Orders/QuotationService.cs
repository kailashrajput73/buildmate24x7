using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using BuildMate.Services.Notifications;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Orders;

// ---------------------------------------------------------------- DTOs

public record QuoteRequest(FulfilmentType FulfilmentType, long? AddressId, DateTime? PreferredAt, string? Notes);

public record QuotationLineDto(long Id, long ProductId, string Code, string Name, string? ImageUrl, string Unit, decimal Quantity,
    decimal ListPrice, decimal DiscountPercent, decimal SpecialDiscountPercent, decimal UnitPrice, decimal LineTotal, decimal RewardPoints,
    // Staff only (null for customers): what the product costs the store, and stock now.
    decimal? AverageCost, decimal? AvailableQty, string PurchaseUnit = "Piece", decimal? PackSize = null, decimal BaseQuantity = 0);

public record QuotationSummaryDto(long Id, string QuoteNo, DateTime CreatedAt, QuotationStatus Status, CustomerKind CustomerKind,
    string CustomerName, string? CustomerPhone, FulfilmentType FulfilmentType, int ItemCount, decimal SubTotal, decimal GrandTotal,
    DateTime? ValidUntil, long? OrderId);

public record QuotationDto(long Id, string QuoteNo, DateTime CreatedAt, QuotationStatus Status, CustomerKind CustomerKind, SalesChannel Channel,
    string CustomerName, string? CustomerPhone, FulfilmentType FulfilmentType, string? AddressText, DateTime? PreferredAt, string? CustomerNotes,
    List<QuotationLineDto> Items, decimal SubTotal, decimal DiscountTotal, decimal ShippingFee, decimal RoundOff, decimal GrandTotal,
    decimal RewardPoints, string? StoreMessage, DateTime? QuotedAt, string? QuotedByName, DateTime? ValidUntil, DateTime? RespondedAt,
    string? CancelReason, long? OrderId, string? OrderNo);

public record QuotationQuery(string? Search, QuotationStatus? Status, int Page = 1, int PageSize = 25);

public record QuoteLinePrice(long ItemId, decimal SpecialDiscountPercent);

/// <summary>Staff price a request: extra discount per line, delivery charge, how long the price holds and a note.</summary>
public record QuotePriceInput(List<QuoteLinePrice> Lines, decimal? ShippingFee, int ValidDays, string? Message);

public record QuoteCancel(string Reason);

// ---------------------------------------------------------------- Service

public interface IQuotationService
{
    // Customers and partners
    Task<QuotationDto> RequestAsync(long userId, QuoteRequest req, Viewer v, CancellationToken ct = default);
    Task<PagedResult<QuotationSummaryDto>> ListMineAsync(long userId, PageRequest page, CancellationToken ct = default);
    Task<QuotationDto> GetMineAsync(long userId, long id, CancellationToken ct = default);
    Task<QuotationDto> DeclineAsync(long userId, long id, CancellationToken ct = default);

    // Staff
    Task<PagedResult<QuotationSummaryDto>> ListAsync(QuotationQuery q, CancellationToken ct = default);
    Task<QuotationDto> GetAsync(long id, CancellationToken ct = default);
    Task<QuotationDto> PriceAsync(long id, QuotePriceInput input, CancellationToken ct = default);
    Task<QuotationDto> CancelAsync(long id, QuoteCancel input, CancellationToken ct = default);
}

public class QuotationService : IQuotationService
{
    public const int MaxValidDays = 30;

    private readonly AppDbContext _db;
    private readonly ICartService _cart;
    private readonly ISettingsService _settings;
    private readonly INotificationService _notify;
    private readonly ICurrentUser _me;

    public QuotationService(AppDbContext db, ICartService cart, ISettingsService settings, INotificationService notify, ICurrentUser me)
    {
        _db = db;
        _cart = cart;
        _settings = settings;
        _notify = notify;
        _me = me;
    }

    /// <summary>A quoted price past its validity counts as expired (stored lazily the next time it is touched).</summary>
    public static QuotationStatus EffectiveStatus(Quotation q, DateTime now) =>
        q.Status == QuotationStatus.Quoted && q.ValidUntil != null && q.ValidUntil < now ? QuotationStatus.Expired : q.Status;

    /// <summary>Recomputes lines and totals (same rules as orders: GST inclusive, total rounded to the rupee).</summary>
    public static void Recalculate(Quotation q)
    {
        foreach (var i in q.Items)
        {
            if (i.PurchaseUnit == "Box")
            {
                var boxes = Packaging.PurchaseQuantity(i, i.Quantity);
                var price = Pricing.UnitPrice(i.BoxPriceSnapshot!.Value, 0, i.SpecialDiscountPercent);
                i.UnitPrice = Pricing.Round(price / i.PackSizeSnapshot!.Value);
                i.LineTotal = Pricing.Round(price * boxes);
            }
            else
            {
                i.UnitPrice = Pricing.UnitPrice(i.ListPrice, i.DiscountPercent, i.SpecialDiscountPercent);
                i.LineTotal = Pricing.Round(i.UnitPrice * i.Quantity);
            }
        }
        q.SubTotal = Pricing.Round(q.Items.Sum(i => i.PurchaseUnit == "Box" ? i.PackMrpSnapshot!.Value * Packaging.PurchaseQuantity(i, i.Quantity) : i.ListPrice * i.Quantity));
        var net = q.Items.Sum(i => i.LineTotal);
        q.DiscountTotal = Pricing.Round(q.SubTotal - net);
        var exact = Pricing.Round(net + q.ShippingFee);
        q.GrandTotal = Pricing.RoundRupee(exact);
        q.RoundOff = q.GrandTotal - exact;
    }

    public async Task<QuotationDto> RequestAsync(long userId, QuoteRequest req, Viewer v, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        if (req.FulfilmentType == FulfilmentType.HomeDelivery && !settings.HomeDeliveryEnabled) throw new AppException("Home delivery is not available right now.");
        if (req.FulfilmentType == FulfilmentType.StorePickup && !settings.StorePickupEnabled) throw new AppException("Store pickup is not available right now.");

        var cart = await _cart.GetAsync(userId, v, req.FulfilmentType, ct);
        // Stock and minimum order are not required for a quote (bulk enquiries); unavailable products are.
        var lines = cart.Items.Where(l => l.Issue != "No longer available").ToList();
        if (lines.Count == 0) throw new AppException("Add products to your cart to ask for a quote.");

        var user = await _db.Users.FirstAsync(u => u.Id == userId, ct);
        Address? address = null;
        if (req.FulfilmentType == FulfilmentType.HomeDelivery)
        {
            if (req.AddressId == null) throw new AppException("Choose a delivery address.");
            address = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == req.AddressId && a.UserId == userId, ct) ?? throw new NotFoundException("Address");
            if (settings.DeliveryPincodes.Count > 0 && !settings.DeliveryPincodes.Contains(address.Pincode))
                throw new AppException($"Sorry, we don't deliver to {address.Pincode} yet. Choose store pickup instead.", 409, "pincode_unserviceable");
        }
        if (req.PreferredAt != null && req.PreferredAt < DateTime.UtcNow.AddMinutes(-5)) throw new AppException("Preferred time must be in the future.");

        var ids = lines.Select(l => l.ProductId).ToList();
        var products = await _db.Products.AsNoTracking().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var q = new Quotation
        {
            QuoteNo = $"Q{Clock.TodayIst:yyMM}{await _db.NextSequenceValueAsync(Sequences.QuoteNo, ct):D5}",
            UserId = userId,
            CustomerKind = v.Kind,
            Channel = v.Channel == ClientChannel.App ? SalesChannel.App : SalesChannel.Web,
            FulfilmentType = req.FulfilmentType,
            AddressId = address?.Id,
            PreferredAt = req.PreferredAt,
            CustomerNotes = Trim(req.Notes, 1000),
            CustomerName = string.IsNullOrWhiteSpace(user.Name) ? (address?.Name ?? "Customer") : user.Name,
            CustomerPhone = user.Phone,
            ShippingFee = cart.DeliveryFee,
        };
        foreach (var l in lines)
        {
            var p = products[l.ProductId];
            var item = new QuotationItem
            {
                ProductId = p.Id, ProductCode = p.Code, ProductName = p.Name, Quantity = Packaging.BaseQuantity(p, l.Quantity, l.PurchaseUnit),
                ListPrice = p.ListPrice, DiscountPercent = Pricing.DiscountFor(p, v.Kind), GstRate = p.GstRate,
                RewardPoints = v.Kind == CustomerKind.Partner ? Pricing.Round(p.RewardPointsPerUnit * Packaging.BaseQuantity(p, l.Quantity, l.PurchaseUnit)) : 0,
            };
            Packaging.Snapshot(item, p, l.PurchaseUnit);
            q.Items.Add(item);
        }
        Recalculate(q);
        _db.Quotations.Add(q);
        // The basket now lives in the quote.
        _db.CartItems.RemoveRange(_db.CartItems.Where(c => c.UserId == userId && ids.Contains(c.ProductId)));
        await _db.SaveChangesAsync(ct);
        return await GetMineAsync(userId, q.Id, ct);
    }

    public async Task<PagedResult<QuotationSummaryDto>> ListMineAsync(long userId, PageRequest page, CancellationToken ct = default)
    {
        var q = _db.Quotations.AsNoTracking().Where(x => x.UserId == userId);
        var total = await q.CountAsync(ct);
        var rows = await q.OrderByDescending(x => x.Id).Page(page).Include(x => x.Items).ToListAsync(ct);
        return new PagedResult<QuotationSummaryDto>(rows.Select(Summary).ToList(), total, page.SafePage, page.SafeSize);
    }

    public async Task<QuotationDto> GetMineAsync(long userId, long id, CancellationToken ct = default)
    {
        var q = await Load(id, ct);
        if (q.UserId != userId) throw new NotFoundException("Quotation");
        return await ToDto(q, staff: false, ct);
    }

    public async Task<QuotationDto> DeclineAsync(long userId, long id, CancellationToken ct = default)
    {
        var q = await _db.Quotations.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct) ?? throw new NotFoundException("Quotation");
        if (q.Status is not (QuotationStatus.Requested or QuotationStatus.Quoted)) throw new AppException("This quotation is already closed.", 409, "quote_closed");
        q.Status = QuotationStatus.Declined;
        q.RespondedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetMineAsync(userId, id, ct);
    }

    public async Task<PagedResult<QuotationSummaryDto>> ListAsync(QuotationQuery query, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var q = _db.Quotations.AsNoTracking();
        if (query.Status == QuotationStatus.Expired)
            q = q.Where(x => x.Status == QuotationStatus.Expired || (x.Status == QuotationStatus.Quoted && x.ValidUntil < now));
        else if (query.Status == QuotationStatus.Quoted)
            q = q.Where(x => x.Status == QuotationStatus.Quoted && (x.ValidUntil == null || x.ValidUntil >= now));
        else if (query.Status != null)
            q = q.Where(x => x.Status == query.Status);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            q = q.Where(x => x.QuoteNo.Contains(s) || x.CustomerName.ToLower().Contains(s.ToLower()) || (x.CustomerPhone != null && x.CustomerPhone.Contains(s)));
        }
        var page = new PageRequest(query.Page, query.PageSize);
        var total = await q.CountAsync(ct);
        // Requests waiting for a price come first, then newest.
        var rows = await q.OrderBy(x => x.Status == QuotationStatus.Requested ? 0 : 1).ThenByDescending(x => x.Id)
            .Page(page).Include(x => x.Items).ToListAsync(ct);
        return new PagedResult<QuotationSummaryDto>(rows.Select(Summary).ToList(), total, page.SafePage, page.SafeSize);
    }

    public async Task<QuotationDto> GetAsync(long id, CancellationToken ct = default) => await ToDto(await Load(id, ct), staff: true, ct);

    public async Task<QuotationDto> PriceAsync(long id, QuotePriceInput input, CancellationToken ct = default)
    {
        if (input.ValidDays is < 1 or > MaxValidDays) throw new AppException($"Validity must be 1 to {MaxValidDays} days.");
        if (input.ShippingFee is < 0) throw new AppException("Delivery charge can't be negative.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var q = await _db.LockQuotationAsync(id, ct) ?? throw new NotFoundException("Quotation");
        var status = EffectiveStatus(q, DateTime.UtcNow);
        // A quoted (or lapsed) price can be revised until the customer accepts or declines.
        if (status is not (QuotationStatus.Requested or QuotationStatus.Quoted or QuotationStatus.Expired))
            throw new AppException("This quotation is already closed.", 409, "quote_closed");

        foreach (var line in input.Lines)
        {
            var item = q.Items.FirstOrDefault(i => i.Id == line.ItemId) ?? throw new AppException("Unknown line in the quotation.");
            if (line.SpecialDiscountPercent < 0 || item.DiscountPercent + line.SpecialDiscountPercent > 100)
                throw new AppException($"{item.ProductName}: the discount must be between 0 and {100 - item.DiscountPercent:0.##}%.");
            item.SpecialDiscountPercent = Math.Round(line.SpecialDiscountPercent, 2, MidpointRounding.AwayFromZero);
        }
        if (input.ShippingFee != null) q.ShippingFee = Pricing.Round(input.ShippingFee.Value);
        if (q.FulfilmentType == FulfilmentType.StorePickup) q.ShippingFee = 0;
        Recalculate(q);

        q.Status = QuotationStatus.Quoted;
        q.StoreMessage = Trim(input.Message, 1000);
        q.QuotedAt = DateTime.UtcNow;
        q.QuotedById = _me.Id;
        q.QuotedByName = _me.Name;
        // Valid to the end of the last day, India time.
        q.ValidUntil = Clock.IstDateStartUtc(Clock.TodayIst.AddDays(input.ValidDays + 1)).AddSeconds(-1);

        await _notify.NotifyAsync(q.UserId, $"Your quotation {q.QuoteNo} is ready",
            $"Price ₹{q.GrandTotal:0} for {q.Items.Count} item(s). Valid till {Clock.ToIst(q.ValidUntil.Value):dd MMM}.", $"quote:{q.Id}", ct);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<QuotationDto> CancelAsync(long id, QuoteCancel input, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Reason)) throw new AppException("Give a reason — the customer sees it.");
        var q = await _db.Quotations.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Quotation");
        if (q.Status is QuotationStatus.Accepted or QuotationStatus.Declined or QuotationStatus.Cancelled)
            throw new AppException("This quotation is already closed.", 409, "quote_closed");
        q.Status = QuotationStatus.Cancelled;
        q.CancelReason = Trim(input.Reason, 500);
        await _notify.NotifyAsync(q.UserId, $"Quotation {q.QuoteNo} was closed", q.CancelReason!, $"quote:{q.Id}", ct);
        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    // ---------------------------------------------------------------- helpers

    private async Task<Quotation> Load(long id, CancellationToken ct) =>
        await _db.Quotations.AsNoTracking().Include(x => x.Items).ThenInclude(i => i.Product).Include(x => x.Order)
            .FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Quotation");

    private static QuotationSummaryDto Summary(Quotation q) =>
        new(q.Id, q.QuoteNo, q.CreatedAt, EffectiveStatus(q, DateTime.UtcNow), q.CustomerKind, q.CustomerName, q.CustomerPhone,
            q.FulfilmentType, q.Items.Count, q.SubTotal, q.GrandTotal, q.ValidUntil, q.OrderId);

    private async Task<QuotationDto> ToDto(Quotation q, bool staff, CancellationToken ct)
    {
        string? addressText = null;
        if (q.AddressId != null)
        {
            var a = await _db.Addresses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.AddressId, ct);
            if (a != null) addressText = string.Join(", ", new[] { a.Name, a.Line1, a.Line2, a.Landmark, a.City, a.Pincode }.Where(s => !string.IsNullOrWhiteSpace(s)));
        }
        var lines = q.Items.OrderBy(i => i.Id).Select(i => new QuotationLineDto(i.Id, i.ProductId, i.ProductCode, i.ProductName,
            i.Product?.ImageUrls.FirstOrDefault(), i.PurchaseUnit == "Box" ? "box" : i.BaseUnitSnapshot ?? i.Product?.Unit ?? "pcs", Packaging.PurchaseQuantity(i, i.Quantity), i.PurchaseUnit == "Box" ? i.PackMrpSnapshot!.Value : i.ListPrice, i.DiscountPercent, i.SpecialDiscountPercent,
            i.PurchaseUnit == "Box" ? Pricing.UnitPrice(i.BoxPriceSnapshot!.Value, 0, i.SpecialDiscountPercent) : i.UnitPrice, i.LineTotal, i.RewardPoints,
            staff ? i.Product?.AverageCost : null, staff ? i.Product?.AvailableQty : null, i.PurchaseUnit, i.PackSizeSnapshot, i.Quantity)).ToList();
        // Before the store quotes, the amounts are the customer's regular prices (shown as "current price").
        return new QuotationDto(q.Id, q.QuoteNo, q.CreatedAt, EffectiveStatus(q, DateTime.UtcNow), q.CustomerKind, q.Channel, q.CustomerName,
            q.CustomerPhone, q.FulfilmentType, addressText, q.PreferredAt, q.CustomerNotes, lines, q.SubTotal,
            q.DiscountTotal, q.ShippingFee, q.RoundOff, q.GrandTotal,
            q.Items.Sum(i => i.RewardPoints), q.StoreMessage, q.QuotedAt, q.QuotedByName, q.ValidUntil, q.RespondedAt, q.CancelReason,
            q.OrderId, q.Order?.OrderNo);
    }

    private static string? Trim(string? s, int max) => string.IsNullOrWhiteSpace(s) ? null : s.Trim()[..Math.Min(s.Trim().Length, max)];
}
