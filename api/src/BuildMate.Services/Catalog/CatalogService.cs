using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using System.Text.RegularExpressions;
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

    // ---- Product families (one reusable rule for every module) -----------------------------------------------------
    // Module (category) → product family → brand → variants. A family is identified by, in this order:
    //   1. the product's catalogue family (catalog_families row) — its stable Key, the family name in capitals;
    //   2. together with its category and Type, so different types ("UPVC" / "CPVC" PIPE) stay different families;
    //   3. older products without a family row: their legacy Variant Family name, trimmed and in capitals.
    // The brand is not part of the identity, so every brand of a family shares one card and one product page.
    // Types set to "One card per brand" (perBrandTypes) keep the per-brand families they had before.
    // Products with no family at all stay one card each — nothing is grouped by similar names.

    /// <summary>
    /// Keeps one product per family (the first by Sequence) among the rows <paramref name="q"/> matches.
    /// </summary>
    private static IQueryable<Product> FirstOfEachFamily(IQueryable<Product> q, List<long> perBrandTypes) =>
        q.Where(p => (p.CatalogFamilyId == null && p.VariantFamily == null) ||
            !q.Any(o => o.CategoryId == p.CategoryId &&
                (o.Sequence < p.Sequence || (o.Sequence == p.Sequence && o.Id < p.Id)) &&
                ((p.ProductTypeId == null || !perBrandTypes.Contains(p.ProductTypeId.Value))
                    // All brands: same category + Type + family key.
                    ? o.ProductTypeId == p.ProductTypeId && (o.CatalogFamilyId != null || o.VariantFamily != null) &&
                      (o.CatalogFamilyId != null ? o.CatalogFamily!.Key : o.VariantFamily!.Trim().ToUpper()) ==
                      (p.CatalogFamilyId != null ? p.CatalogFamily!.Key : p.VariantFamily!.Trim().ToUpper())
                    // One card per brand (admin setting): the brand's own family, as before.
                    : o.BrandId == p.BrandId &&
                      ((p.CatalogFamilyId != null && o.CatalogFamilyId == p.CatalogFamilyId) ||
                       (p.CatalogFamilyId == null && o.CatalogFamilyId == null && o.VariantFamily == p.VariantFamily)))));

    /// <summary>Products of the same family as <paramref name="p"/> (all brands), see <see cref="FirstOfEachFamily"/>.</summary>
    private static IQueryable<Product> SameFamily(IQueryable<Product> q, Product p, bool shared, string? key)
    {
        if (shared)
            return q.Where(x => x.CategoryId == p.CategoryId && x.ProductTypeId == p.ProductTypeId && (x.CatalogFamilyId != null || x.VariantFamily != null) &&
                                (x.CatalogFamilyId != null ? x.CatalogFamily!.Key : x.VariantFamily!.Trim().ToUpper()) == key);
        q = q.Where(x => x.BrandId == p.BrandId && x.CategoryId == p.CategoryId);
        return p.CatalogFamilyId != null ? q.Where(x => x.CatalogFamilyId == p.CatalogFamilyId)
            : p.VariantFamily != null ? q.Where(x => x.CatalogFamilyId == null && x.VariantFamily == p.VariantFamily) : q.Where(x => x.Id == p.Id);
    }

    /// <summary>Family key of a loaded product (see the identity rules above); null = no family.</summary>
    private static string? FamilyKey(Product p) =>
        p.CatalogFamilyId != null ? p.CatalogFamily?.Key : p.VariantFamily?.Trim().ToUpperInvariant();

    private static bool Shared(Product p, List<long> perBrandTypes) =>
        (p.CatalogFamilyId != null || p.VariantFamily != null) && (p.ProductTypeId == null || !perBrandTypes.Contains(p.ProductTypeId.Value));

    private async Task<List<ProductCardDto>> WithFamilyInfoAsync(List<ProductCardDto> cards, Viewer v, CancellationToken ct, IQueryable<Product>? pool = null, List<long>? perBrandTypes = null)
    {
        perBrandTypes ??= await CatalogStructure.PerBrandTypeIdsAsync(_db, ct);
        var cardIds = cards.Select(c => c.Id).ToList();
        if (cardIds.Count == 0) return cards;
        // Family identity of each card's product (read from the database: a family's Key stays when its name is edited).
        var self = (await _db.Products.AsNoTracking().Where(p => cardIds.Contains(p.Id))
                .Select(p => new { p.Id, p.CategoryId, p.BrandId, p.ProductTypeId, p.CatalogFamilyId, p.VariantFamily,
                    Key = p.CatalogFamilyId != null ? p.CatalogFamily!.Key : p.VariantFamily!.Trim().ToUpper() })
                .ToListAsync(ct)).ToDictionary(p => p.Id);
        bool IsShared(long id) => self.TryGetValue(id, out var s) && (s.CatalogFamilyId != null || s.VariantFamily != null) &&
                                  (s.ProductTypeId == null || !perBrandTypes.Contains(s.ProductTypeId.Value));
        var sharedCards = cards.Where(c => IsShared(c.Id)).ToList();
        var ids = cards.Where(c => !IsShared(c.Id) && self.ContainsKey(c.Id) && self[c.Id].CatalogFamilyId != null).Select(c => self[c.Id].CatalogFamilyId!.Value).Distinct().ToList();
        var legacy = cards.Where(c => !IsShared(c.Id) && self.ContainsKey(c.Id) && self[c.Id].CatalogFamilyId == null && self[c.Id].VariantFamily != null).Select(c => self[c.Id].VariantFamily!).Distinct().ToList();
        if (ids.Count == 0 && legacy.Count == 0 && sharedCards.Count == 0) return cards;

        // Per-brand families (types set to "One card per brand"): aggregated in PostgreSQL, one result per family.
        var members = ids.Count == 0 && legacy.Count == 0 ? new() : await (pool ?? Visible(v))
            .Where(p => (p.CatalogFamilyId != null && ids.Contains(p.CatalogFamilyId.Value)) || (p.CatalogFamilyId == null && legacy.Contains(p.VariantFamily!)))
            .GroupBy(p => new { p.CatalogFamilyId, p.CategoryId, p.BrandId, VariantFamily = p.CatalogFamilyId == null ? p.VariantFamily : null })
            .Select(g => new { g.Key, Count = g.Count(),
                Price = g.Min(p => p.ListPrice * (1 - (v.Kind == CustomerKind.Partner ? p.PartnerDiscountPercent : p.RetailDiscountPercent) / 100m)),
                InStock = g.Any(p => p.StockQty > p.ReservedQty) }).ToListAsync(ct);

        // Families shown once for all brands: category + Type + family key, one result per family and brand.
        var keys = sharedCards.Select(c => self[c.Id].Key).Distinct().ToList();
        var categories = sharedCards.Select(c => self[c.Id].CategoryId).Distinct().ToList();
        var shared = keys.Count == 0 ? new() : await (pool ?? Visible(v))
            .Where(p => categories.Contains(p.CategoryId) && (p.CatalogFamilyId != null || p.VariantFamily != null) &&
                        (p.ProductTypeId == null || !perBrandTypes.Contains(p.ProductTypeId.Value)) &&
                        keys.Contains(p.CatalogFamilyId != null ? p.CatalogFamily!.Key : p.VariantFamily!.Trim().ToUpper()))
            .Select(p => new { p.CategoryId, p.ProductTypeId, Key = p.CatalogFamilyId != null ? p.CatalogFamily!.Key : p.VariantFamily!.Trim().ToUpper(),
                Brand = p.Brand.Name, BrandOrder = p.Brand.SortOrder,
                Price = p.ListPrice * (1 - (v.Kind == CustomerKind.Partner ? p.PartnerDiscountPercent : p.RetailDiscountPercent) / 100m),
                InStock = p.StockQty > p.ReservedQty })
            .GroupBy(p => new { p.CategoryId, p.ProductTypeId, p.Key, p.Brand, p.BrandOrder })
            .Select(g => new { g.Key, Count = g.Count(), Price = g.Min(p => p.Price), InStock = g.Any(p => p.InStock) }).ToListAsync(ct);
        var sharedTypes = sharedCards.Where(c => self[c.Id].ProductTypeId != null).Select(c => self[c.Id].ProductTypeId!.Value).Distinct().ToList();
        var cardPhotos = sharedTypes.Count == 0 ? new() : await _db.CatalogFamilyCards.AsNoTracking()
            .Where(c => sharedTypes.Contains(c.ProductTypeId) && keys.Contains(c.Key) && c.ImageUrl != null).ToListAsync(ct);

        return cards.Select(card => {
            if (!self.TryGetValue(card.Id, out var me)) return card;
            if (IsShared(card.Id))
            {
                var all = shared.Where(m => m.Key.CategoryId == me.CategoryId && m.Key.ProductTypeId == me.ProductTypeId && m.Key.Key == me.Key).ToList();
                var count = all.Sum(m => m.Count);
                if (count < 2) return card;
                var photo = me.ProductTypeId == null ? null
                    : cardPhotos.FirstOrDefault(c => c.CategoryId == me.CategoryId && c.ProductTypeId == me.ProductTypeId && c.Key == me.Key)?.ImageUrl;
                var brands = all.OrderBy(m => m.Key.BrandOrder).ThenBy(m => m.Key.Brand).Select(m => m.Key.Brand).Distinct().ToList();
                return card with {
                    Name = CatalogStructure.CardTitle(card.Catalog?.TypeName, card.Catalog?.ProductFamily ?? card.Family ?? card.Name),
                    ImageUrl = photo ?? card.ImageUrl,
                    VariantCount = count, FromPrice = Pricing.Round(all.Min(m => m.Price)),
                    // Out of stock only when no variant of any brand is in stock.
                    InStock = all.Any(m => m.InStock), VariantSummary = $"{count} variants", AllBrands = true,
                    Brands = brands
                };
            }
            var family = members.FirstOrDefault(m => m.Key.CategoryId == me.CategoryId && m.Key.BrandId == me.BrandId &&
                (me.CatalogFamilyId != null ? m.Key.CatalogFamilyId == me.CatalogFamilyId : m.Key.CatalogFamilyId == null && m.Key.VariantFamily == me.VariantFamily));
            return family == null || family.Count < 2 ? card : card with {
                Name = card.Catalog?.ProductFamily ?? card.Family ?? card.Name,
                VariantCount = family.Count, FromPrice = Pricing.Round(family.Price),
                InStock = family.InStock, VariantSummary = $"{family.Count} variants"
            };
        }).ToList();
    }

    private static string Like(string word) => $"%{word.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";

    /// <summary>Search tiers for one word, tried in order until one finds something:
    /// 0 = the word as a WHOLE word (singular or plural) in what the product is — its name, code, size family,
    ///     catalogue family, type, class, size — or a brand whose name starts with it ("Havells").
    ///     "pipe" finds "CPVC Pipe" / "Pipes" but not "Pipeline", and "switch" not "Switchboard Cable";
    /// 1 = the whole word in its sub-category name ("Switches &amp; Sockets" only when no product is called a switch);
    /// 2 = the word anywhere inside its own fields and sub-category (partly typed words: "swi");
    /// 3 = also its type and brand; 4 = also its other names (aliases, translations); 5 = also the category name and
    /// specs. "pipe" therefore finds pipes only, not every fitting of the "Pipe &amp; Fitting" category, of a "… Pipes"
    /// brand or with a "garam pani pipe" alias.</summary>
    private const int LastSearchTier = 5;

    /// <summary>PostgreSQL regular expression for one search word as a whole word, singular or plural:
    /// "pipe"/"pipes" → \m(pipes|pipe|pip)(e?s)?\M (matches pipe, pipes).</summary>
    private static string WholeWord(string word)
    {
        var w = word.ToLowerInvariant();
        var stems = new List<string> { w };
        if (w.Length > 3 && w.EndsWith("es")) stems.Add(w[..^2]);
        if (w.Length > 3 && w.EndsWith('s')) stems.Add(w[..^1]);
        return @"\m(" + string.Join("|", stems.Distinct().Select(Regex.Escape)) + @")(e?s)?\M";
    }

    /// <summary>Products where <paramref name="word"/> is a whole word of their own fields (search tier 0).</summary>
    private static IQueryable<Product> WholeWordMatches(IQueryable<Product> q, string word)
    {
        var pattern = WholeWord(word);
        var brandStart = "^" + pattern[2..];
        return q.Where(p => Regex.IsMatch(p.Name, pattern, RegexOptions.IgnoreCase) || Regex.IsMatch(p.Code, pattern, RegexOptions.IgnoreCase)
                            || (p.VariantFamily != null && Regex.IsMatch(p.VariantFamily, pattern, RegexOptions.IgnoreCase))
                            || (p.CatalogFamily != null && Regex.IsMatch(p.CatalogFamily.Name, pattern, RegexOptions.IgnoreCase))
                            || (p.ProductType != null && Regex.IsMatch(p.ProductType.Name, pattern, RegexOptions.IgnoreCase))
                            || (p.ProductClass != null && Regex.IsMatch(p.ProductClass, pattern, RegexOptions.IgnoreCase))
                            || (p.Size != null && Regex.IsMatch(p.Size, pattern, RegexOptions.IgnoreCase))
                            || Regex.IsMatch(p.Brand.Name, brandStart, RegexOptions.IgnoreCase));
    }

    private static IQueryable<Product> Matches(IQueryable<Product> q, string word, int tier)
    {
        if (tier == 0) return WholeWordMatches(q, word);
        if (tier == 1)
        {
            var pattern = WholeWord(word);
            return q.Where(p => p.SubCategory != null && Regex.IsMatch(p.SubCategory.Name, pattern, RegexOptions.IgnoreCase));
        }
        var like = Like(word);
        tier -= 2;
        return q.Where(p => EF.Functions.ILike(p.Name, like) || EF.Functions.ILike(p.Code, like)
                     || (p.VariantFamily != null && EF.Functions.ILike(p.VariantFamily, like))
                     || (p.CatalogFamily != null && EF.Functions.ILike(p.CatalogFamily.Name, like))
                     || (p.SubCategory != null && EF.Functions.ILike(p.SubCategory.Name, like))
                     || (p.ProductClass != null && EF.Functions.ILike(p.ProductClass, like))
                     || (p.Size != null && EF.Functions.ILike(p.Size, like))
                     || (tier >= 1 && ((p.ProductType != null && EF.Functions.ILike(p.ProductType.Name, like))
                                       || EF.Functions.ILike(p.Brand.Name, like)))
                     || (tier >= 2 && (p.Aliases.Any(a => EF.Functions.ILike(a.Alias, like))
                                       || p.Translations.Any(t => EF.Functions.ILike(t.Name, like))))
                     || (tier >= 3 && (EF.Functions.ILike(p.Category.Name, like)
                                       || p.Specs.Any(s => EF.Functions.ILike(s, like)))));
    }

    public async Task<PagedResult<ProductCardDto>> SearchAsync(CatalogQuery q, Viewer v, CancellationToken ct = default)
    {
        var query = CatalogStructure.Filter(Visible(v), q.TypeId, q.Class, q.FamilyId, q.Size, q.Length, q.Module, q.Color, q.Series, q.CurrentRating);
        if (q.CategoryId != null) query = query.Where(p => p.CategoryId == q.CategoryId);
        if (q.SubCategoryId != null) query = query.Where(p => p.SubCategoryId == q.SubCategoryId);
        if (q.BrandId != null) query = query.Where(p => p.BrandId == q.BrandId);
        if (q.GroupId != null) query = query.Where(p => p.GroupItems.Any(g => g.ProductGroupId == q.GroupId));
        if (q.InStock == true) query = query.Where(p => p.StockQty - p.ReservedQty > 0);
        if (q.Discounted == true)
            query = v.Kind == CustomerKind.Partner ? query.Where(p => p.PartnerDiscountPercent > 0) : query.Where(p => p.RetailDiscountPercent > 0);
        string? fullLike = null;
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var full = q.Q.Trim();
            fullLike = Like(full);
            // Exact code / barcode wins outright. Otherwise every word must match (see Matches for the field order).
            if (await query.AnyAsync(p => p.Code == full.ToUpper() || p.Barcode == full, ct))
                query = query.Where(p => p.Code == full.ToUpper() || p.Barcode == full);
            else
            {
                // Each word narrows the list in turn, using the closest fields that match it: "astral pipe" = Astral
                // products (brand) whose own name or sub-category says pipe.
                var words = PipeOptions.NormalizeSearch(full).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(6).ToList();
                foreach (var word in words)
                    for (var tier = 0; tier <= LastSearchTier; tier++)
                    {
                        var found = Matches(query, word, tier);
                        if (tier == LastSearchTier || await found.AnyAsync(ct)) { query = found; break; }
                    }
            }
        }
        var familyPool = query;
        var perBrandTypes = q.Collapse == true ? await CatalogStructure.PerBrandTypeIdsAsync(_db, ct) : new List<long>();
        if (q.Collapse == true) query = FirstOfEachFamily(query, perBrandTypes);

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
            // Searching: products whose name has the whole search text come first.
            _ when fullLike != null => query.OrderBy(p => EF.Functions.ILike(p.Name, fullLike) ? 0 : 1).ThenBy(p => p.Sequence).ThenBy(p => p.Name),
            _ => query.OrderBy(p => p.Sequence).ThenBy(p => p.Name)
        };

        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var rows = await WithCardData(query).Page(page).AsSplitQuery().ToListAsync(ct);
        var cards = rows.Select(p => ToCard(p, v)).ToList();
        if (q.Collapse == true) cards = await WithFamilyInfoAsync(cards, v, ct, familyPool, perBrandTypes);
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
                    .Select(s => new SubCategoryRefDto(s.Id, s.Name, s.ImageUrl)).ToList()
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
        // The family is shared by every brand ("CPVC PIPE", "Switches"), so the product page offers each brand, then the
        // classes of that brand, then only the sizes made in that brand + class. Each choice opens that variant's own page.
        var perBrandTypes = await CatalogStructure.PerBrandTypeIdsAsync(_db, ct);
        var shared = Shared(p, perBrandTypes);
        var familyKey = FamilyKey(p);
        var family = SameFamily(Visible(v), p, shared, familyKey);
        var relatedPool = Visible(v).Where(x => x.Id != p.Id && !family.Any(f => f.Id == x.Id) &&
                                                (p.SubCategoryId != null ? x.SubCategoryId == p.SubCategoryId : x.CategoryId == p.CategoryId));
        var related = await WithCardData(FirstOfEachFamily(relatedPool, perBrandTypes))
            .OrderBy(x => x.Sequence).Take(8).AsSplitQuery().ToListAsync(ct);
        var relatedCards = await WithFamilyInfoAsync(related.Select(r => ToCard(r, v)).ToList(), v, ct, null, perBrandTypes);

        var members = await family.Include(x => x.Brand).OrderBy(x => x.Sequence).ThenBy(x => x.Id).ToListAsync(ct);
        if (members.All(x => x.Id != p.Id)) members.Insert(0, p);
        var axes = FamilyAxes.Build(p, members, narrow: shared, classLabel: CatalogStructure.ClassLabel(p.ProductType, p.Category.Name));
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
            p.CatalogFamily?.Name ?? p.VariantFamily, p.VariantLabel == null ? null : Variants.Display(p.VariantLabel), variants, WithAttributes(SpecDto.Parse(p.Specs), p, axes), axes, CatalogStructure.Fields(p));
    }

    /// <summary>Adds Module / Color / Series / Current Rating to the specifications when they are set (empty ones are left out;
    /// a spec line with the same name already written by the store wins). An attribute that is an option row on this page
    /// (whether its value is shared or differs across variants) is shown there, so it is not repeated as a specification.</summary>
    private static List<SpecDto> WithAttributes(List<SpecDto> specs, Product p, List<VariantAxisDto> axes)
    {
        foreach (var (name, value) in ProductAttributes.Specs(p))
            if (!specs.Any(s => string.Equals(s.Name, name, StringComparison.OrdinalIgnoreCase)) &&
                !axes.Any(a => string.Equals(a.Name, name, StringComparison.OrdinalIgnoreCase)))
                specs.Add(new SpecDto(name, value));
        return specs;
    }

    private static string LocalName(Product p, string lang) =>
        lang == "en" ? p.Name : p.Translations.FirstOrDefault(t => t.LanguageCode == lang)?.Name ?? p.Name;
}
