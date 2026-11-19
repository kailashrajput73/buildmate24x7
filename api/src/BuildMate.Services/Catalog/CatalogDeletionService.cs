using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Catalog;

public record CatalogUse(string Area, string Reference);
public record CatalogDeleteImpact(string Kind, long Id, string Name, int ProductCount, int OrderCount,
    int QuotationCount, int PurchaseCount, int StockMovementCount, int CartCount, int WishlistCount,
    int LocationCount, int GroupCount, decimal CurrentStock, decimal ReservedStock,
    List<CatalogUse> Uses, List<string> BlockReasons, bool CanDelete);

public interface ICatalogDeletionService
{
    Task<CatalogDeleteImpact> PreviewAsync(string kind, long id, CancellationToken ct = default);
    Task DeleteAsync(string kind, long id, CancellationToken ct = default);
    Task DeleteEmptyMasterAsync(string kind, long id, CancellationToken ct = default);
}

/// <summary>Preview and guarded removal of catalogue records. Business history is always retained.</summary>
public sealed class CatalogDeletionService : ICatalogDeletionService
{
    private readonly AppDbContext _db;
    public CatalogDeletionService(AppDbContext db) => _db = db;

    public async Task<CatalogDeleteImpact> PreviewAsync(string kind, long id, CancellationToken ct = default)
    {
        var (name, productIds, structuralRows) = await ResolveAsync(kind, id, ct);
        var ids = productIds.Distinct().ToList();
        var orderRows = await _db.OrderItems.AsNoTracking().Where(x => ids.Contains(x.ProductId))
            .Select(x => new { x.Order.OrderNo, x.Order.Status }).Distinct().Take(20).ToListAsync(ct);
        var quoteRows = await _db.QuotationItems.AsNoTracking().Where(x => ids.Contains(x.ProductId))
            .Select(x => x.Quotation.QuoteNo).Distinct().Take(20).ToListAsync(ct);
        var purchaseRows = await _db.PurchaseItems.AsNoTracking().Where(x => ids.Contains(x.ProductId))
            .Select(x => x.Purchase.PurchaseNo).Distinct().Take(20).ToListAsync(ct);
        var movementCount = await _db.StockMovements.CountAsync(x => ids.Contains(x.ProductId), ct);
        var cartCount = await _db.CartItems.CountAsync(x => ids.Contains(x.ProductId), ct);
        var wishlistCount = await _db.WishlistItems.CountAsync(x => ids.Contains(x.ProductId), ct);
        var locationCount = await _db.ProductLocations.CountAsync(x => ids.Contains(x.ProductId), ct);
        var groupCount = await _db.ProductGroupItems.CountAsync(x => ids.Contains(x.ProductId), ct);
        var stock = await _db.Products.Where(x => ids.Contains(x.Id)).Select(x => (decimal?)x.StockQty).SumAsync(ct) ?? 0;
        var reserved = await _db.Products.Where(x => ids.Contains(x.Id)).Select(x => (decimal?)x.ReservedQty).SumAsync(ct) ?? 0;
        var orderCount = await _db.OrderItems.CountAsync(x => ids.Contains(x.ProductId), ct);
        var quoteCount = await _db.QuotationItems.CountAsync(x => ids.Contains(x.ProductId), ct);
        var purchaseCount = await _db.PurchaseItems.CountAsync(x => ids.Contains(x.ProductId), ct);
        var reasons = new List<string>();
        if (orderCount > 0) reasons.Add("Order history exists; orders and invoices must be retained.");
        if (quoteCount > 0) reasons.Add("Quotation history exists.");
        if (purchaseCount > 0) reasons.Add("Purchase history exists.");
        if (movementCount > 0) reasons.Add("Stock ledger history exists.");
        if (stock != 0 || reserved != 0) reasons.Add("Current or reserved stock is not zero.");
        var uses = new List<CatalogUse>();
        uses.AddRange(orderRows.Select(x => new CatalogUse("Order", $"{x.OrderNo} ({x.Status})")));
        uses.AddRange(quoteRows.Select(x => new CatalogUse("Quotation", x)));
        uses.AddRange(purchaseRows.Select(x => new CatalogUse("Purchase", x)));
        uses.AddRange(new[]
        {
            ("Stock movements", movementCount), ("Cart items", cartCount), ("Wishlists", wishlistCount),
            ("Rack locations", locationCount), ("Product groups", groupCount), ("Related catalog records", structuralRows)
        }.Where(x => x.Item2 > 0).Select(x => new CatalogUse(x.Item1, x.Item2.ToString())));
        var structureUses = kind.ToLowerInvariant() switch
        {
            "brand" => await _db.CatalogFamilies.AsNoTracking().Where(x => x.BrandId == id).OrderBy(x => x.Name).Take(50)
                .Select(x => new CatalogUse("Brand family", x.Name)).ToListAsync(ct),
            "category" => await CategoryStructureUsesAsync(id, ct),
            "subcategory" => await _db.ProductTypeSubCategories.AsNoTracking().Where(x => x.SubCategoryId == id)
                .Select(x => new CatalogUse("Linked type", x.ProductType.Name)).ToListAsync(ct),
            "producttype" => await _db.CatalogFamilyCards.AsNoTracking().Where(x => x.ProductTypeId == id)
                .Select(x => new CatalogUse("Shared family card", x.Key)).ToListAsync(ct),
            _ => new List<CatalogUse>()
        };
        uses.AddRange(structureUses);
        var sectionRows = kind.ToLowerInvariant() switch
        {
            "brand" => await _db.HomeSections.AsNoTracking().Where(x => x.Type == HomeSectionType.Brand && x.ReferenceId == id).Select(x => x.Title).ToListAsync(ct),
            "category" => await _db.HomeSections.AsNoTracking().Where(x => x.Type == HomeSectionType.Category && x.ReferenceId == id).Select(x => x.Title).ToListAsync(ct),
            _ => new List<string>()
        };
        uses.AddRange(sectionRows.Select(x => new CatalogUse("Home page section", x)));
        var attributeRows = await _db.Products.AsNoTracking().Where(x => ids.Contains(x.Id))
            .OrderBy(x => x.Name).Take(30)
            .Select(x => new { x.Name, x.ProductClass, x.Color, x.Module, x.Series, Type = x.ProductType == null ? null : x.ProductType.Name })
            .ToListAsync(ct);
        uses.AddRange(attributeRows.Select(x => new CatalogUse("Product attributes", $"{x.Name}: Type={x.Type ?? "—"}, Class={x.ProductClass ?? "—"}, Color={x.Color ?? "—"}, Module={x.Module ?? "—"}, Series={x.Series ?? "—"}")));
        return new(kind, id, name, ids.Count, orderCount, quoteCount, purchaseCount, movementCount,
            cartCount, wishlistCount, locationCount, groupCount, stock, reserved, uses, reasons, reasons.Count == 0);
    }

