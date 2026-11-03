using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Catalog;

public record CatalogInput(long? TypeId = null, string? Class = null, string? ProductFamily = null,
    string? Size = null, string? Length = null, decimal? PackSize = null, decimal? PackMrp = null,
    string BoxDiscountType = "None", decimal BoxDiscountValue = 0, long? FamilyId = null);
public record CatalogFields(long? TypeId, string? TypeName, string? Class, long? FamilyId, string? ProductFamily,
    string? FamilyImageUrl, string? Size, decimal? SizeValue, string? SizeUnit, string? SizeDimension,
    decimal? SizeNormalized, string? Length, decimal? LengthValue, string? LengthUnit, decimal? LengthNormalized,
    decimal? PackSize, decimal? PackMrp, string BoxDiscountType, decimal BoxDiscountValue, decimal? BoxPrice);
public record TypeInput(long CategoryId, string Name, int SortOrder, bool IsActive, List<long> SubCategoryIds,
    bool? GroupAcrossBrands = null, string? ClassLabel = null);
/// <summary>
/// <paramref name="AllBrands"/> / <paramref name="ClassLabel"/> are what the shop uses (setting or automatic rule);
/// <paramref name="GroupAcrossBrandsSetting"/> / <paramref name="ClassLabelSetting"/> are the saved admin settings (null = automatic).
/// </summary>
public record TypeDto(long Id, long CategoryId, string Name, int SortOrder, bool IsActive, List<long> SubCategoryIds,
    bool AllBrands = false, string ClassLabel = "Class", bool? GroupAcrossBrandsSetting = null, string? ClassLabelSetting = null);
public record FamilyCardInput(long CategoryId, long TypeId, string FamilyKey, string? ImageUrl);
/// <summary>One family as shown once for all brands of a type, with its card photo.</summary>
public record FamilyCardDto(long CategoryId, long TypeId, string TypeName, string Key, string Name, string Title, int BrandCount, string? ImageUrl);
public record FamilyInput(long CategoryId, long BrandId, string Name, string? ImageUrl);
public record FamilyDto(long Id, long CategoryId, long BrandId, string Key, string Name, string? ImageUrl);
public record Facet(string Value, int Count);
public record IdFacet(long Id, string Name, int Count);
public record CatalogFacets(List<IdFacet> Types, List<IdFacet> SubCategories, List<IdFacet> Brands,
    List<Facet> Classes, List<Facet> Sizes, List<Facet> Lengths);

public static class CatalogStructure
{
    public static string Key(string name) => name.Trim().ToUpperInvariant();

    // ---- One card for all brands (PDF "UI flow for Pipe & Fitting / Electrical cable") --------------------------------
    private static bool IsPipeCategory(string category) => category.Contains("pipe", StringComparison.OrdinalIgnoreCase);
    private static bool IsElectricalCable(string category, string typeKey) =>
        category.Contains("electric", StringComparison.OrdinalIgnoreCase) && typeKey.Trim().ToUpperInvariant() is "CABLE" or "CABLES";
    /// <summary>Automatic rule when the admin hasn't chosen: Pipe &amp; Fitting (every type) and Electrical › Cable.</summary>
    public static bool AllBrands(ProductType t, string categoryName) => t.GroupAcrossBrands ?? (IsPipeCategory(categoryName) || IsElectricalCable(categoryName, t.Key));
    public static string ClassLabel(ProductType? t, string categoryName) =>
        t == null ? "Class" : t.ClassLabel ?? (IsElectricalCable(categoryName, t.Key) ? "Color" : "Class");

    /// <summary>Ids of the types whose families are shown once for all brands.</summary>
    public static async Task<List<long>> AllBrandTypeIdsAsync(AppDbContext db, CancellationToken ct)
    {
        var types = await db.ProductTypes.AsNoTracking().Select(t => new { Type = t, Category = t.Category.Name }).ToListAsync(ct);
        return types.Where(t => AllBrands(t.Type, t.Category)).Select(t => t.Type.Id).ToList();
    }

    /// <summary>"CPVC" + "PIPE" → "CPVC PIPE"; a family that already names its type ("CPVC Pipe") is kept as is.</summary>
    public static string CardTitle(string? typeName, string familyName)
    {
        if (string.IsNullOrWhiteSpace(typeName)) return familyName;
        var words = familyName.Split(new[] { ' ', '-', '/' }, StringSplitOptions.RemoveEmptyEntries);
        return words.Any(w => string.Equals(w, typeName.Trim(), StringComparison.OrdinalIgnoreCase)) ? familyName : $"{typeName.Trim()} {familyName}";
    }

    /// <summary>Store order of pipe materials when Sort order is equal: UPVC, CPVC, PVC, then A–Z.</summary>
    public static IOrderedQueryable<ProductType> InStoreOrder(IQueryable<ProductType> q) => q.OrderBy(t => t.SortOrder)
        .ThenBy(t => t.Key == "UPVC" ? 0 : t.Key == "CPVC" ? 1 : t.Key == "PVC" ? 2 : 100).ThenBy(t => t.Name);

    public static TypeDto ToDto(ProductType t, string categoryName, List<long> subCategoryIds, bool? isActive = null) =>
        new(t.Id, t.CategoryId, t.Name, t.SortOrder, isActive ?? t.IsActive, subCategoryIds,
            AllBrands(t, categoryName), ClassLabel(t, categoryName), t.GroupAcrossBrands, t.ClassLabel);
    public static string? Image(Product p) => p.ImageUrls.FirstOrDefault() ?? p.CatalogFamily?.ImageUrl;
    public static CatalogFields Fields(Product p) => new(p.ProductTypeId, p.ProductType?.Name, p.ProductClass,
        p.CatalogFamilyId, p.CatalogFamily?.Name ?? p.VariantFamily, p.CatalogFamily?.ImageUrl,
        p.Size, p.SizeValue, p.SizeUnit, p.SizeDimension, p.SizeNormalized, p.Length, p.LengthValue, p.LengthUnit, p.LengthNormalized,
        p.PackSize, p.PackSize is > 0 ? Packaging.Mrp(p) : null, p.BoxDiscountType, p.BoxDiscountValue,
        p.PackSize is > 0 ? Packaging.Price(p) : null);

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

    public static IQueryable<Product> Filter(IQueryable<Product> q, long? typeId, string? cls, long? familyId, string? size, string? length)
    {
        if (typeId != null) q = q.Where(p => p.ProductTypeId == typeId);
        if (!string.IsNullOrWhiteSpace(cls)) q = q.Where(p => p.ProductClass == cls);
        if (familyId != null) q = q.Where(p => p.CatalogFamilyId == familyId);
        if (!string.IsNullOrWhiteSpace(size)) q = q.Where(p => p.Size == size);
        if (!string.IsNullOrWhiteSpace(length)) q = q.Where(p => p.Length == length);
        return q;
    }
}
