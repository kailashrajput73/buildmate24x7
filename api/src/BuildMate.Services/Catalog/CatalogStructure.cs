using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Catalog;

public record CatalogInput(long? TypeId = null, string? Class = null, string? ProductFamily = null,
    string? Size = null, string? Length = null, decimal? PackSize = null, decimal? PackMrp = null,
    string BoxDiscountType = "None", decimal BoxDiscountValue = 0, long? FamilyId = null,
    string? Module = null, string? Color = null, string? Series = null, string? CurrentRating = null);
public record CatalogFields(long? TypeId, string? TypeName, string? Class, long? FamilyId, string? ProductFamily,
    string? FamilyImageUrl, string? Size, decimal? SizeValue, string? SizeUnit, string? SizeDimension,
    decimal? SizeNormalized, string? Length, decimal? LengthValue, string? LengthUnit, decimal? LengthNormalized,
    decimal? PackSize, decimal? PackMrp, string BoxDiscountType, decimal BoxDiscountValue, decimal? BoxPrice,
    string? Module = null, string? Color = null, string? Series = null, string? CurrentRating = null);
public record TypeInput(long CategoryId, string Name, int SortOrder, bool IsActive, List<long> SubCategoryIds,
    bool? GroupAcrossBrands = null, string? ClassLabel = null, string? ImageUrl = null);
/// <summary>
/// <paramref name="AllBrands"/> / <paramref name="ClassLabel"/> are what the shop uses (setting or automatic rule);
/// <paramref name="GroupAcrossBrandsSetting"/> / <paramref name="ClassLabelSetting"/> are the saved admin settings (null = automatic).
/// </summary>
public record TypeDto(long Id, long CategoryId, string Name, int SortOrder, bool IsActive, List<long> SubCategoryIds,
    bool AllBrands = false, string ClassLabel = "Class", bool? GroupAcrossBrandsSetting = null, string? ClassLabelSetting = null,
    string? ImageUrl = null);
public record FamilyCardInput(long CategoryId, long TypeId, string FamilyKey, string? ImageUrl);
/// <summary>One family as shown once for all brands of a type, with its card photo.</summary>
public record FamilyCardDto(long CategoryId, long TypeId, string TypeName, string Key, string Name, string Title, int BrandCount, string? ImageUrl);
public record FamilyInput(long CategoryId, long BrandId, string Name, string? ImageUrl);
public record FamilyDto(long Id, long CategoryId, long BrandId, string Key, string Name, string? ImageUrl);
public record Facet(string Value, int Count);
public record IdFacet(long Id, string Name, int Count);
/// <summary>Filter values of one product attribute (Module, Color, …); <paramref name="Key"/> is its query parameter.</summary>
public record AttributeFacet(string Key, string Name, List<Facet> Values);
public record CatalogFacets(List<IdFacet> Types, List<IdFacet> SubCategories, List<IdFacet> Brands,
    List<Facet> Classes, List<Facet> Sizes, List<Facet> Lengths, List<AttributeFacet>? Attributes = null);

public static class CatalogStructure
{
    public static string Key(string name) => name.Trim().ToUpperInvariant();

    // ---- One card per product family for all brands (every module) ------------------------------------------------------
    // Family identity = category + Type + family key (the family name in capitals). The brand is NOT part of it, so
    // "Switches" of WIT and of Anchor is one card and the product page offers both brands — the same way as "CPVC PIPE".
    private static bool IsElectricalCable(string category, string typeKey) =>
        category.Contains("electric", StringComparison.OrdinalIgnoreCase) && typeKey.Trim().ToUpperInvariant() is "CABLE" or "CABLES";
    /// <summary>
    /// One card for all brands unless the admin set "One card per brand" for this Type (Dashboard › Types &amp; families).
    /// The automatic rule is the same for every module — no category, brand or family names are coded here.
    /// </summary>
    public static bool AllBrands(ProductType t, string categoryName) => t.GroupAcrossBrands ?? true;
    public static string ClassLabel(ProductType? t, string categoryName) =>
        t == null ? "Class" : t.ClassLabel ?? (IsElectricalCable(categoryName, t.Key) ? "Color" : "Class");

    /// <summary>Ids of the types whose families are shown once for all brands.</summary>
    public static async Task<List<long>> AllBrandTypeIdsAsync(AppDbContext db, CancellationToken ct)
    {
        var types = await db.ProductTypes.AsNoTracking().Select(t => new { Type = t, Category = t.Category.Name }).ToListAsync(ct);
        return types.Where(t => AllBrands(t.Type, t.Category)).Select(t => t.Type.Id).ToList();
    }

    /// <summary>Ids of the types the admin set to "One card per brand" (their families stay per brand, as before).</summary>
    public static async Task<List<long>> PerBrandTypeIdsAsync(AppDbContext db, CancellationToken ct)
    {
        var types = await db.ProductTypes.AsNoTracking().Select(t => new { Type = t, Category = t.Category.Name }).ToListAsync(ct);
        return types.Where(t => !AllBrands(t.Type, t.Category)).Select(t => t.Type.Id).ToList();
    }

