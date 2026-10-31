using BuildMate.Data;
using BuildMate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace BuildMate.Tests;

public class CatalogMigrationTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;
    public CatalogMigrationTests(TestDatabase database) => _database = database;
    private static string Script(string name)
    {
        var root = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (root != null && !File.Exists(Path.Combine(root.FullName, "api", "db", name))) root = root.Parent;
        return File.ReadAllText(Path.Combine(root!.FullName, "api", "db", name));
    }

    [PostgresFact]
    public async Task Additive_migration_is_repeatable_preserves_legacy_stock_and_refuses_destructive_rollback()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var product = new Product { Code = "LEGACY-P", Name = "Legacy product", Category = new Category { Name = "Legacy" }, Brand = new Brand { Name = "Legacy brand" }, VariantFamily = "Explicit family", StockQty = 37, ReservedQty = 2, ListPrice = 48, Mrp = 50 };
        db.Products.Add(product); await db.SaveChangesAsync();
        var up = Script("2026-10-30_catalog_packages.sql");
        var down = Script("2026-10-30_catalog_packages_rollback.sql");
        await db.Database.ExecuteSqlRawAsync(down);
        await db.Database.ExecuteSqlRawAsync(up);
        await db.Database.ExecuteSqlRawAsync(up);
        db.ChangeTracker.Clear();
        var preserved = await db.Products.SingleAsync(p => p.Id == product.Id);
        Assert.Equal(37, preserved.StockQty); Assert.Equal(2, preserved.ReservedQty); Assert.Equal(48, preserved.ListPrice);
        Assert.Null(preserved.ProductTypeId); Assert.Null(preserved.ProductClass);
        Assert.NotNull(preserved.CatalogFamilyId);
        Assert.Single(await db.CatalogFamilies.ToListAsync());
        await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlRawAsync(down));
        // A rejected script leaves its explicit transaction aborted; close this connection before reuse.
        await db.Database.CloseConnectionAsync();
        Assert.Equal(37, await db.Products.Where(p => p.Id == product.Id).Select(p => p.StockQty).SingleAsync());
    }
}
