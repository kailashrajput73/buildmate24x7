using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Catalog;

/// <summary>Read-only catalogue used by the storefront and the partner app.</summary>
public interface ICatalogService
{
    Task<PagedResult<ProductCardDto>> SearchAsync(CatalogQuery q, Viewer v, CancellationToken ct = default);
    Task<ProductDetailDto> GetAsync(long id, Viewer v, CancellationToken ct = default);
    Task<ProductDetailDto> GetByScanAsync(string code, Viewer v, CancellationToken ct = default);
    Task<List<ProductCardDto>> GetCardsAsync(IEnumerable<long> ids, Viewer v, CancellationToken ct = default);
    Task<List<CategoryTreeDto>> CategoriesAsync(Viewer v, CancellationToken ct = default);
    Task<List<CatalogItemDto>> CategoryItemsAsync(long categoryId, long? subCategoryId, Viewer v, CancellationToken ct = default);
    Task<List<BrandRefDto>> BrandsAsync(CancellationToken ct = default);
    Task<List<GroupRefDto>> GroupsAsync(CancellationToken ct = default);
    IQueryable<Product> Visible(Viewer v);
    ProductCardDto ToCard(Product p, Viewer v);
}

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _db;
    public CatalogService(AppDbContext db) => _db = db;

    public IQueryable<Product> Visible(Viewer v)
    {
        var q = _db.Products.AsNoTracking()
            .Where(p => p.IsActive && p.Category.IsActive && p.Brand.IsActive);
        return v.Channel == ClientChannel.Web ? q.Where(p => p.ShowOnWeb) : q.Where(p => p.ShowOnApp);
    }

    private IQueryable<Product> WithCardData(IQueryable<Product> q) =>
        q.Include(p => p.Brand).Include(p => p.Translations).Include(p => p.ProductType).Include(p => p.CatalogFamily);

    /// <summary>Keeps one product per size family (the first by Sequence) among the rows <paramref name="q"/> matches.</summary>
    private static IQueryable<Product> FirstOfEachFamily(IQueryable<Product> q) =>
        q.Where(p => (p.CatalogFamilyId == null && p.VariantFamily == null) ||
            !q.Any(o => o.BrandId == p.BrandId && o.CategoryId == p.CategoryId &&
                ((p.CatalogFamilyId != null && o.CatalogFamilyId == p.CatalogFamilyId) ||
                 (p.CatalogFamilyId == null && o.CatalogFamilyId == null && o.VariantFamily == p.VariantFamily)) &&
                (o.Sequence < p.Sequence || (o.Sequence == p.Sequence && o.Id < p.Id))));

    private async Task<List<ProductCardDto>> WithFamilyInfoAsync(List<ProductCardDto> cards, Viewer v, CancellationToken ct, IQueryable<Product>? pool = null)
    {
        var ids = cards.Where(c => c.Catalog?.FamilyId != null).Select(c => c.Catalog!.FamilyId!.Value).Distinct().ToList();
        var legacy = cards.Where(c => c.Catalog?.FamilyId == null && c.Family != null).Select(c => c.Family!).Distinct().ToList();
        if (ids.Count == 0 && legacy.Count == 0) return cards;
        // Aggregate in PostgreSQL: one result per family, not one row per variant.
        var members = await (pool ?? Visible(v)).Where(p => (p.CatalogFamilyId != null && ids.Contains(p.CatalogFamilyId.Value)) || (p.CatalogFamilyId == null && legacy.Contains(p.VariantFamily!)))
            .GroupBy(p => new { p.CatalogFamilyId, p.CategoryId, p.BrandId, VariantFamily = p.CatalogFamilyId == null ? p.VariantFamily : null })
            .Select(g => new { g.Key, Count = g.Count(),
                Price = g.Min(p => p.ListPrice * (1 - (v.Kind == CustomerKind.Partner ? p.PartnerDiscountPercent : p.RetailDiscountPercent) / 100m)),
                InStock = g.Any(p => p.StockQty > p.ReservedQty) }).ToListAsync(ct);
        var cardIds = cards.Select(c => c.Id).ToList();
        var brands = await Visible(v).Where(p => cardIds.Contains(p.Id)).Select(p => new { p.Id, p.BrandId }).ToDictionaryAsync(p => p.Id, p => p.BrandId, ct);
        return cards.Select(card => {
            var family = members.FirstOrDefault(m => m.Key.CategoryId == card.CategoryId && m.Key.BrandId == brands[card.Id] &&
                (card.Catalog?.FamilyId != null ? m.Key.CatalogFamilyId == card.Catalog.FamilyId : m.Key.CatalogFamilyId == null && m.Key.VariantFamily == card.Family));
            return family == null || family.Count < 2 ? card : card with {
                Name = card.Catalog?.ProductFamily ?? card.Family ?? card.Name,
                VariantCount = family.Count, FromPrice = Pricing.Round(family.Price),
                InStock = family.InStock, VariantSummary = $"{family.Count} variants"
            };
        }).ToList();
    }

    public async Task<PagedResult<ProductCardDto>> SearchAsync(CatalogQuery q, Viewer v, CancellationToken ct = default)
    {
        var query = CatalogStructure.Filter(Visible(v), q.TypeId, q.Class, q.FamilyId, q.Size, q.Length);
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var full = q.Q.Trim();
            // Exact code / barcode wins outright; otherwise every word must match somewhere,
            // so "coupler 25" finds "King CPVC Coupler SDR 11 – 25 mm (1")".
            if (await query.AnyAsync(p => p.Code == full.ToUpper() || p.Barcode == full, ct))
                query = query.Where(p => p.Code == full.ToUpper() || p.Barcode == full);
            else
                foreach (var word in PipeOptions.NormalizeSearch(full).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(6))
                {
                    var like = $"%{word.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
                    query = query.Where(p => EF.Functions.ILike(p.Name, like) || EF.Functions.ILike(p.Code, like)
                                             || EF.Functions.ILike(p.Brand.Name, like)
                                             || EF.Functions.ILike(p.Category.Name, like)
                                             || (p.SubCategory != null && EF.Functions.ILike(p.SubCategory.Name, like))
                                             || p.Specs.Any(s => EF.Functions.ILike(s, like))
                                             || p.Aliases.Any(a => EF.Functions.ILike(a.Alias, like))
                                             || p.Translations.Any(t => EF.Functions.ILike(t.Name, like)));
                }
        }
        if (q.CategoryId != null) query = query.Where(p => p.CategoryId == q.CategoryId);
        if (q.SubCategoryId != null) query = query.Where(p => p.SubCategoryId == q.SubCategoryId);
        if (q.BrandId != null) query = query.Where(p => p.BrandId == q.BrandId);
        if (q.GroupId != null) query = query.Where(p => p.GroupItems.Any(g => g.ProductGroupId == q.GroupId));
        if (q.InStock == true) query = query.Where(p => p.StockQty - p.ReservedQty > 0);
        if (q.Discounted == true)
            query = v.Kind == CustomerKind.Partner ? query.Where(p => p.PartnerDiscountPercent > 0) : query.Where(p => p.RetailDiscountPercent > 0);
        var familyPool = query;
        if (q.Collapse == true) query = FirstOfEachFamily(query);

        var partner = v.Kind == CustomerKind.Partner;
        query = q.Sort switch
        {
            "price_asc" => partner
                ? query.OrderBy(p => p.ListPrice * (100 - p.PartnerDiscountPercent))
                : query.OrderBy(p => p.ListPrice * (100 - p.RetailDiscountPercent)),
            "price_desc" => partner
                ? query.OrderByDescending(p => p.ListPrice * (100 - p.PartnerDiscountPercent))
                : query.OrderByDescending(p => p.ListPrice * (100 - p.RetailDiscountPercent)),
            "newest" => query.OrderByDescending(p => p.Id),
            "name" => query.OrderBy(p => p.Name),
            _ => query.OrderBy(p => p.Sequence).ThenBy(p => p.Name)
        };

        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var rows = await WithCardData(query).Page(page).AsSplitQuery().ToListAsync(ct);
        var cards = rows.Select(p => ToCard(p, v)).ToList();
        if (q.Collapse == true) cards = await WithFamilyInfoAsync(cards, v, ct, familyPool);
        return new PagedResult<ProductCardDto>(cards, total, page.SafePage, page.SafeSize);
    }

    public async Task<ProductDetailDto> GetAsync(long id, Viewer v, CancellationToken ct = default)
    {
        var p = await Visible(v).Include(x => x.Brand).Include(x => x.Category).Include(x => x.SubCategory).Include(x => x.ProductType).Include(x => x.CatalogFamily)
                    .Include(x => x.Translations).Include(x => x.Aliases).AsSplitQuery()
                    .FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Product");
        return await ToDetailAsync(p, v, ct);
    }

    public async Task<ProductDetailDto> GetByScanAsync(string code, Viewer v, CancellationToken ct = default)
    {
        var c = (code ?? "").Trim();
        var p = await Visible(v).Include(x => x.Brand).Include(x => x.Category).Include(x => x.SubCategory).Include(x => x.ProductType).Include(x => x.CatalogFamily)
                    .Include(x => x.Translations).Include(x => x.Aliases).AsSplitQuery()
                    .FirstOrDefaultAsync(x => x.Code == c.ToUpper() || x.Barcode == c, ct)
                ?? throw new NotFoundException("Product for this code");
        return await ToDetailAsync(p, v, ct);
    }

    public async Task<List<ProductCardDto>> GetCardsAsync(IEnumerable<long> ids, Viewer v, CancellationToken ct = default)
    {
        var list = ids.Distinct().ToList();
        var rows = await WithCardData(Visible(v).Where(p => list.Contains(p.Id))).AsSplitQuery().ToListAsync(ct);
        return list.Select(id => rows.FirstOrDefault(r => r.Id == id)).Where(p => p != null).Select(p => ToCard(p!, v)).ToList();
    }

    public async Task<List<CategoryTreeDto>> CategoriesAsync(Viewer v, CancellationToken ct = default)
    {
        var visible = Visible(v);
        var cats = await _db.Categories.AsNoTracking().Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new
            {
                c.Id, c.Name, c.ImageUrl,
                Count = visible.Count(p => p.CategoryId == c.Id),
                Subs = c.SubCategories.Where(s => s.IsActive).OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
                    .Select(s => new SubCategoryRefDto(s.Id, s.Name)).ToList()
            }).ToListAsync(ct);
        return cats.Select(c => new CategoryTreeDto(c.Id, c.Name, c.ImageUrl, c.Count, c.Subs)).ToList();
    }

    public async Task<List<CatalogItemDto>> CategoryItemsAsync(long categoryId, long? subCategoryId, Viewer v, CancellationToken ct = default)
    {
        var q = Visible(v).Where(p => p.CategoryId == categoryId);
        if (subCategoryId != null) q = q.Where(p => p.SubCategoryId == subCategoryId);
        var rows = await q.Include(p => p.Brand).Include(p => p.ProductType).Include(p => p.CatalogFamily).Include(p => p.SubCategory).Include(p => p.Translations)
            .OrderBy(p => p.Sequence).ThenBy(p => p.Id).AsSplitQuery().ToListAsync(ct);
        return rows.Select(p =>
        {
            var discount = Pricing.DiscountFor(p, v.Kind);
            var specs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var s in SpecDto.Parse(p.Specs)) specs.TryAdd(s.Name, s.Value);
            return new CatalogItemDto(p.Id, p.Code, LocalName(p, v.Lang), p.Brand.Name, p.BrandId, p.SubCategoryId, p.SubCategory?.Name,
                p.Unit, CatalogStructure.Image(p), p.Mrp, p.ListPrice, discount, Pricing.UnitPrice(p.ListPrice, discount), p.AvailableQty > 0,
                v.Kind == CustomerKind.Partner ? p.RewardPointsPerUnit : null,
                p.CatalogFamily?.Name ?? p.VariantFamily, p.VariantLabel == null ? null : Variants.Display(p.VariantLabel), specs, p.Sequence, CatalogStructure.Fields(p));
        }).ToList();
    }

    public Task<List<BrandRefDto>> BrandsAsync(CancellationToken ct = default) =>
        _db.Brands.AsNoTracking().Where(b => b.IsActive).OrderBy(b => b.SortOrder).ThenBy(b => b.Name)
            .Select(b => new BrandRefDto(b.Id, b.Name, b.LogoUrl)).ToListAsync(ct);

    public Task<List<GroupRefDto>> GroupsAsync(CancellationToken ct = default) =>
        _db.ProductGroups.AsNoTracking().Where(g => g.IsActive).OrderBy(g => g.SortOrder).ThenBy(g => g.Name)
            .Select(g => new GroupRefDto(g.Id, g.Name, g.ImageUrl)).ToListAsync(ct);

    public ProductCardDto ToCard(Product p, Viewer v)
    {
        var discount = Pricing.DiscountFor(p, v.Kind);
        return new ProductCardDto(
            p.Id, p.Code, LocalName(p, v.Lang), p.Brand.Name, p.CategoryId, p.Unit, CatalogStructure.Image(p),
            p.Mrp, p.ListPrice, discount, Pricing.UnitPrice(p.ListPrice, discount), p.AvailableQty > 0,
            v.Kind == CustomerKind.Partner ? p.RewardPointsPerUnit : null,
            p.CatalogFamily?.Name ?? p.VariantFamily, p.VariantLabel == null ? null : Variants.Display(p.VariantLabel), Catalog: CatalogStructure.Fields(p));
    }

    private async Task<ProductDetailDto> ToDetailAsync(Product p, Viewer v, CancellationToken ct)
    {
        var relatedPool = Visible(v).Where(x => x.Id != p.Id &&
                                                (p.CatalogFamilyId != null ? x.CatalogFamilyId != p.CatalogFamilyId : p.VariantFamily == null || x.VariantFamily == null || x.VariantFamily != p.VariantFamily || x.BrandId != p.BrandId) &&
                                                (p.SubCategoryId != null ? x.SubCategoryId == p.SubCategoryId : x.CategoryId == p.CategoryId));
        var related = await WithCardData(FirstOfEachFamily(relatedPool))
            .OrderBy(x => x.Sequence).Take(8).AsSplitQuery().ToListAsync(ct);
        var relatedCards = await WithFamilyInfoAsync(related.Select(r => ToCard(r, v)).ToList(), v, ct);

        var memberQuery = Visible(v).Where(x => x.BrandId == p.BrandId && x.CategoryId == p.CategoryId);
        memberQuery = p.CatalogFamilyId != null ? memberQuery.Where(x => x.CatalogFamilyId == p.CatalogFamilyId)
            : p.VariantFamily != null ? memberQuery.Where(x => x.CatalogFamilyId == null && x.VariantFamily == p.VariantFamily) : memberQuery.Where(x => x.Id == p.Id);
        var members = await memberQuery.Include(x => x.Brand).OrderBy(x => x.Sequence).ThenBy(x => x.Id).ToListAsync(ct);
        var axes = FamilyAxes.Build(p, members);
        var variants = members.Select(x => new VariantOptionDto(x.Id, x.Code, x.VariantLabel == null ? x.Name : Variants.Display(x.VariantLabel), x.Mrp,
            Pricing.UnitPrice(x, v.Kind), x.AvailableQty > 0)).ToList();
        var images = p.ImageUrls.Count > 0 ? p.ImageUrls : p.CatalogFamily?.ImageUrl is { } familyImage ? new List<string> { familyImage } : new List<string>();

        var discount = Pricing.DiscountFor(p, v.Kind);
        var otherNames = p.Translations.Select(t => t.Name).Concat(p.Aliases.Select(a => a.Alias))
            .Where(n => n != LocalName(p, v.Lang)).Distinct().ToList();

        return new ProductDetailDto(
            p.Id, p.Code, LocalName(p, v.Lang), p.Description, p.BrandId, p.Brand.Name,
            p.CategoryId, p.Category.Name, p.SubCategoryId, p.SubCategory?.Name,
            p.Unit, p.HsnCode, p.GstRate, images,
            p.Mrp, p.ListPrice, discount, Pricing.UnitPrice(p.ListPrice, discount),
            p.AvailableQty > 0, Math.Max(0, p.AvailableQty),
            v.Kind == CustomerKind.Partner ? p.RewardPointsPerUnit : null,
            otherNames, relatedCards,
            p.CatalogFamily?.Name ?? p.VariantFamily, p.VariantLabel == null ? null : Variants.Display(p.VariantLabel), variants, SpecDto.Parse(p.Specs), axes, CatalogStructure.Fields(p));
    }

    private static string LocalName(Product p, string lang) =>
        lang == "en" ? p.Name : p.Translations.FirstOrDefault(t => t.LanguageCode == lang)?.Name ?? p.Name;
}
