using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services;
using BuildMate.Services.Common;
using BuildMate.Services.Inventory;
using BuildMate.Services.Orders;
using BuildMate.Services.Reports;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace BuildMate.Tests;

/// <summary>
/// Runs only when BUILDMATE_TEST_DB points at a PostgreSQL server (a connection string with a user allowed to create
/// databases), e.g.  BUILDMATE_TEST_DB="Host=localhost;Username=postgres;Password=postgres"
/// Each test class creates its own throwaway database named buildmate_test_&lt;random&gt; and drops it afterwards; the
/// database named in the connection string is never touched. Never point this at production.
/// </summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(TestDatabase.EnvVar)))
            Skip = $"Set {TestDatabase.EnvVar} to a PostgreSQL connection string to run the database tests.";
    }
}

public sealed class TestDatabase : IAsyncLifetime
{
    public const string EnvVar = "BUILDMATE_TEST_DB";
    private string? _admin;
    public string Name { get; } = $"buildmate_test_{Guid.NewGuid():N}";
    public ServiceProvider Services { get; private set; } = default!;
    public long StaffId { get; private set; }

    public async Task InitializeAsync()
    {
        _admin = Environment.GetEnvironmentVariable(EnvVar);
        if (string.IsNullOrWhiteSpace(_admin)) return;
        var cs = new NpgsqlConnectionStringBuilder(_admin) { Database = Name }.ConnectionString;
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Default"] = cs }).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(config);
        services.AddBuildMate(config);
        services.AddSingleton<TestUser>();
        services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<TestUser>());
        Services = services.BuildServiceProvider();

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync(); // creates the throwaway database and schema
        var staff = new AppUser { UserType = UserType.Staff, Name = "Test Staff", Email = $"{Name}@example.test" };
        db.Users.Add(staff);
        await db.SaveChangesAsync();
        StaffId = staff.Id;
        Services.GetRequiredService<TestUser>().Id = staff.Id;
    }

    public async Task DisposeAsync()
    {
        if (string.IsNullOrWhiteSpace(_admin)) return;
        await Services.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await using var conn = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(_admin) { Database = "postgres" }.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{Name}\" WITH (FORCE)", conn);
        await cmd.ExecuteNonQueryAsync();
    }
}

public sealed class TestUser : ICurrentUser
{
    public long? Id { get; set; }
    public string? Name => "Test Staff";
    public UserType? UserType => Domain.Enums.UserType.Staff;
    public bool HasPermission(string permission) => true;
    public long RequireId() => Id ?? throw new InvalidOperationException("No test user");
}

