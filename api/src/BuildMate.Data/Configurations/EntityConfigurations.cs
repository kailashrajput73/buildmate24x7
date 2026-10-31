using BuildMate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BuildMate.Data.Configurations;

internal static class Money
{
    public static PropertyBuilder<decimal> IsMoney(this PropertyBuilder<decimal> p) => p.HasPrecision(14, 2);
    public static PropertyBuilder<decimal> IsQty(this PropertyBuilder<decimal> p) => p.HasPrecision(14, 3);
    public static PropertyBuilder<decimal> IsPercent(this PropertyBuilder<decimal> p) => p.HasPrecision(6, 2);
}

public class CategoryConfig : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> e)
    {
        e.Property(x => x.Name).HasMaxLength(120).IsRequired();
        e.HasIndex(x => x.Name).IsUnique();
    }
}

public class SubCategoryConfig : IEntityTypeConfiguration<SubCategory>
{
    public void Configure(EntityTypeBuilder<SubCategory> e)
    {
        e.Property(x => x.Name).HasMaxLength(120).IsRequired();
        e.HasIndex(x => new { x.CategoryId, x.Name }).IsUnique();
        e.HasOne(x => x.Category).WithMany(c => c.SubCategories).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class BrandConfig : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> e)
    {
        e.Property(x => x.Name).HasMaxLength(120).IsRequired();
        e.HasIndex(x => x.Name).IsUnique();
    }
}

public class ProductConfig : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> e)
    {
        e.Property(x => x.Code).HasMaxLength(20).IsRequired();
        e.HasIndex(x => x.Code).IsUnique();
        e.HasIndex(x => x.Barcode);
        e.Property(x => x.Name).HasMaxLength(250).IsRequired();
        e.Property(x => x.VariantFamily).HasMaxLength(200);
        e.Property(x => x.ProductClass).HasMaxLength(120);
        e.Property(x => x.Size).HasMaxLength(120);
        e.Property(x => x.Length).HasMaxLength(120);
        e.Property(x => x.SizeUnit).HasMaxLength(40);
        e.Property(x => x.LengthUnit).HasMaxLength(40);
        e.Property(x => x.SizeDimension).HasMaxLength(20);
        e.Property(x => x.SizeValue).HasPrecision(20, 6);
        e.Property(x => x.LengthValue).HasPrecision(20, 6);
        e.Property(x => x.SizeNormalized).HasPrecision(24, 6);
        e.Property(x => x.LengthNormalized).HasPrecision(24, 6);
        e.Property(x => x.PackSize).HasPrecision(14, 3);
        e.Property(x => x.PackMrp).HasPrecision(14, 2);
        e.Property(x => x.BoxDiscountValue).HasPrecision(14, 2);
        e.Property(x => x.BoxDiscountType).HasMaxLength(20).HasDefaultValue("None");
        e.HasOne(x => x.ProductType).WithMany().HasForeignKey(x => x.ProductTypeId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.CatalogFamily).WithMany().HasForeignKey(x => x.CatalogFamilyId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => new { x.CategoryId, x.ProductTypeId, x.SubCategoryId, x.BrandId });
        e.HasIndex(x => new { x.CatalogFamilyId, x.Sequence });
        e.HasIndex(x => x.ProductClass);

        e.Property(x => x.VariantLabel).HasMaxLength(100);
        e.HasIndex(x => new { x.VariantFamily, x.Sequence });
        e.Property(x => x.Unit).HasMaxLength(20);
        e.Property(x => x.HsnCode).HasMaxLength(12);
        e.Property(x => x.GstRate).IsPercent();
        e.Property(x => x.Mrp).IsMoney();
        e.Property(x => x.ListPrice).IsMoney();
        e.Property(x => x.PartnerDiscountPercent).IsPercent();
        e.Property(x => x.RetailDiscountPercent).IsPercent();
        e.Property(x => x.RewardPointsPerUnit).HasPrecision(10, 2);
        e.Property(x => x.ReorderLevel).IsQty();
        e.Property(x => x.StockQty).IsQty();
        e.Property(x => x.ReservedQty).IsQty();
        e.Property(x => x.AverageCost).HasPrecision(14, 4);
        e.Ignore(x => x.AvailableQty);
        e.HasIndex(x => x.LastDispatchedAt);
        e.HasIndex(x => x.AgingFromAt);

        e.HasOne(x => x.Category).WithMany(c => c.Products).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.SubCategory).WithMany(c => c.Products).HasForeignKey(x => x.SubCategoryId).OnDelete(DeleteBehavior.SetNull);
        e.HasOne(x => x.Brand).WithMany(c => c.Products).HasForeignKey(x => x.BrandId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => new { x.IsActive, x.Sequence });
    }
}