    /// <summary>
    /// "CPVC" + "PIPE" → "CPVC PIPE". A family that already names its type is kept as is ("CPVC Pipe", or "Switches"
    /// for the type "Switch" / "Modular Switches" — singular and plural count as the same word).
    /// </summary>
    public static string CardTitle(string? typeName, string familyName)
    {
        if (string.IsNullOrWhiteSpace(typeName)) return familyName;
        static string[] Words(string x) => x.Split(new[] { ' ', '-', '/', '&', ',' }, StringSplitOptions.RemoveEmptyEntries);
        static bool Same(string a, string b)
        {
            a = a.ToLowerInvariant(); b = b.ToLowerInvariant();
            return a == b || a + "s" == b || b + "s" == a || a + "es" == b || b + "es" == a;
        }
        var family = Words(familyName);
        var type = typeName.Trim();
        var named = family.Any(w => string.Equals(w, type, StringComparison.OrdinalIgnoreCase))
                    || Words(type).Any(t => t.Length > 2 && family.Any(w => Same(w, t)));
        return named ? familyName : $"{type} {familyName}";
    }

    /// <summary>Store order of pipe materials when Sort order is equal: UPVC, CPVC, PVC, then A–Z.</summary>
    public static IOrderedQueryable<ProductType> InStoreOrder(IQueryable<ProductType> q) => q.OrderBy(t => t.SortOrder)
        .ThenBy(t => t.Key == "UPVC" ? 0 : t.Key == "CPVC" ? 1 : t.Key == "PVC" ? 2 : 100).ThenBy(t => t.Name);

    public static TypeDto ToDto(ProductType t, string categoryName, List<long> subCategoryIds, bool? isActive = null) =>
        new(t.Id, t.CategoryId, t.Name, t.SortOrder, isActive ?? t.IsActive, subCategoryIds,
            AllBrands(t, categoryName), ClassLabel(t, categoryName), t.GroupAcrossBrands, t.ClassLabel, t.ImageUrl);
    public static string? Image(Product p) => p.ImageUrls.FirstOrDefault() ?? p.CatalogFamily?.ImageUrl;
    public static CatalogFields Fields(Product p) => new(p.ProductTypeId, p.ProductType?.Name, p.ProductClass,
        p.CatalogFamilyId, p.CatalogFamily?.Name ?? p.VariantFamily, p.CatalogFamily?.ImageUrl,
        p.Size, p.SizeValue, p.SizeUnit, p.SizeDimension, p.SizeNormalized, p.Length, p.LengthValue, p.LengthUnit, p.LengthNormalized,
        p.PackSize, p.PackSize is > 0 ? Packaging.Mrp(p) : null, p.BoxDiscountType, p.BoxDiscountValue,
        p.PackSize is > 0 ? Packaging.Price(p) : null, p.Module, p.Color, p.Series, p.CurrentRating);

    public static async Task ApplyAsync(AppDbContext db, Product p, CatalogInput input, CancellationToken ct)
    {
        if (input.TypeId != null)
        {
            var type = await db.ProductTypes.Include(x => x.SubCategories).SingleOrDefaultAsync(x => x.Id == input.TypeId && x.IsActive && x.CategoryId == p.CategoryId, ct)
                ?? throw new AppException("Type must be an active predefined type in the selected category.");
            if (p.SubCategoryId != null && !type.SubCategories.Any(x => x.SubCategoryId == p.SubCategoryId))
                throw new AppException("Sub-Category is not assigned to this Type. Configure its master relationship first.");
        }
        p.ProductTypeId = input.TypeId;
        p.ProductClass = Clean(input.Class, 120, "Class");
        p.Module = Clean(input.Module, 60, "Module");
        p.Color = Clean(input.Color, 60, "Color");
        p.Series = Clean(input.Series, 120, "Series");
        p.CurrentRating = ProductAttributes.CurrentRating(input.CurrentRating);
        var size = CatalogMeasure.Parse(input.Size);
        var length = CatalogMeasure.Parse(input.Length, length: true);
        p.Size = size?.Display; p.SizeValue = size?.Value; p.SizeUnit = size?.Unit; p.SizeDimension = size?.Dimension; p.SizeNormalized = size?.NormalizedValue;
        p.Length = length?.Display; p.LengthValue = length?.Value; p.LengthUnit = length?.Unit; p.LengthNormalized = length?.NormalizedValue;
        p.PackSize = input.PackSize; p.PackMrp = input.PackMrp;
        p.BoxDiscountType = input.BoxDiscountType; p.BoxDiscountValue = input.BoxDiscountValue;
        Packaging.Validate(p);
        if (input.FamilyId != null)
        {
            p.CatalogFamily = await db.CatalogFamilies.SingleOrDefaultAsync(f => f.Id == input.FamilyId && f.BrandId == p.BrandId && f.CategoryId == p.CategoryId, ct)
                ?? throw new AppException("Product Family must belong to the selected brand and category.");
        }
        else if (Clean(input.ProductFamily, 200, "Product Family") is { } familyName)
        {
            var key = Key(familyName);
            p.CatalogFamily = db.CatalogFamilies.Local.FirstOrDefault(f => f.CategoryId == p.CategoryId && f.BrandId == p.BrandId && (f.Key == key || f.Name.ToUpper() == key))
                ?? await db.CatalogFamilies.SingleOrDefaultAsync(f => f.CategoryId == p.CategoryId && f.BrandId == p.BrandId && (f.Key == key || f.Name.ToUpper() == key), ct);
            if (p.CatalogFamily == null)
            {
                p.CatalogFamily = new CatalogFamily { CategoryId = p.CategoryId, BrandId = p.BrandId, Key = key, Name = familyName };
                db.CatalogFamilies.Add(p.CatalogFamily);
            }
        }
        else { p.CatalogFamily = null; p.CatalogFamilyId = null; }
        p.VariantFamily = p.CatalogFamily?.Name;
    }

