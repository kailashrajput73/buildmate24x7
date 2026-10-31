using BuildMate.Domain.Common;
using BuildMate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<ProductType> ProductTypes => Set<ProductType>();
    public DbSet<ProductTypeSubCategory> ProductTypeSubCategories => Set<ProductTypeSubCategory>();
    public DbSet<CatalogFamily> CatalogFamilies => Set<CatalogFamily>();
    // Catalogue
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<SubCategory> SubCategories => Set<SubCategory>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductAlias> ProductAliases => Set<ProductAlias>();
    public DbSet<ProductTranslation> ProductTranslations => Set<ProductTranslation>();
    public DbSet<ProductGroup> ProductGroups => Set<ProductGroup>();
    public DbSet<ProductGroupItem> ProductGroupItems => Set<ProductGroupItem>();

    // Inventory
    public DbSet<Rack> Racks => Set<Rack>();
    public DbSet<RackLocation> RackLocations => Set<RackLocation>();
    public DbSet<ProductLocation> ProductLocations => Set<ProductLocation>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    // Users & partners
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<PartnerProfile> PartnerProfiles => Set<PartnerProfile>();
    public DbSet<KycDocument> KycDocuments => Set<KycDocument>();
    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<RewardTransaction> RewardTransactions => Set<RewardTransaction>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<Notification> Notifications => Set<Notification>();

    // Sales
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderEvent> OrderEvents => Set<OrderEvent>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Dispatch> Dispatches => Set<Dispatch>();
    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<QuotationItem> QuotationItems => Set<QuotationItem>();

    // Content, services, integration
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<HomeSection> HomeSections => Set<HomeSection>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<ServiceRequestEvent> ServiceRequestEvents => Set<ServiceRequestEvent>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Document-number sequences (Postgres SEQUENCEs; safe under concurrency).
        foreach (var seq in Sequences.All)
            b.HasSequence<long>(seq).StartsAt(1).IncrementsBy(1);
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified) entry.Entity.UpdatedAt = now;
        }
        return base.SaveChangesAsync(ct);
    }

    /// <summary>Returns the next value of a Postgres sequence.</summary>
    public async Task<long> NextSequenceValueAsync(string sequence, CancellationToken ct = default)
    {
        if (!Sequences.All.Contains(sequence)) throw new ArgumentException($"Unknown sequence {sequence}");
        return await Database
            .SqlQueryRaw<long>($"SELECT nextval('{sequence}') AS \"Value\"")
            .SingleAsync(ct);
    }
}

public static class Sequences
{
    public const string ProductCode = "product_code_seq";
    public const string OrderNo = "order_no_seq";
    public const string PurchaseNo = "purchase_no_seq";
    public const string DispatchNo = "dispatch_no_seq";
    public const string InvoiceNo = "invoice_no_seq";
    public const string ServiceRequestNo = "service_request_no_seq";
    public const string QuoteNo = "quote_no_seq";

    public static readonly string[] All =
        { ProductCode, OrderNo, PurchaseNo, DispatchNo, InvoiceNo, ServiceRequestNo, QuoteNo };
}