public class ProductAliasConfig : IEntityTypeConfiguration<ProductAlias>
{
    public void Configure(EntityTypeBuilder<ProductAlias> e)
    {
        e.Property(x => x.Alias).HasMaxLength(150).IsRequired();
        e.HasIndex(x => x.Alias);
        e.HasOne(x => x.Product).WithMany(p => p.Aliases).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProductTranslationConfig : IEntityTypeConfiguration<ProductTranslation>
{
    public void Configure(EntityTypeBuilder<ProductTranslation> e)
    {
        e.Property(x => x.LanguageCode).HasMaxLength(8).IsRequired();
        e.Property(x => x.Name).HasMaxLength(250).IsRequired();
        e.HasIndex(x => new { x.ProductId, x.LanguageCode }).IsUnique();
        e.HasOne(x => x.Product).WithMany(p => p.Translations).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProductGroupConfig : IEntityTypeConfiguration<ProductGroup>
{
    public void Configure(EntityTypeBuilder<ProductGroup> e)
    {
        e.Property(x => x.Name).HasMaxLength(120).IsRequired();
        e.HasIndex(x => x.Name).IsUnique();
    }
}

public class ProductGroupItemConfig : IEntityTypeConfiguration<ProductGroupItem>
{
    public void Configure(EntityTypeBuilder<ProductGroupItem> e)
    {
        e.HasKey(x => new { x.ProductGroupId, x.ProductId });
        e.HasOne(x => x.ProductGroup).WithMany(g => g.Items).HasForeignKey(x => x.ProductGroupId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.Product).WithMany(p => p.GroupItems).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class RackConfig : IEntityTypeConfiguration<Rack>
{
    public void Configure(EntityTypeBuilder<Rack> e)
    {
        e.Property(x => x.Code).HasMaxLength(10).IsRequired();
        e.HasIndex(x => x.Code).IsUnique();
    }
}

public class RackLocationConfig : IEntityTypeConfiguration<RackLocation>
{
    public void Configure(EntityTypeBuilder<RackLocation> e)
    {
        e.Property(x => x.Label).HasMaxLength(20).IsRequired();
        e.HasIndex(x => x.Label).IsUnique();
        e.HasOne(x => x.Rack).WithMany(r => r.Locations).HasForeignKey(x => x.RackId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProductLocationConfig : IEntityTypeConfiguration<ProductLocation>
{
    public void Configure(EntityTypeBuilder<ProductLocation> e)
    {
        e.Property(x => x.Quantity).IsQty();
        e.HasIndex(x => new { x.ProductId, x.RackLocationId }).IsUnique();
        e.HasOne(x => x.Product).WithMany(p => p.Locations).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.RackLocation).WithMany(l => l.Products).HasForeignKey(x => x.RackLocationId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PurchaseConfig : IEntityTypeConfiguration<Purchase>
{
    public void Configure(EntityTypeBuilder<Purchase> e)
    {
        e.Property(x => x.PurchaseNo).HasMaxLength(30).IsRequired();
        e.HasIndex(x => x.PurchaseNo).IsUnique();
        e.Property(x => x.TotalAmount).IsMoney();
        e.HasIndex(x => x.PurchaseDate);
    }
}

public class PurchaseItemConfig : IEntityTypeConfiguration<PurchaseItem>
{
    public void Configure(EntityTypeBuilder<PurchaseItem> e)
    {
        e.Property(x => x.Quantity).IsQty();
        e.Property(x => x.ListPrice).IsMoney();
        e.Property(x => x.PurchaseDiscountPercent).IsPercent();
        e.Property(x => x.NetRate).HasPrecision(14, 4);
        e.Property(x => x.LineTotal).IsMoney();
        e.HasOne(x => x.Purchase).WithMany(p => p.Items).HasForeignKey(x => x.PurchaseId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.RackLocation).WithMany().HasForeignKey(x => x.RackLocationId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class StockMovementConfig : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> e)
    {
        e.Property(x => x.Quantity).IsQty();
        e.Property(x => x.BalanceAfter).IsQty();
        e.Property(x => x.UnitCost).HasPrecision(14, 4);
        e.HasIndex(x => new { x.ProductId, x.CreatedAt });
        e.HasIndex(x => x.CreatedAt);
        e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class AppUserConfig : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> e)
    {
        e.ToTable("users");
        e.Property(x => x.Phone).HasMaxLength(15);
        e.Property(x => x.Email).HasMaxLength(200);
        e.Property(x => x.Name).HasMaxLength(150);
        e.Property(x => x.PreferredLanguage).HasMaxLength(8);
        // A phone can be both a partner and a retail customer, but only once per type.
        e.HasIndex(x => new { x.UserType, x.Phone }).IsUnique().HasFilter("phone IS NOT NULL");
        e.HasIndex(x => x.Email).IsUnique().HasFilter("email IS NOT NULL");
        e.HasOne(x => x.Role).WithMany(r => r.Users).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Restrict);
        e.Property(x => x.ReferralCode).HasMaxLength(12);
        e.HasIndex(x => x.ReferralCode).IsUnique().HasFilter("referral_code IS NOT NULL");
        e.HasIndex(x => x.ReferredById);
        e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.ReferredById).OnDelete(DeleteBehavior.SetNull);
    }
}

public class WishlistItemConfig : IEntityTypeConfiguration<WishlistItem>
{
    public void Configure(EntityTypeBuilder<WishlistItem> e)
    {
        e.HasIndex(x => new { x.UserId, x.ProductId }).IsUnique();
        e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CustomerProfileConfig : IEntityTypeConfiguration<CustomerProfile>
{
    public void Configure(EntityTypeBuilder<CustomerProfile> e)
    {
        e.HasIndex(x => x.UserId).IsUnique();
        e.HasIndex(x => x.KycStatus);
        e.Property(x => x.Gstin).HasMaxLength(15);
        e.Property(x => x.RewardBalance).HasPrecision(14, 2);
        e.HasOne(x => x.User).WithOne(u => u.CustomerProfile).HasForeignKey<CustomerProfile>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.KycReviewedById).OnDelete(DeleteBehavior.SetNull);
    }
}

public class RoleConfig : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> e)
    {
        e.Property(x => x.Name).HasMaxLength(80).IsRequired();
        e.HasIndex(x => x.Name).IsUnique();
    }
}

public class PartnerProfileConfig : IEntityTypeConfiguration<PartnerProfile>
{
    public void Configure(EntityTypeBuilder<PartnerProfile> e)
    {
        e.HasIndex(x => x.UserId).IsUnique();
        e.HasIndex(x => x.Pincode);
        e.HasIndex(x => x.KycStatus);
        e.Property(x => x.Pincode).HasMaxLength(6);
        e.Property(x => x.Gstin).HasMaxLength(15);
        e.Property(x => x.RewardBalance).HasPrecision(14, 2);
        e.HasOne(x => x.User).WithOne(u => u.PartnerProfile).HasForeignKey<PartnerProfile>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.Manager).WithMany().HasForeignKey(x => x.ManagerId).OnDelete(DeleteBehavior.SetNull);
        e.HasOne(x => x.KycReviewedBy).WithMany().HasForeignKey(x => x.KycReviewedById).OnDelete(DeleteBehavior.SetNull);
    }
}

public class KycDocumentConfig : IEntityTypeConfiguration<KycDocument>
{
    public void Configure(EntityTypeBuilder<KycDocument> e)
    {
        e.HasOne(x => x.PartnerProfile).WithMany(p => p.Documents).HasForeignKey(x => x.PartnerProfileId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.CustomerProfile).WithMany(p => p.Documents).HasForeignKey(x => x.CustomerProfileId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AddressConfig : IEntityTypeConfiguration<Address>
{
    public void Configure(EntityTypeBuilder<Address> e)
    {
        e.Property(x => x.Pincode).HasMaxLength(6);
        e.HasOne(x => x.User).WithMany(u => u.Addresses).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class OtpConfig : IEntityTypeConfiguration<OtpCode>
{
    public void Configure(EntityTypeBuilder<OtpCode> e) => e.HasIndex(x => new { x.Phone, x.CreatedAt });
}

public class RefreshTokenConfig : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> e)
    {
        e.HasIndex(x => x.TokenHash).IsUnique();
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class RewardTransactionConfig : IEntityTypeConfiguration<RewardTransaction>
{
    public void Configure(EntityTypeBuilder<RewardTransaction> e)
    {
        e.Property(x => x.Points).HasPrecision(14, 2);
        e.Property(x => x.BalanceAfter).HasPrecision(14, 2);
        e.HasIndex(x => new { x.PartnerUserId, x.CreatedAt });
        e.HasOne(x => x.PartnerUser).WithMany().HasForeignKey(x => x.PartnerUserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class DeviceTokenConfig : IEntityTypeConfiguration<DeviceToken>
{
    public void Configure(EntityTypeBuilder<DeviceToken> e) => e.HasIndex(x => x.Token).IsUnique();
}

public class NotificationConfig : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> e) => e.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAt });
}

public class CartItemConfig : IEntityTypeConfiguration<CartItem>
{
    public void Configure(EntityTypeBuilder<CartItem> e)
    {
        e.Property(x => x.PurchaseUnit).HasMaxLength(10).HasDefaultValue("Piece");
        e.Property(x => x.Quantity).IsQty();
        e.HasIndex(x => new { x.UserId, x.ProductId, x.PurchaseUnit }).IsUnique();
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class OrderConfig : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> e)
    {
        e.Property(x => x.OrderNo).HasMaxLength(30).IsRequired();
        e.HasIndex(x => x.OrderNo).IsUnique();
        e.HasIndex(x => new { x.Status, x.CreatedAt });
        e.HasIndex(x => new { x.UserId, x.CreatedAt });
        e.Property(x => x.SubTotal).IsMoney();
        e.Property(x => x.DiscountTotal).IsMoney();
        e.Property(x => x.TaxTotal).IsMoney();
        e.Property(x => x.ShippingFee).IsMoney();
        e.Property(x => x.RoundOff).IsMoney();
        e.Property(x => x.GrandTotal).IsMoney();
        e.Property(x => x.AmountPaid).IsMoney();
        e.Property(x => x.RewardPointsEarned).HasPrecision(14, 2);
        e.Ignore(x => x.BalanceDue);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class OrderItemConfig : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> e)
    {
        e.Property(x => x.PurchaseUnit).HasMaxLength(10).HasDefaultValue("Piece");
        e.Property(x => x.PackSizeSnapshot).HasPrecision(14, 3);
        e.Property(x => x.PackMrpSnapshot).HasPrecision(14, 2);
        e.Property(x => x.BoxPriceSnapshot).HasPrecision(14, 2);
        e.Property(x => x.BaseUnitSnapshot).HasMaxLength(40);
        e.Property(x => x.Quantity).IsQty();
        e.Property(x => x.ListPrice).IsMoney();
        e.Property(x => x.DiscountPercent).IsPercent();
        e.Property(x => x.SpecialDiscountPercent).IsPercent();
        e.Property(x => x.UnitPrice).IsMoney();
        e.Property(x => x.GstRate).IsPercent();
        e.Property(x => x.TaxAmount).IsMoney();
        e.Property(x => x.LineTotal).IsMoney();
        e.Property(x => x.RewardPoints).HasPrecision(14, 2);
        e.HasOne(x => x.Order).WithMany(o => o.Items).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class QuotationConfig : IEntityTypeConfiguration<Quotation>
{
    public void Configure(EntityTypeBuilder<Quotation> e)
    {
        e.Property(x => x.QuoteNo).HasMaxLength(30).IsRequired();
        e.HasIndex(x => x.QuoteNo).IsUnique();
        e.HasIndex(x => new { x.Status, x.CreatedAt });
        e.HasIndex(x => new { x.UserId, x.CreatedAt });
        e.Property(x => x.SubTotal).IsMoney();
        e.Property(x => x.DiscountTotal).IsMoney();
        e.Property(x => x.ShippingFee).IsMoney();
        e.Property(x => x.RoundOff).IsMoney();
        e.Property(x => x.GrandTotal).IsMoney();
        e.Property(x => x.CustomerNotes).HasMaxLength(1000);
        e.Property(x => x.StoreMessage).HasMaxLength(1000);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.Order).WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class QuotationItemConfig : IEntityTypeConfiguration<QuotationItem>
{
    public void Configure(EntityTypeBuilder<QuotationItem> e)
    {
        e.Property(x => x.PurchaseUnit).HasMaxLength(10).HasDefaultValue("Piece");
        e.Property(x => x.PackSizeSnapshot).HasPrecision(14, 3);
        e.Property(x => x.PackMrpSnapshot).HasPrecision(14, 2);
        e.Property(x => x.BoxPriceSnapshot).HasPrecision(14, 2);
        e.Property(x => x.BaseUnitSnapshot).HasMaxLength(40);
        e.Property(x => x.Quantity).IsQty();
        e.Property(x => x.ListPrice).IsMoney();
        e.Property(x => x.DiscountPercent).IsPercent();
        e.Property(x => x.SpecialDiscountPercent).IsPercent();
        e.Property(x => x.UnitPrice).IsMoney();
        e.Property(x => x.LineTotal).IsMoney();
        e.Property(x => x.GstRate).IsPercent();
        e.Property(x => x.RewardPoints).HasPrecision(14, 2);
        e.HasOne(x => x.Quotation).WithMany(q => q.Items).HasForeignKey(x => x.QuotationId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class OrderEventConfig : IEntityTypeConfiguration<OrderEvent>
{
    public void Configure(EntityTypeBuilder<OrderEvent> e)
    {
        e.Property(x => x.Action).HasMaxLength(60);
        e.HasOne(x => x.Order).WithMany(o => o.Events).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PaymentConfig : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> e)
    {
        e.Property(x => x.Amount).IsMoney();
        e.HasIndex(x => x.GatewayOrderId).IsUnique().HasFilter("gateway_order_id IS NOT NULL");
        e.HasOne(x => x.Order).WithMany(o => o.Payments).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class DispatchConfig : IEntityTypeConfiguration<Dispatch>
{
    public void Configure(EntityTypeBuilder<Dispatch> e)
    {
        e.HasIndex(x => x.DispatchNo).IsUnique();
        e.HasIndex(x => x.InvoiceNo).IsUnique();
        e.HasIndex(x => x.DispatchedAt);
        e.HasIndex(x => x.OrderId).IsUnique();
        e.HasOne(x => x.Order).WithOne(o => o.Dispatch).HasForeignKey<Dispatch>(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AppSettingConfig : IEntityTypeConfiguration<AppSetting>
{
    public void Configure(EntityTypeBuilder<AppSetting> e)
    {
        e.ToTable("settings");
        e.HasKey(x => x.Key);
        e.Property(x => x.Key).HasMaxLength(100);
    }
}

public class ServiceRequestConfig : IEntityTypeConfiguration<ServiceRequest>
{
    public void Configure(EntityTypeBuilder<ServiceRequest> e)
    {
        e.HasIndex(x => x.RequestNo).IsUnique();
        e.HasIndex(x => new { x.Status, x.CreatedAt });
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.AssignedPartner).WithMany().HasForeignKey(x => x.AssignedPartnerId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class ServiceRequestEventConfig : IEntityTypeConfiguration<ServiceRequestEvent>
{
    public void Configure(EntityTypeBuilder<ServiceRequestEvent> e) =>
        e.HasOne(x => x.ServiceRequest).WithMany(r => r.Events).HasForeignKey(x => x.ServiceRequestId).OnDelete(DeleteBehavior.Cascade);
}

public class OutboxConfig : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> e)
    {
        e.Property(x => x.EventType).HasMaxLength(60);
        e.Property(x => x.Payload).HasColumnType("jsonb");
        e.HasIndex(x => new { x.Status, x.NextAttemptAt });
    }
}
