using BuildMate.Domain.Common;

namespace BuildMate.Domain.Entities;

public class ProductType : AuditableEntity
{
    public long CategoryId { get; set; }
    public Category Category { get; set; } = default!;
    public string Name { get; set; } = "";
    public string Key { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    /// <summary>
    /// One listing card per product family for all brands together ("CPVC PIPE"), and the product page offers every
    /// brand of that family. Null = automatic: on for Pipe &amp; Fitting categories and for the Cable type in Electrical.
    /// </summary>
    public bool? GroupAcrossBrands { get; set; }
    /// <summary>Name shown for the Class option, e.g. "Color" for cables. Null = automatic ("Color" for Electrical › Cable, else "Class").</summary>
    public string? ClassLabel { get; set; }
    public ICollection<ProductTypeSubCategory> SubCategories { get; set; } = new List<ProductTypeSubCategory>();
}

public class ProductTypeSubCategory
{
    public long ProductTypeId { get; set; }
    public ProductType ProductType { get; set; } = default!;
    public long SubCategoryId { get; set; }
    public SubCategory SubCategory { get; set; } = default!;
}

/// <summary>Stable family identity, scoped by category and brand. Display names are editable.</summary>
public class CatalogFamily : AuditableEntity
{
    public long CategoryId { get; set; }
    public Category Category { get; set; } = default!;
    public long BrandId { get; set; }
    public Brand Brand { get; set; } = default!;
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string? ImageUrl { get; set; }
}

/// <summary>
/// Card photo for a family shown once for all brands ("CPVC PIPE"). Keyed by category, type and family key;
/// set from the dashboard, never from the import. Brand families keep their own images for product pages.
/// </summary>
public class CatalogFamilyCard : AuditableEntity
{
    public long CategoryId { get; set; }
    public Category Category { get; set; } = default!;
    public long ProductTypeId { get; set; }
    public ProductType ProductType { get; set; } = default!;
    public string Key { get; set; } = "";
    public string? ImageUrl { get; set; }
}

public interface IPackageSnapshot
{
    string PurchaseUnit { get; set; }
    decimal? PackSizeSnapshot { get; set; }
    decimal? PackMrpSnapshot { get; set; }
    decimal? BoxPriceSnapshot { get; set; }
    string? BaseUnitSnapshot { get; set; }
}
