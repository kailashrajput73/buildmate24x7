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

public interface IPackageSnapshot
{
    string PurchaseUnit { get; set; }
    decimal? PackSizeSnapshot { get; set; }
    decimal? PackMrpSnapshot { get; set; }
    decimal? BoxPriceSnapshot { get; set; }
    string? BaseUnitSnapshot { get; set; }
}