    public static string? Clean(string? input, int max, string label)
    {
        var value = input?.Trim();
        if (string.IsNullOrEmpty(value)) return null;
        if (value.Length > max || value.Any(char.IsControl)) throw new AppException($"{label} must be at most {max} printable characters.");
        return value;
    }
    public static string? ImageUrl(string? input)
    {
        var value = Clean(input, 2048, "Image URL");
        if (value == null) return null;
        if (value.StartsWith("/files/", StringComparison.Ordinal) && !value.Contains('\\') && !value.Contains("..")) return value;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && uri.Scheme != "http") || !string.IsNullOrEmpty(uri.UserInfo))
            throw new AppException("Image URL must be an HTTP(S) image URL or an uploaded /files/ path.");
        return value;
    }

    public static IQueryable<Product> Filter(IQueryable<Product> q, long? typeId, string? cls, long? familyId, string? size, string? length,
        string? module = null, string? color = null, string? series = null, string? currentRating = null)
    {
        if (!string.IsNullOrWhiteSpace(module)) { var v = module.Trim(); q = q.Where(p => p.Module != null && p.Module.ToLower() == v.ToLower()); }
        if (!string.IsNullOrWhiteSpace(color)) { var v = color.Trim(); q = q.Where(p => p.Color != null && p.Color.ToLower() == v.ToLower()); }
        if (!string.IsNullOrWhiteSpace(series)) { var v = series.Trim(); q = q.Where(p => p.Series != null && p.Series.ToLower() == v.ToLower()); }
        if (!string.IsNullOrWhiteSpace(currentRating)) { var v = ProductAttributes.CurrentRating(currentRating); q = q.Where(p => p.CurrentRating == v); }
        if (typeId != null) q = q.Where(p => p.ProductTypeId == typeId);
        if (!string.IsNullOrWhiteSpace(cls)) q = q.Where(p => p.ProductClass == cls);
        if (familyId != null) q = q.Where(p => p.CatalogFamilyId == familyId);
        if (!string.IsNullOrWhiteSpace(size)) q = q.Where(p => p.Size == size);
        if (!string.IsNullOrWhiteSpace(length)) q = q.Where(p => p.Length == length);
        return q;
    }
}

/// <summary>Module / Color / Series / Current rating: validation and how they are shown as specifications.</summary>
public static class ProductAttributes
{
    public static readonly string[] CurrentRatings = { "volt", "watt", "amp" };

    /// <summary>Blank → null; "Volt"/"VOLT" → "volt"; anything other than volt, watt or amp is rejected.</summary>
    public static string? CurrentRating(string? input)
    {
        var value = input?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(value) || value is "none") return null;
        if (!CurrentRatings.Contains(value)) throw new AppException($"Current rating must be volt, watt or amp (got '{input!.Trim()}').");
        return value;
    }

    /// <summary>One product attribute shown on the shop: label, query parameter (filters) and the product's display value.</summary>
    public record Definition(string Name, string Key, Func<Product, string?> Value);

    /// <summary>
    /// THE list of product attributes the shop shows (specification row, option row on the product page, listing filter).
    /// To add an attribute later: add its column and one line here. Order = order on the product page.
    /// </summary>
    public static readonly IReadOnlyList<Definition> All = new Definition[]
    {
        new("Module", "module", p => Text(p.Module)),
        new("Color", "color", p => Text(p.Color)),
        new("Series", "series", p => Text(p.Series)),
        // Stored as volt / watt / amp; shown as Volt / Watt / Amp (no number or unit is added).
        new("Current Rating", "currentRating", p => Text(p.CurrentRating) is { } r ? char.ToUpperInvariant(r[0]) + r[1..] : null),
    };

    public static IEnumerable<string> Names => All.Select(a => a.Name);

    /// <summary>Trimmed value; empty / whitespace-only = no value (never shown).</summary>
    private static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>The non-empty fields as name/value pairs for the product page, in a fixed order.</summary>
    public static IEnumerable<(string Name, string Value)> Specs(Product p) =>
        All.Select(a => (a.Name, Value: a.Value(p))).Where(x => x.Value != null).Select(x => (x.Name, x.Value!));
}
