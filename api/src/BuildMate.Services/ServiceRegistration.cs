using Amazon;
using Amazon.S3;
using BuildMate.Data;
using BuildMate.Services.Auth;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using BuildMate.Services.Erp;
using BuildMate.Services.Excel;
using BuildMate.Services.Files;
using BuildMate.Services.Inventory;
using BuildMate.Services.Notifications;
using BuildMate.Services.Orders;
using BuildMate.Services.Partners;
using BuildMate.Services.Payments;
using BuildMate.Services.Reports;
using BuildMate.Services.ServiceRequests;
using BuildMate.Services.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace BuildMate.Services;

public static class ServiceRegistration
{
    public static IServiceCollection AddBuildMate(this IServiceCollection services, IConfiguration config)
    {
        // No EnableRetryOnFailure: the order, dispatch, checkout and stock flows use explicit transactions with
        // SELECT ... FOR UPDATE row locks, and EF's retrying strategy rejects user-initiated transactions
        // ("does not support user-initiated transactions"), which would make every one of those calls fail.
        services.AddDbContext<AppDbContext>(o => o
            .UseNpgsql(config.GetConnectionString("Default"), npg => npg.MigrationsAssembly("BuildMate.Data"))
            .UseSnakeCaseNamingConvention());

        services.Configure<JwtOptions>(config.GetSection("Jwt"));
        services.Configure<OtpOptions>(config.GetSection("Otp"));
        services.Configure<SmsOptions>(config.GetSection("Sms"));
        services.Configure<PushOptions>(config.GetSection("Push"));
        services.Configure<StorageOptions>(config.GetSection("Storage"));
        services.Configure<CashfreeOptions>(config.GetSection("Cashfree"));
        services.Configure<ErpOptions>(config.GetSection("Erp"));
        services.Configure<SeedOptions>(config.GetSection("Seed"));
        services.AddMemoryCache();

        // Integrations (provider chosen by configuration)
        if (config["Sms:Provider"] == "Msg91") services.AddHttpClient<ISmsSender, Msg91SmsSender>();
        else services.AddSingleton<ISmsSender, LogSmsSender>();

        if (!string.IsNullOrWhiteSpace(config["Push:FirebaseCredentialPath"])) services.AddSingleton<IPushSender, FcmPushSender>();
        else services.AddSingleton<IPushSender, NullPushSender>();

        if (config["Storage:Provider"] == "S3")
        {
            services.AddSingleton<IAmazonS3>(sp =>
                new AmazonS3Client(RegionEndpoint.GetBySystemName(sp.GetRequiredService<IOptions<StorageOptions>>().Value.S3Region)));
            services.AddSingleton<IFileStorage, S3FileStorage>();
        }
        else services.AddSingleton<IFileStorage, LocalFileStorage>();

        services.AddHttpClient<IPaymentGateway, CashfreeGateway>(c => c.Timeout = TimeSpan.FromSeconds(20));

        if (config["Erp:Provider"] == "Webhook") services.AddHttpClient<IErpConnector, WebhookErpConnector>(c => c.Timeout = TimeSpan.FromSeconds(30));
        else services.AddScoped<IErpConnector, NoErpConnector>();
        services.AddScoped<IOutbox, Outbox>();
        services.AddHostedService<OutboxProcessor>();

        // Business services
        services.Configure<FirebaseOptions>(config.GetSection("Firebase"));
        services.AddHttpClient<IFirebaseTokenVerifier, FirebaseTokenVerifier>(c => c.Timeout = TimeSpan.FromSeconds(10));
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ISettingsService, SettingsService>();
        services.AddScoped<BuildMate.Services.Orders.IInvoiceNumbers, BuildMate.Services.Orders.InvoiceNumbers>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<ICatalogAdminService, CatalogAdminService>();
        services.AddScoped<ICatalogService, CatalogService>();
        services.AddSingleton<IQrService, QrService>();
        services.AddScoped<IStockService, StockService>();
        services.AddScoped<IRackService, RackService>();
        services.AddScoped<IPurchaseService, PurchaseService>();
        services.AddScoped<IPartnerService, PartnerService>();
        services.AddScoped<ICartService, CartService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<ICheckoutService, CheckoutService>();
        services.AddScoped<IOrderAdminService, OrderAdminService>();
        services.AddScoped<IQuotationService, QuotationService>();
        services.AddScoped<IServiceRequestService, ServiceRequestService>();
        services.AddScoped<IContentService, ContentService>();
        services.AddScoped<IStaffService, StaffService>();
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IExcelService, ExcelService>();
        services.AddScoped<DbSeeder>();
        return services;
    }
}
