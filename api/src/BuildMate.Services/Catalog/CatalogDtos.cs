using BuildMate.Domain.Enums;

namespace BuildMate.Services.Catalog;

// ---------- Admin: masters
public record CategoryDto(long Id, string Name, string? Description, string? ImageUrl, int SortOrder, bool IsActive, int ProductCount, int SubCategoryCount);
public record CategoryUpsert(string Name, string? Description, string? ImageUrl, int SortOrder, bool IsActive);

public record SubCategoryDto(long Id, long CategoryId, string CategoryName, string Name, int SortOrder, bool IsActive, int ProductCount);
public record SubCategoryUpsert(long CategoryId, string Name, int SortOrder, bool IsActive);

public record BrandDto(long Id, string Name, string? LogoUrl, int SortOrder, bool IsActive, int ProductCount);
public record BrandUpsert(string Name, string? LogoUrl, int SortOrder, bool IsActive);

public record MasterQuery(string? Search, bool? IsActive, long? CategoryId, int Page = 1, int PageSize = 50);

// ---------- Admin: products
public record ProductUpsert(
    string Name, string? Description, long CategoryId, long? SubCategoryId, long BrandId,
    string? Barcode, string Unit, string? HsnCode, decimal GstRate,
    decimal Mrp, decimal ListPrice, decimal PartnerDiscountPercent, decimal RetailDiscountPercent,
    decimal RewardPointsPerUnit, decimal ReorderLevel, int Sequence,
    List<string>? ImageUrls, bool IsActive, bool ShowOnWeb, bool ShowOnApp,
    List<string>? Aliases, Dictionary<string, string>? Translations, List<long>? GroupIds,
    string? VariantFamily = null, string? VariantLabel = null, List<string>? Specs = null, CatalogInput? Catalog = null);

public record ProductAdminDto(
    long Id, string Code, string Name, string? Description,
    long CategoryId, string CategoryName, long? SubCategoryId, string? SubCategoryName, long BrandId, string BrandName,
    string? Barcode, string Unit, string? HsnCode, decimal GstRate,
    decimal Mrp, decimal ListPrice, decimal PartnerDiscountPercent, decimal RetailDiscountPercent,
    decimal PartnerPrice, decimal RetailPrice, decimal RewardPointsPerUnit,
    decimal ReorderLevel, int Sequence, decimal StockQty, decimal ReservedQty, decimal AvailableQty, decimal AverageCost,
    bool IsLowStock, List<string> ImageUrls, bool IsActive, bool ShowOnWeb, bool ShowOnApp,
    List<string> Aliases, Dictionary<string, string> Translations, List<long> GroupIds, List<string> RackLocations,
    DateTime CreatedAt, DateTime UpdatedAt,
    string? VariantFamily, string? VariantLabel, List<string> Specs,
    // Movement classification (see Inventory.ProductMovement), as of today in India time.
    MovementCategory Movement, int DaysSinceMovement, bool NeverDispatched, DateTime? LastDispatchedAt, CatalogFields? Catalog = null);

public record ProductAdminQuery(
    string? Search, long? CategoryId, long? SubCategoryId, long? BrandId, long? GroupId,
    bool? IsActive, bool? LowStockOnly, string? Sort, int Page = 1, int PageSize = 25,
    MovementCategory? Movement = null, bool? NeverDispatched = null, long? TypeId = null, string? Class = null, long? FamilyId = null, string? Size = null, string? Length = null, string? Ids = null);

public record ProductLookupDto(long Id, string Code, string Name, string BrandName, string Unit, decimal ListPrice,
    decimal PartnerDiscountPercent, decimal RetailDiscountPercent, decimal GstRate, decimal AvailableQty, decimal StockQty,
    string? ImageUrl, List<string> RackLocations);

// ---------- Admin: product groups
public record ProductGroupDto(long Id, string Name, string? Description, string? ImageUrl, int SortOrder, bool IsActive, int ProductCount, List<long> ProductIds);
public record ProductGroupUpsert(string Name, string? Description, string? ImageUrl, int SortOrder, bool IsActive, List<long> ProductIds);

// ---------- Public catalogue (web + app)
public record CatalogQuery(
    string? Q, long? CategoryId, long? SubCategoryId, long? BrandId, long? GroupId,
    bool? InStock, bool? Discounted, string? Sort, int Page = 1, int PageSize = 24,
    // Collapse: one card per size family instead of one per size.
    bool? Collapse = null, long? TypeId = null, string? Class = null, long? FamilyId = null, string? Size = null, string? Length = null);

public record ProductCardDto(
    long Id, string Code, string Name, string BrandName, long CategoryId, string Unit, string? ImageUrl,
    decimal Mrp, decimal ListPrice, decimal DiscountPercent, decimal Price, bool InStock, decimal? RewardPoints,
    string? Family = null, string? VariantLabel = null, int VariantCount = 1, decimal? FromPrice = null,
    string? VariantSummary = null, CatalogFields? Catalog = null);

public record ProductDetailDto(
    long Id, string Code, string Name, string? Description, long BrandId, string BrandName,
    long CategoryId, string CategoryName, long? SubCategoryId, string? SubCategoryName,
    string Unit, string? HsnCode, decimal GstRate, List<string> ImageUrls,
    decimal Mrp, decimal ListPrice, decimal DiscountPercent, decimal Price, bool InStock, decimal MaxOrderQty,
    decimal? RewardPoints, List<string> OtherNames, List<ProductCardDto> Related,
    string? Family, string? VariantLabel, List<VariantOptionDto> Variants, List<SpecDto> Specs,
    List<VariantAxisDto> VariantAxes, CatalogFields? Catalog = null);

/// <summary>One size in a product's family, for the size picker.</summary>
public record VariantOptionDto(long Id, string Code, string Label, decimal Mrp, decimal Price, bool InStock);
public record SpecDto(string Name, string Value)
{
    public static List<SpecDto> Parse(IEnumerable<string> specs) => specs
        .Select(s => s.Split(':', 2))
        .Where(p => p.Length == 2 && p[0].Trim().Length > 0 && p[1].Trim().Length > 0)
        .Select(p => new SpecDto(p[0].Trim(), p[1].Trim())).ToList();
}

/// <summary>
/// One sellable product with its specifications as a map, for screens that group and filter a whole category on the
/// device (the website's pipes & fittings browser, the app's category screen). One row per size — not collapsed.
/// </summary>
public record CatalogItemDto(long Id, string Code, string Name, string BrandName, long BrandId, long? SubCategoryId, string? SubCategoryName,
    string Unit, string? ImageUrl, decimal Mrp, decimal ListPrice, decimal DiscountPercent, decimal Price, bool InStock, decimal? RewardPoints,
    string? Family, string? VariantLabel, Dictionary<string, string> Specs, int Sequence, CatalogFields? Catalog = null);

public record CategoryTreeDto(long Id, string Name, string? ImageUrl, int ProductCount, List<SubCategoryRefDto> SubCategories);
public record SubCategoryRefDto(long Id, string Name);
public record BrandRefDto(long Id, string Name, string? LogoUrl);
public record GroupRefDto(long Id, string Name, string? ImageUrl);

public enum ClientChannel { Web, App }

/// <summary>Who is browsing determines price (partner vs retail) and visibility (web vs app).</summary>
public record Viewer(ClientChannel Channel, CustomerKind Kind, string Lang)
{
    public static Viewer Retail(ClientChannel ch, string lang = "en") => new(ch, CustomerKind.Retail, lang);
}
