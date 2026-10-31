using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Reports;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BuildMate.Tests;

public class DashboardTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;
    public DashboardTests(TestDatabase database) => _database = database;

    [PostgresFact]
    public async Task Dashboard_handles_empty_data_then_ranks_sales_and_counts_all_records()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var reports = new ReportService(db);
        var empty = await reports.DashboardAsync();
        Assert.Empty(empty.TopProducts);
        Assert.Equal(30, empty.Trend.Count);
        Assert.Equal(0, empty.Overview!.Products);

        var category = new Category { Name = "Dashboard category" };
        var brand = new Brand { Name = "Dashboard brand" };
        var partner = new AppUser { Name = "Dashboard partner", UserType = UserType.Partner };
        db.Users.Add(partner);
        db.Users.Add(new AppUser { Name = "Customer", UserType = UserType.Customer });
        for (var i = 1; i <= 10; i++)
        {
            var product = new Product { Code = $"DASH{i}", Name = $"Product {i}", Category = category, Brand = brand, IsActive = i != 1 };
            db.Products.Add(product);
            db.Orders.Add(new Order {
                OrderNo = $"DASH{i}", User = partner, CustomerName = partner.Name, CustomerKind = CustomerKind.Partner,
                Status = OrderStatus.Paid, PaidAt = DateTime.UtcNow, Channel = SalesChannel.Web, GrandTotal = i * 100,
                Items = new List<OrderItem> { new() { Product = product, ProductCode = product.Code, ProductName = product.Name, Quantity = 2, LineTotal = i * 100 } }
            });
        }
        db.Orders.Add(new Order { OrderNo = "UNPAID", GrandTotal = 99999 });
        await db.SaveChangesAsync();
        var dashboard = await reports.DashboardAsync();
        Assert.Equal(10, dashboard.Overview!.Products);
        Assert.Equal(11, dashboard.Overview.Orders);
        Assert.Equal(1, dashboard.Overview.Customers);
        Assert.Equal(1, dashboard.Overview.Partners);
        Assert.Equal(8, dashboard.TopProducts.Count);
        Assert.Equal(1000, dashboard.TopProducts[0].Amount);
        Assert.Equal(300, dashboard.TopProducts[^1].Amount);
        Assert.Equal(5500, dashboard.Kpis.SalesToday);
        Assert.Equal(5500, Assert.Single(dashboard.TopPartners).Amount);
        Assert.Equal(5500, Assert.Single(dashboard.ByCategory).Amount);
        var breakdown = await reports.CategoryBrandAsync(new DateRange(null, null));
        Assert.Equal(5500, Assert.Single(breakdown.Categories).Amount);
        Assert.Equal(5500, Assert.Single(breakdown.Brands).Amount);
    }
}
