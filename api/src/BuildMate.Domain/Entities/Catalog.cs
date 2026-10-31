using BuildMate.Domain.Common;

namespace BuildMate.Domain.Entities;

public class Category : AuditableEntity
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<SubCategory> SubCategories { get; set; } = new List<SubCategory>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
}

public class SubCategory : AuditableEntity
{
    public long CategoryId { get; set; }
    public Category Category { get; set; } = default!;
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}

public class Brand : AuditableEntity
{
    public string Name { get; set; } = default!;
    public string? LogoUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}

public class Product : AuditableEntity
{
    /// <summary>Supplier/store code from the import sheet (e.g. C1115CKG), or auto-generated BM000123. Encoded in the product QR code.</summary>
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }

    /// <summary>
    /// Products sharing a family are sizes of the same item (e.g. "King CPVC Coupler SDR 11").
    /// Listings show one card per family; the product page shows a size picker.
    /// </summary>
    public string? VariantFamily { get; set; }
    public long? ProductTypeId { get; set; }
    public ProductType? ProductType { get; set; }
    public long? CatalogFamilyId { get; set; }
    public CatalogFamily? CatalogFamily { get; set; }
    public string? ProductClass { get; set; }
    public string? Size { get; set; }
    public decimal? SizeValue { get; set; }
    public string? SizeUnit { get; set; }
    public string? SizeDimension { get; set; }
    public decimal? SizeNormalized { get; set; }
    public string? Length { get; set; }
    public decimal? LengthValue { get; set; }
    public string? LengthUnit { get; set; }
    public decimal? LengthNormalized { get; set; }
    public decimal? PackSize { get; set; }
    public decimal? PackMrp { get; set; }
    public string BoxDiscountType { get; set; } = "None";
    public decimal BoxDiscountValue { get; set; }

    /// <summary>What the size picker shows for this product, e.g. 20 mm (¾").</summary>
    public string? VariantLabel { get; set; }
    /// <summary>Specifications shown on the product page, each "Name: Value", in display order.</summary>
    public List<string> Specs { get; set; } = new();

    public long CategoryId { get; set; }
    public Category Category { get; set; } = default!;
    public long? SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }
    public long BrandId { get; set; }
    public Brand Brand { get; set; } = default!;

    /// <summary>Manufacturer barcode (EAN/UPC) if printed on the product.</summary>
    public string? Barcode { get; set; }
    public string Unit { get; set; } = "pcs";
    public string? HsnCode { get; set; }
    public decimal GstRate { get; set; } = 18m;

    public decimal Mrp { get; set; }
    /// <summary>Base selling price (GST inclusive) before discounts.</summary>
    public decimal ListPrice { get; set; }
    /// <summary>"Regular discount" shown to referral partners in the app.</summary>
    public decimal PartnerDiscountPercent { get; set; }
    /// <summary>Discount shown to retail customers on the website.</summary>
    public decimal RetailDiscountPercent { get; set; }
    public decimal RewardPointsPerUnit { get; set; }

    /// <summary>Reorder level (ROL); a low-stock alert fires at or below this.</summary>
    public decimal ReorderLevel { get; set; }
    public int Sequence { get; set; }

    /// <summary>Physical stock on hand. Only changed via StockService (ledgered).</summary>
    public decimal StockQty { get; set; }
    /// <summary>Quantity committed to paid-but-not-dispatched orders.</summary>
    public decimal ReservedQty { get; set; }
    /// <summary>Weighted average purchase cost, used for inventory valuation.</summary>
    public decimal AverageCost { get; set; }

    /// <summary>
    /// When this product last left the store on a successful dispatch/handover (Dispatch.DispatchedAt, UTC).
    /// Set only by the dispatch workflow and only ever moved forward. Null = never dispatched.
    /// Returns and stock adjustments never change it. Drives the Fast / Slow / Non-moving classification.
    /// </summary>
    public DateTime? LastDispatchedAt { get; set; }
    /// <summary>
    /// First stock receipt (purchase, opening stock or stock-in adjustment), UTC. The aging reference for products
    /// that have never been dispatched; when null, the product's CreatedAt is used.
    /// </summary>
    public DateTime? AgingFromAt { get; set; }

    public List<string> ImageUrls { get; set; } = new();
    public bool IsActive { get; set; } = true;
    public bool ShowOnWeb { get; set; } = true;
    public bool ShowOnApp { get; set; } = true;

    public ICollection<ProductAlias> Aliases { get; set; } = new List<ProductAlias>();
    public ICollection<ProductTranslation> Translations { get; set; } = new List<ProductTranslation>();
    public ICollection<ProductGroupItem> GroupItems { get; set; } = new List<ProductGroupItem>();
    public ICollection<ProductLocation> Locations { get; set; } = new List<ProductLocation>();

    public decimal AvailableQty => StockQty - ReservedQty;
}

/// <summary>Alternate / local names used for search ("tap", "nal", "tonti").</summary>
public class ProductAlias : BaseEntity
{
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public string Alias { get; set; } = default!;
}

/// <summary>Product name in another language (hi, gu, mr, ...).</summary>
public class ProductTranslation : BaseEntity
{
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public string LanguageCode { get; set; } = default!;
    public string Name { get; set; } = default!;
}

public class ProductGroup : AuditableEntity
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<ProductGroupItem> Items { get; set; } = new List<ProductGroupItem>();
}

public class ProductGroupItem
{
    public long ProductGroupId { get; set; }
    public ProductGroup ProductGroup { get; set; } = default!;
    public long ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public int SortOrder { get; set; }
}