    public async Task DeleteAsync(string kind, long id, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var impact = await PreviewAsync(kind, id, ct);
        if (!impact.CanDelete)
            throw new AppException($"Cannot delete {impact.Name}: {string.Join(" ", impact.BlockReasons)}", 409, "catalog_in_use");
        var (_, products, _) = await ResolveAsync(kind, id, ct);
        var ids = products.Distinct().ToList();
        var affectedGroups = await _db.ProductGroupItems.Where(x => ids.Contains(x.ProductId)).Select(x => x.ProductGroupId).Distinct().ToListAsync(ct);
        await RemoveProductsAsync(ids, ct);
        await RemoveInvalidGroupsAsync(affectedGroups, ct);
        switch (kind.ToLowerInvariant())
        {
            case "brand":
                await _db.HomeSections.Where(x => x.Type == HomeSectionType.Brand && x.ReferenceId == id).ExecuteDeleteAsync(ct);
                _db.CatalogFamilies.RemoveRange(await _db.CatalogFamilies.Where(x => x.BrandId == id).ToListAsync(ct));
                await _db.SaveChangesAsync(ct);
                var brand = await _db.Brands.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Brand");
                _db.Brands.Remove(brand); break;
            case "subcategory":
                await _db.ProductTypeSubCategories.Where(x => x.SubCategoryId == id).ExecuteDeleteAsync(ct);
                var sub = await _db.SubCategories.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Sub category");
                _db.SubCategories.Remove(sub); break;
            case "category":
                await _db.HomeSections.Where(x => x.Type == HomeSectionType.Category && x.ReferenceId == id).ExecuteDeleteAsync(ct);
                await RemoveCategoryStructureAsync(id, ct);
                break;
            case "producttype":
                var type = await _db.ProductTypes.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Product type");
                _db.ProductTypes.Remove(type); break;
            case "product": break;
            default: throw new AppException("Unsupported catalogue item.");
        }
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task DeleteEmptyMasterAsync(string kind, long id, CancellationToken ct = default)
    {
        switch (kind.ToLowerInvariant())
        {
            case "brand":
                if (await _db.Products.AnyAsync(x => x.BrandId == id, ct) || await _db.CatalogFamilies.AnyAsync(x => x.BrandId == id, ct) ||
                    await _db.HomeSections.AnyAsync(x => x.Type == HomeSectionType.Brand && x.ReferenceId == id, ct))
                    throw InUse("Brand");
                var brand = await _db.Brands.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Brand");
                _db.Brands.Remove(brand); break;
            case "category":
                if (await _db.Products.AnyAsync(x => x.CategoryId == id, ct) || await _db.SubCategories.AnyAsync(x => x.CategoryId == id, ct) ||
                    await _db.ProductTypes.AnyAsync(x => x.CategoryId == id, ct) || await _db.CatalogFamilies.AnyAsync(x => x.CategoryId == id, ct) ||
                    await _db.CatalogFamilyCards.AnyAsync(x => x.CategoryId == id, ct) ||
                    await _db.HomeSections.AnyAsync(x => x.Type == HomeSectionType.Category && x.ReferenceId == id, ct)) throw InUse("Category");
                var category = await _db.Categories.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Category");
                _db.Categories.Remove(category); break;
            case "subcategory":
                if (await _db.Products.AnyAsync(x => x.SubCategoryId == id, ct) || await _db.ProductTypeSubCategories.AnyAsync(x => x.SubCategoryId == id, ct))
                    throw InUse("Sub category");
                var sub = await _db.SubCategories.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Sub category");
                _db.SubCategories.Remove(sub); break;
            case "producttype":
                if (await _db.Products.AnyAsync(x => x.ProductTypeId == id, ct) || await _db.ProductTypeSubCategories.AnyAsync(x => x.ProductTypeId == id, ct) ||
                    await _db.CatalogFamilyCards.AnyAsync(x => x.ProductTypeId == id, ct))
                    throw InUse("Product type");
                var type = await _db.ProductTypes.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Product type");
                _db.ProductTypes.Remove(type); break;
            default: throw new AppException("Unsupported empty master item.");
        }
        await _db.SaveChangesAsync(ct);
    }

    private async Task<(string Name, List<long> ProductIds, int StructuralRows)> ResolveAsync(string kind, long id, CancellationToken ct)
    {
        switch (kind.ToLowerInvariant())
        {
            case "product":
                var p = await _db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Product");
                return (p.Name, new() { id }, 0);
            case "brand":
                var b = await _db.Brands.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Brand");
                return (b.Name, await _db.Products.Where(x => x.BrandId == id).Select(x => x.Id).ToListAsync(ct), await _db.CatalogFamilies.CountAsync(x => x.BrandId == id, ct) + await _db.HomeSections.CountAsync(x => x.Type == HomeSectionType.Brand && x.ReferenceId == id, ct));
            case "subcategory":
                var s = await _db.SubCategories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Sub category");
                return (s.Name, await _db.Products.Where(x => x.SubCategoryId == id).Select(x => x.Id).ToListAsync(ct), await _db.ProductTypeSubCategories.CountAsync(x => x.SubCategoryId == id, ct));
            case "producttype":
                var t = await _db.ProductTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Product type");
                return (t.Name, await _db.Products.Where(x => x.ProductTypeId == id).Select(x => x.Id).ToListAsync(ct), await _db.CatalogFamilyCards.CountAsync(x => x.ProductTypeId == id, ct));
            case "category":
                var c = await _db.Categories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Category");
                var ids = await _db.Products.Where(x => x.CategoryId == id).Select(x => x.Id).ToListAsync(ct);
                var rows = await _db.SubCategories.CountAsync(x => x.CategoryId == id, ct) + await _db.ProductTypes.CountAsync(x => x.CategoryId == id, ct) +
                    await _db.CatalogFamilies.CountAsync(x => x.CategoryId == id, ct) + await _db.CatalogFamilyCards.CountAsync(x => x.CategoryId == id, ct) +
                    await _db.HomeSections.CountAsync(x => x.Type == HomeSectionType.Category && x.ReferenceId == id, ct);
                return (c.Name, ids, rows);
            default: throw new AppException("Unsupported catalogue item.");
        }
    }

    private async Task RemoveProductsAsync(List<long> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return;
        await _db.CartItems.Where(x => ids.Contains(x.ProductId)).ExecuteDeleteAsync(ct);
        await _db.WishlistItems.Where(x => ids.Contains(x.ProductId)).ExecuteDeleteAsync(ct);
        await _db.ProductLocations.Where(x => ids.Contains(x.ProductId)).ExecuteDeleteAsync(ct);
        await _db.ProductGroupItems.Where(x => ids.Contains(x.ProductId)).ExecuteDeleteAsync(ct);
        await _db.Products.Where(x => ids.Contains(x.Id)).ExecuteDeleteAsync(ct);
    }

    private async Task<List<CatalogUse>> CategoryStructureUsesAsync(long id, CancellationToken ct)
    {
        var uses = new List<CatalogUse>();
        uses.AddRange(await _db.SubCategories.AsNoTracking().Where(x => x.CategoryId == id).OrderBy(x => x.Name).Take(50)
            .Select(x => new CatalogUse("Sub-category", x.Name)).ToListAsync(ct));
        uses.AddRange(await _db.ProductTypes.AsNoTracking().Where(x => x.CategoryId == id).OrderBy(x => x.Name).Take(50)
            .Select(x => new CatalogUse("Type", x.Name)).ToListAsync(ct));
        uses.AddRange(await _db.CatalogFamilies.AsNoTracking().Where(x => x.CategoryId == id).OrderBy(x => x.Name).Take(50)
            .Select(x => new CatalogUse("Family", x.Name)).ToListAsync(ct));
        uses.AddRange(await _db.CatalogFamilyCards.AsNoTracking().Where(x => x.CategoryId == id).OrderBy(x => x.Key).Take(50)
            .Select(x => new CatalogUse("Shared family card", x.Key)).ToListAsync(ct));
        return uses;
    }

    private async Task RemoveInvalidGroupsAsync(List<long> groupIds, CancellationToken ct)
    {
        if (groupIds.Count == 0) return;
        var invalid = await _db.ProductGroups.Where(x => groupIds.Contains(x.Id) && x.Items.Count < 2).Select(x => x.Id).ToListAsync(ct);
        if (invalid.Count == 0) return;
        await _db.HomeSections.Where(x => x.Type == HomeSectionType.ProductGroup && x.ReferenceId != null && invalid.Contains(x.ReferenceId.Value)).ExecuteDeleteAsync(ct);
        await _db.ProductGroups.Where(x => invalid.Contains(x.Id)).ExecuteDeleteAsync(ct);
    }

    private async Task RemoveCategoryStructureAsync(long id, CancellationToken ct)
    {
        var types = await _db.ProductTypes.Where(x => x.CategoryId == id).ToListAsync(ct);
        _db.ProductTypes.RemoveRange(types);
        _db.CatalogFamilyCards.RemoveRange(await _db.CatalogFamilyCards.Where(x => x.CategoryId == id).ToListAsync(ct));
        _db.CatalogFamilies.RemoveRange(await _db.CatalogFamilies.Where(x => x.CategoryId == id).ToListAsync(ct));
        _db.SubCategories.RemoveRange(await _db.SubCategories.Where(x => x.CategoryId == id).ToListAsync(ct));
        var category = await _db.Categories.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Category");
        _db.Categories.Remove(category);
    }

    private static AppException InUse(string kind) => new($"{kind} is still referenced by catalogue data. Use the Administrator preview to review connected records.", 409, "in_use");
}
