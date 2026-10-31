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
    Task<CartDto> PreviewAsync(List<CartUpdate> items, Viewer v, CancellationToken ct = default);
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
        var rows = await _db.CartItems.AsNoTracking().Where(c => c.UserId == userId)
            .Include(c => c.Product).ThenInclude(p => p.Brand)
            .Include(c => c.Product).ThenInclude(p => p.CatalogFamily)
            .OrderBy(c => c.CreatedAt).ToListAsync(ct);
        return await PriceRowsAsync(rows, userId, v, fulfilment, ct);
    }

    public async Task<CartDto> PreviewAsync(List<CartUpdate> items, Viewer v, CancellationToken ct = default)
    {
        if (items.Count > 100 || items.Any(i => i.Quantity <= 0 || i.Quantity > MaxLineQty || decimal.Round(i.Quantity, 3) != i.Quantity)) throw new AppException("Invalid guest cart quantities (maximum 100 lines).");
        if (items.GroupBy(i => new { i.ProductId, i.PurchaseUnit }).Any(g => g.Count() > 1)) throw new AppException("Duplicate cart lines.");
        var ids = items.Select(i => i.ProductId).ToList();
        var products = await _catalog.Visible(v).Include(p => p.Brand).Include(p => p.CatalogFamily).Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var rows = new List<CartItem>();
        foreach (var item in items)
        {
            if (!products.TryGetValue(item.ProductId, out var p)) continue;
            _ = Packaging.BaseQuantity(p, item.Quantity, item.PurchaseUnit);
            rows.Add(new CartItem { Product = p, ProductId = p.Id, Quantity = item.Quantity, PurchaseUnit = item.PurchaseUnit });
        }
        return await PriceRowsAsync(rows, null, v, null, ct);
    }

    private async Task<CartDto> PriceRowsAsync(List<CartItem> rows, long? userId, Viewer v, FulfilmentType? fulfilment, CancellationToken ct)
    {
        var settings = await _settings.GetAsync(ct);
        var ids = rows.Select(r => r.ProductId).ToList();
        var visible = (await _catalog.Visible(v).Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync(ct)).ToHashSet();

        var issues = new List<string>();
        var lines = new List<CartLineDto>();
        foreach (var r in rows)
        {
            var p = r.Product;
            var box = r.PurchaseUnit == "Box";
            decimal baseQty = r.Quantity;
            string? packageIssue = null;
            try { baseQty = Packaging.BaseQuantity(p, r.Quantity, r.PurchaseUnit); }
            catch (AppException ex) { packageIssue = ex.Message; }
            var priceBase = box ? Packaging.Mrp(p) : p.ListPrice;
            var discount = box ? 0 : Pricing.DiscountFor(p, v.Kind);
            var unit = box && packageIssue == null ? Packaging.Price(p) : Pricing.UnitPrice(priceBase, discount);
            string? issue = packageIssue;
            if (!visible.Contains(p.Id)) issue = "No longer available";
            else if (p.AvailableQty <= 0) issue = "Out of stock";
            else if (rows.Where(x => x.ProductId == p.Id).Sum(x => x.Quantity * (x.PurchaseUnit == "Box" ? p.PackSize ?? 0 : 1)) > p.AvailableQty) issue = $"Only {p.AvailableQty:0.###} in stock";
            if (issue != null) issues.Add($"{p.Name}: {issue}");

            lines.Add(new CartLineDto(p.Id, p.Code, p.Name, p.Brand.Name, box ? "box" : p.Unit, CatalogStructure.Image(p),
                r.Quantity, priceBase, discount, unit, Pricing.Round(unit * r.Quantity), box ? Packaging.Mrp(p) : p.Mrp, box ? Math.Floor(Math.Max(0, p.AvailableQty) / (p.PackSize is > 0 ? p.PackSize.Value : 1)) : Math.Max(0, p.AvailableQty),
                v.Kind == CustomerKind.Partner ? Pricing.Round(p.RewardPointsPerUnit * baseQty) : null, issue, r.PurchaseUnit, box ? p.PackSize : null, baseQty));
        }

        var subTotal = Pricing.Round(lines.Sum(l => l.ListPrice * l.Quantity));
        var total = lines.Sum(l => l.LineTotal);
        var f = fulfilment ?? FulfilmentType.StorePickup;
        if (total < settings.MinOrderValue && lines.Count > 0)
            issues.Add($"Minimum order value is ₹{settings.MinOrderValue:0}.");

        if (userId != null && v.Kind == CustomerKind.Partner)
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
        if (u.PurchaseUnit is not ("Piece" or "Box")) throw new AppException("Purchase unit must be Piece or Box.");
        if (u.Quantity < 0 || u.Quantity > MaxLineQty || decimal.Round(u.Quantity, 3) != u.Quantity) throw new AppException("Invalid quantity.");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        await _db.LockUserAsync(userId, ct);
        var product = await _catalog.Visible(v).FirstOrDefaultAsync(p => p.Id == u.ProductId, ct) ?? throw new NotFoundException("Product");

        var row = await _db.CartItems.FirstOrDefaultAsync(c => c.UserId == userId && c.ProductId == u.ProductId && c.PurchaseUnit == u.PurchaseUnit, ct);
        if (u.Quantity > 0) _ = Packaging.BaseQuantity(product, u.Quantity, u.PurchaseUnit);
        var qty = add ? (row?.Quantity ?? 0) + u.Quantity : u.Quantity;
        if (qty <= 0)
        {
            if (row != null) _db.CartItems.Remove(row);
        }
        else
        {
            var other = await _db.CartItems.Where(c => c.UserId == userId && c.ProductId == u.ProductId && c.PurchaseUnit != u.PurchaseUnit).ToListAsync(ct);
            var totalBase = Packaging.BaseQuantity(product, qty, u.PurchaseUnit) + other.Sum(c => Packaging.BaseQuantity(product, c.Quantity, c.PurchaseUnit));
            if (qty > MaxLineQty || totalBase > MaxLineQty) throw new AppException("Maximum 10,000 base units per product.");
            if (totalBase > product.AvailableQty) throw new AppException($"Only {Math.Max(0, product.AvailableQty):0.###} {product.Unit} of {product.Name} in stock.", 409, "insufficient_stock");
            if (row == null) _db.CartItems.Add(new CartItem { UserId = userId, ProductId = u.ProductId, PurchaseUnit = u.PurchaseUnit, Quantity = qty });
            else row.Quantity = qty;
        }
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(userId, v, null, ct);
    }

    public async Task<CartDto> RemoveAsync(long userId, long productId, Viewer v, CancellationToken ct = default)
    {
        var row = await _db.CartItems.Where(c => c.UserId == userId && c.ProductId == productId).ToListAsync(ct);
        if (row.Count > 0)
        {
            _db.CartItems.RemoveRange(row);
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
