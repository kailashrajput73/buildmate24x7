using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Orders;

public interface ICartService
{
    Task<CartDto> GetAsync(long userId, Viewer v, FulfilmentType? fulfilment = null, CancellationToken ct = default);
    Task<CartDto> SetQuantityAsync(long userId, CartUpdate u, Viewer v, bool add, CancellationToken ct = default);
    Task<CartDto> RemoveAsync(long userId, long productId, Viewer v, CancellationToken ct = default);
    Task ClearAsync(long userId, CancellationToken ct = default);
    /// <summary>Merges a guest (browser) cart into the user's cart after login.</summary>
    Task<CartDto> MergeAsync(long userId, List<CartUpdate> items, Viewer v, CancellationToken ct = default);
    decimal DeliveryFee(StoreSettings s, FulfilmentType f, decimal total);
}

public class CartService : ICartService
{
    public const decimal MaxLineQty = 10_000;
    private readonly AppDbContext _db;
    private readonly ICatalogService _catalog;
    private readonly ISettingsService _settings;

    public CartService(AppDbContext db, ICatalogService catalog, ISettingsService settings)
    {
        _db = db;
        _catalog = catalog;
        _settings = settings;
    }

    public async Task<CartDto> GetAsync(long userId, Viewer v, FulfilmentType? fulfilment = null, CancellationToken ct = default)
    {
        var settings = await _settings.GetAsync(ct);
        var rows = await _db.CartItems.AsNoTracking().Where(c => c.UserId == userId)
            .Include(c => c.Product).ThenInclude(p => p.Brand)
            .OrderBy(c => c.CreatedAt).ToListAsync(ct);
        var ids = rows.Select(r => r.ProductId).ToList();
        var visible = (await _catalog.Visible(v).Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync(ct)).ToHashSet();

        var issues = new List<string>();
        var lines = new List<CartLineDto>();
        foreach (var r in rows)
        {
            var p = r.Product;
            var discount = Pricing.DiscountFor(p, v.Kind);
            var unit = Pricing.UnitPrice(p.ListPrice, discount);
            string? issue = null;
            if (!visible.Contains(p.Id)) issue = "No longer available";
            else if (p.AvailableQty <= 0) issue = "Out of stock";
            else if (r.Quantity > p.AvailableQty) issue = $"Only {p.AvailableQty:0.###} in stock";
            if (issue != null) issues.Add($"{p.Name}: {issue}");

            lines.Add(new CartLineDto(p.Id, p.Code, p.Name, p.Brand.Name, p.Unit, p.ImageUrls.FirstOrDefault(),
                r.Quantity, p.ListPrice, discount, unit, Pricing.Round(unit * r.Quantity), p.Mrp, Math.Max(0, p.AvailableQty),
                v.Kind == CustomerKind.Partner ? Pricing.Round(p.RewardPointsPerUnit * r.Quantity) : null, issue));
        }

        var subTotal = Pricing.Round(lines.Sum(l => l.ListPrice * l.Quantity));
        var total = lines.Sum(l => l.LineTotal);
        var f = fulfilment ?? FulfilmentType.StorePickup;
        if (total < settings.MinOrderValue && lines.Count > 0)
            issues.Add($"Minimum order value is ₹{settings.MinOrderValue:0}.");

        if (v.Kind == CustomerKind.Partner)
        {
            var kyc = await _db.PartnerProfiles.Where(p => p.UserId == userId).Select(p => p.KycStatus).FirstOrDefaultAsync(ct);
            if (kyc != KycStatus.Approved) issues.Add("Your account is awaiting KYC approval. You can order once approved.");
        }

        var fee = DeliveryFee(settings, f, total);
        var exact = Pricing.Round(total + fee);
        var payable = Pricing.RoundRupee(exact);
        return new CartDto(lines, lines.Count, subTotal, Pricing.Round(subTotal - total), total,
            lines.Sum(l => l.RewardPoints ?? 0), fee, settings.FreeDeliveryAbove, settings.MinOrderValue,
            lines.Count > 0 && issues.Count == 0, issues, settings.StorePickupEnabled, settings.HomeDeliveryEnabled,
            payable - exact, payable);
    }

    public decimal DeliveryFee(StoreSettings s, FulfilmentType f, decimal total) =>
        f == FulfilmentType.HomeDelivery && !(s.FreeDeliveryAbove > 0 && total >= s.FreeDeliveryAbove) ? s.DeliveryFee : 0;

    public async Task<CartDto> SetQuantityAsync(long userId, CartUpdate u, Viewer v, bool add, CancellationToken ct = default)
    {
        if (u.Quantity < 0 || u.Quantity > MaxLineQty) throw new AppException("Invalid quantity.");
        var product = await _catalog.Visible(v).FirstOrDefaultAsync(p => p.Id == u.ProductId, ct) ?? throw new NotFoundException("Product");

        var row = await _db.CartItems.FirstOrDefaultAsync(c => c.UserId == userId && c.ProductId == u.ProductId, ct);
        var qty = add ? (row?.Quantity ?? 0) + u.Quantity : u.Quantity;
        if (qty <= 0)
        {
            if (row != null) _db.CartItems.Remove(row);
        }
        else
        {
            if (qty > product.AvailableQty) throw new AppException($"Only {Math.Max(0, product.AvailableQty):0.###} {product.Unit} of {product.Name} in stock.", 409, "insufficient_stock");
            if (row == null) _db.CartItems.Add(new CartItem { UserId = userId, ProductId = u.ProductId, Quantity = qty });
            else row.Quantity = qty;
        }
        await _db.SaveChangesAsync(ct);
        return await GetAsync(userId, v, null, ct);
    }

    public async Task<CartDto> RemoveAsync(long userId, long productId, Viewer v, CancellationToken ct = default)
    {
        var row = await _db.CartItems.FirstOrDefaultAsync(c => c.UserId == userId && c.ProductId == productId, ct);
        if (row != null)
        {
            _db.CartItems.Remove(row);
            await _db.SaveChangesAsync(ct);
        }
        return await GetAsync(userId, v, null, ct);
    }

    public async Task ClearAsync(long userId, CancellationToken ct = default)
    {
        var rows = await _db.CartItems.Where(c => c.UserId == userId).ToListAsync(ct);
        _db.CartItems.RemoveRange(rows);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<CartDto> MergeAsync(long userId, List<CartUpdate> items, Viewer v, CancellationToken ct = default)
    {
        foreach (var it in items.Where(i => i.Quantity > 0).Take(100))
        {
            try { await SetQuantityAsync(userId, it, v, add: false, ct); }
            catch (AppException) { /* skip unavailable items silently during merge */ }
        }
        return await GetAsync(userId, v, null, ct);
    }
}