/// <summary>Dispatch workflow → product movement, against a real PostgreSQL database (row locks, transactions).</summary>
public class DispatchMovementIntegrationTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _t;
    public DispatchMovementIntegrationTests(TestDatabase t) => _t = t;

    private async Task<Product> NewProductAsync(decimal stock, DateTime? receivedAt = null)
    {
        using var scope = _t.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cat = await db.Categories.FirstOrDefaultAsync() ?? db.Categories.Add(new Category { Name = "Test" }).Entity;
        var brand = await db.Brands.FirstOrDefaultAsync() ?? db.Brands.Add(new Brand { Name = "Test" }).Entity;
        var p = new Product
        {
            Code = $"T{Guid.NewGuid():N}"[..12].ToUpperInvariant(), Name = "Test product", Category = cat, Brand = brand,
            Mrp = 100, ListPrice = 100, GstRate = 18, CreatedAt = DateTime.UtcNow.AddDays(-400)
        };
        db.Products.Add(p);
        await db.SaveChangesAsync();
        if (stock > 0)
        {
            var stockSvc = scope.ServiceProvider.GetRequiredService<IStockService>();
            stockSvc.Apply(p, StockMovementType.PurchaseIn, stock, 60, "Test", null, null, null);
            if (receivedAt != null) p.AgingFromAt = receivedAt; // simulate an older receipt
            await db.SaveChangesAsync();
        }
        return p;
    }

    private async Task<Product> ReloadAsync(long id)
    {
        using var scope = _t.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().Products.AsNoTracking().FirstAsync(p => p.Id == id);
    }

    private async Task<OrderDetailDto> CounterSaleAsync(long productId, decimal qty)
    {
        using var scope = _t.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IOrderAdminService>().CounterSaleAsync(
            new CounterSaleRequest(null, null, null, null, new List<CounterLine> { new(productId, qty, 0) }, PaymentMethod.CashAtStore, null, null));
    }

    [PostgresFact]
    public async Task First_receipt_sets_the_aging_date_and_product_starts_as_never_dispatched()
    {
        var p = await NewProductAsync(10);
        var saved = await ReloadAsync(p.Id);
        Assert.NotNull(saved.AgingFromAt);
        Assert.Null(saved.LastDispatchedAt);
        var m = ProductMovement.Classify(saved, Clock.TodayIst);
        Assert.True(m.NeverDispatched);
        Assert.Equal(MovementCategory.Fast, m.Category); // received today
    }

    [PostgresFact]
    public async Task Successful_dispatch_records_the_dispatch_time_and_makes_the_product_fast_moving()
    {
        var p = await NewProductAsync(10, receivedAt: DateTime.UtcNow.AddDays(-200));
        Assert.Equal(MovementCategory.NonMoving, ProductMovement.Classify(await ReloadAsync(p.Id), Clock.TodayIst).Category);

        var order = await CounterSaleAsync(p.Id, 2);

        var saved = await ReloadAsync(p.Id);
        Assert.NotNull(order.Dispatch);
        Assert.Equal(order.Dispatch!.DispatchedAt, saved.LastDispatchedAt!.Value, TimeSpan.FromMilliseconds(1));
        Assert.Equal(8, saved.StockQty); // existing stock behaviour unchanged
        var m = ProductMovement.Classify(saved, Clock.TodayIst);
        Assert.Equal(MovementCategory.Fast, m.Category);
        Assert.False(m.NeverDispatched);

        using var scope = _t.Services.CreateScope();
        var history = await scope.ServiceProvider.GetRequiredService<IReportService>().ProductMovementAsync(p.Id);
        Assert.Equal(1, history.DispatchCount);
        Assert.Equal(2, history.QtyLast30Days);
        Assert.Equal(order.OrderNo, history.Dispatches[0].OrderNo);
    }

    [PostgresFact]
    public async Task Failed_dispatch_rolls_back_and_changes_nothing()
    {
        var p = await NewProductAsync(1);
        var ex = await Assert.ThrowsAsync<AppException>(() => CounterSaleAsync(p.Id, 5)); // more than in stock
        Assert.Equal("insufficient_stock", ex.Code);
        var saved = await ReloadAsync(p.Id);
        Assert.Null(saved.LastDispatchedAt);
        Assert.Equal(1, saved.StockQty);
    }

    [PostgresFact]
    public async Task Dispatching_the_same_order_twice_is_rejected_and_the_date_is_unchanged()
    {
        var p = await NewProductAsync(10);
        var order = await CounterSaleAsync(p.Id, 1);
        var first = (await ReloadAsync(p.Id)).LastDispatchedAt;

        using var scope = _t.Services.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IOrderAdminService>();
        var ex = await Assert.ThrowsAsync<AppException>(() => svc.DispatchAsync(order.Id, new DispatchRequest(null, null, null, null, null)));
        Assert.Equal("not_dispatchable", ex.Code);
        Assert.Equal(first, (await ReloadAsync(p.Id)).LastDispatchedAt);
        Assert.Equal(9, (await ReloadAsync(p.Id)).StockQty);
    }

    [PostgresFact]
    public async Task Cancelled_order_never_counts_as_movement()
    {
        var p = await NewProductAsync(10);
        long orderId;
        using (var scope = _t.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var o = new Order
            {
                OrderNo = $"TC{Guid.NewGuid():N}"[..14], Channel = SalesChannel.Web, CustomerKind = CustomerKind.Retail, Status = OrderStatus.Paid,
                CustomerName = "Test", PaymentStatus = PaymentStatus.Success, PaymentMethod = PaymentMethod.CashAtStore, PaidAt = DateTime.UtcNow
            };
            o.Items.Add(new OrderItem { ProductId = p.Id, ProductCode = p.Code, ProductName = p.Name, Quantity = 2, ListPrice = 100, GstRate = 18 });
            db.Orders.Add(o);
            await db.SaveChangesAsync();
            orderId = o.Id;
        }
        using (var scope = _t.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<IOrderAdminService>().CancelAsync(orderId, new CancelRequest("Customer changed mind", false));

        var saved = await ReloadAsync(p.Id);
        Assert.Null(saved.LastDispatchedAt);
        Assert.Equal(10, saved.StockQty);
    }

    [PostgresFact]
    public async Task Return_recorded_as_stock_adjustment_keeps_the_last_dispatch_date()
    {
        var p = await NewProductAsync(10);
        await CounterSaleAsync(p.Id, 3);
        var dispatched = (await ReloadAsync(p.Id)).LastDispatchedAt;

        using (var scope = _t.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<IStockService>().AdjustAsync(new StockAdjustRequest(p.Id, 3, true, "Customer return", null));

        var saved = await ReloadAsync(p.Id);
        Assert.Equal(dispatched, saved.LastDispatchedAt);
        Assert.Equal(10, saved.StockQty);
    }

    [PostgresFact]
    public async Task Stock_list_summary_and_movement_filter_use_the_same_rule()
    {
        var never = await NewProductAsync(5, receivedAt: DateTime.UtcNow.AddDays(-150));
        var sold = await NewProductAsync(5);
        await CounterSaleAsync(sold.Id, 1);

        using var scope = _t.Services.CreateScope();
        var reports = scope.ServiceProvider.GetRequiredService<IReportService>();
        var rows = await reports.StockAsync(new StockQuery());
        var neverRow = rows.Single(r => r.ProductId == never.Id);
        Assert.Equal(MovementCategory.NonMoving, neverRow.Movement);
        Assert.True(neverRow.NeverDispatched);
        Assert.Equal(MovementCategory.Fast, rows.Single(r => r.ProductId == sold.Id).Movement);

        var nonMoving = await reports.StockAsync(new StockQuery(Movement: MovementCategory.NonMoving));
        Assert.Contains(nonMoving, r => r.ProductId == never.Id);
        Assert.DoesNotContain(nonMoving, r => r.ProductId == sold.Id);

        var summary = await reports.MovementSummaryAsync(new StockQuery());
        Assert.Equal(rows.Count(r => r.Movement == MovementCategory.NonMoving), summary.NonMoving.Products);
        Assert.Equal(rows.Count(r => r.Movement == MovementCategory.Fast), summary.Fast.Products);

        var search = await reports.StockAsync(new StockQuery(Search: sold.Code));
        Assert.Single(search);
    }
}
