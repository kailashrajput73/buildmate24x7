using BuildMate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BuildMate.Data.Configurations;

public class ProductTypeConfig : IEntityTypeConfiguration<ProductType>
{
    public void Configure(EntityTypeBuilder<ProductType> e)
    {
        e.Property(x => x.Name).HasMaxLength(120);
        e.Property(x => x.Key).HasMaxLength(120);
        e.HasIndex(x => new { x.CategoryId, x.Key }).IsUnique();
        e.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
    }
}
public class ProductTypeSubCategoryConfig : IEntityTypeConfiguration<ProductTypeSubCategory>
{
    public void Configure(EntityTypeBuilder<ProductTypeSubCategory> e)
    {
        e.HasKey(x => new { x.ProductTypeId, x.SubCategoryId });
        e.HasOne(x => x.ProductType).WithMany(x => x.SubCategories).HasForeignKey(x => x.ProductTypeId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.SubCategory).WithMany().HasForeignKey(x => x.SubCategoryId).OnDelete(DeleteBehavior.Restrict);
    }
}
public class CatalogFamilyConfig : IEntityTypeConfiguration<CatalogFamily>
{
    public void Configure(EntityTypeBuilder<CatalogFamily> e)
    {
        e.Property(x => x.Name).HasMaxLength(200);
        e.Property(x => x.Key).HasMaxLength(200);
        e.Property(x => x.ImageUrl).HasMaxLength(2048);
        e.HasIndex(x => new { x.CategoryId, x.BrandId, x.Key }).IsUnique();
        e.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Brand).WithMany().HasForeignKey(x => x.BrandId).OnDelete(DeleteBehavior.Restrict);
    }
}
