using System.Text;
using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Excel;
using BuildMate.Services.Inventory;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BuildMate.Tests;

/// <summary>Integration tests on a real PostgreSQL database (set BUILDMATE_TEST_DB to run them).</summary>
public class CatalogAndBulkStockIntegrationTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;
    public CatalogAndBulkStockIntegrationTests(TestDatabase database) => _database = database;

    // ---- Task 1: Module / Color / Series / Current rating ----

    [PostgresFact]
    public async Task Product_attributes_save_filter_export_import_and_show_as_specs()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await CatalogColumns20261117.EnsureAsync(db); // adds the check constraint, as the API does at start-up
        var admin = scope.ServiceProvider.GetRequiredService<ICatalogAdminService>();
        var excel = scope.ServiceProvider.GetRequiredService<IExcelService>();
        var catalog = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var category = new Category { Name = "Attr switches" }; var brand = new Brand { Name = "Attr brand" };
        db.AddRange(category, brand); await db.SaveChangesAsync();

        ProductUpsert Upsert(CatalogInput c) => new("Attr switch 2M", null, category.Id, null, brand.Id, null, "pcs", null, 18, 100, 90, 0, 0, 0, 0, 0,
            new(), true, true, true, null, null, null, Catalog: c);
        var created = await admin.SaveProductAsync(null, Upsert(new CatalogInput(Module: " 2M ", Color: "White", Series: "Piano", CurrentRating: "AMP")));
        Assert.Equal(("2M", "White", "Piano", "amp"), (created.Catalog!.Module, created.Catalog.Color, created.Catalog.Series, created.Catalog.CurrentRating));
        await Assert.ThrowsAsync<AppException>(() => admin.SaveProductAsync(created.Id, Upsert(new CatalogInput(CurrentRating: "kw"))));
        // The database itself refuses anything else, too.
        await Assert.ThrowsAnyAsync<Exception>(() => db.Database.ExecuteSqlRawAsync("UPDATE products SET current_rating = 'kw' WHERE id = {0}", created.Id));

        var filtered = await admin.ListProductsAsync(new ProductAdminQuery(null, category.Id, null, null, null, null, null, null, Module: "2m", Series: "piano", CurrentRating: "amp"));
        Assert.Equal(created.Id, Assert.Single(filtered.Items).Id);
        Assert.Empty((await admin.ListProductsAsync(new ProductAdminQuery(null, category.Id, null, null, null, null, null, null, Color: "Black"))).Items);

        // Export has the columns; an old file without them still imports and keeps the values.
        using (var exported = new XLWorkbook(new MemoryStream(excel.Export("Products", filtered.Items, ExcelService.ProductExportColumns()))))
        {
            var headers = exported.Worksheet(1).Row(1).CellsUsed().Select(c => c.GetString()).ToList();
            foreach (var h in new[] { "Module", "Color", "Series", "Current Rating" }) Assert.Contains(h, headers);
        }
        using var old = OldProductSheet(created.Code, category.Name, brand.Name);
        Assert.Equal(1, (await excel.ImportProductsAsync(old, false)).Updated);
        db.ChangeTracker.Clear();
        var after = await db.Products.AsNoTracking().SingleAsync(p => p.Id == created.Id);
        Assert.Equal(("2M", "White", "Piano", "amp"), (after.Module, after.Color, after.Series, after.CurrentRating));

        var detail = await catalog.GetAsync(created.Id, Viewer.Retail(ClientChannel.Web));
        Assert.Contains(detail.Specs, s => s.Name == "Current rating" && s.Value == "Amp");
        Assert.Contains(detail.Specs, s => s.Name == "Module" && s.Value == "2M");
    }

    private static MemoryStream OldProductSheet(string code, string category, string brand)
    {
        using var wb = new XLWorkbook(); var ws = wb.AddWorksheet("Products");
        var headers = new[] { "Code", "Name", "Category", "Brand", "Unit", "List Price" };
        var values = new[] { code, "Attr switch 2M", category, brand, "pcs", "95" };
        for (var i = 0; i < headers.Length; i++) { ws.Cell(1, i + 1).Value = headers[i]; ws.Cell(2, i + 1).Value = values[i]; }
        var s = new MemoryStream(); wb.SaveAs(s); s.Position = 0; return s;
    }

    // ---- Task 2: Product Type image ----

    [PostgresFact]
    public async Task Type_image_is_saved_and_returned_without_touching_product_or_family_images()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var category = new Category { Name = "Type image cat" };
        var type = new ProductType { Category = category, Name = "Faucets", Key = "FAUCETS", ImageUrl = CatalogStructure.ImageUrl("https://res.cloudinary.com/demo/faucet.png") };
        var family = new CatalogFamily { Category = category, Brand = new Brand { Name = "Type image brand" }, Key = "PILLAR", Name = "Pillar", ImageUrl = "https://example.test/family.png" };
        db.AddRange(type, family); await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var saved = await db.ProductTypes.AsNoTracking().Include(t => t.Category).SingleAsync(t => t.Id == type.Id);
        var dto = CatalogStructure.ToDto(saved, saved.Category.Name, new List<long>(), true);
        Assert.Equal("https://res.cloudinary.com/demo/faucet.png", dto.ImageUrl);
        Assert.Equal("https://example.test/family.png", (await db.CatalogFamilies.AsNoTracking().SingleAsync(f => f.Id == family.Id)).ImageUrl);
        Assert.Throws<AppException>(() => CatalogStructure.ImageUrl("javascript:alert(1)"));
        Assert.Null(CatalogStructure.ToDto(new ProductType { Name = "No image" }, "Any", new()).ImageUrl);
    }

    // ---- Task 3: bulk stock update ----

    [PostgresFact]
    public async Task Bulk_stock_preview_cancel_skip_and_apply_with_ledger_entries()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var bulk = scope.ServiceProvider.GetRequiredService<IBulkStockService>();
        var category = new Category { Name = "Bulk cat" }; var brand = new Brand { Name = "Bulk brand" };
        db.Products.AddRange(
            new Product { Code = "BULK-A", Name = "Bulk A", Category = category, Brand = brand, StockQty = 10 },
            new Product { Code = "BULK-B", Name = "Bulk B", Category = category, Brand = brand, StockQty = 0, Barcode = "8900000000017" },
            new Product { Code = "BULK-C", Name = "Bulk C", Category = category, Brand = brand, StockQty = 4 });
        await db.SaveChangesAsync();
        static MemoryStream Csv(string text) => new(Encoding.UTF8.GetBytes(text));
        const string file = "product_code,barcode,quantity,mode,note\nBULK-A,,25,set,count\n,8900000000017,6,add,\nBULK-C,,4,,\nNOPE,,1,,\n";

        var preview = await bulk.PreviewAsync(Csv(file), "count.csv", "set");
        Assert.Equal((4, 2, 1, 1), (preview.TotalRows, preview.ChangeRows, preview.UnchangedRows, preview.ErrorRows));
        Assert.Equal(10, await Stock(db, "BULK-A")); // preview changes nothing

        var cancelled = await bulk.ApplyAsync(Csv(file), "count.csv", "set", skipInvalid: false);
        Assert.False(cancelled.Applied);
        Assert.Equal(10, await Stock(db, "BULK-A"));

        var applied = await bulk.ApplyAsync(Csv(file), "count.csv", "set", skipInvalid: true);
        Assert.Equal((true, 2, 1, 1), (applied.Applied, applied.Updated, applied.Skipped, applied.Failed));
        Assert.Equal(25, await Stock(db, "BULK-A"));
        Assert.Equal(6, await Stock(db, "BULK-B"));
        Assert.Equal(4, await Stock(db, "BULK-C"));

        var moves = await db.StockMovements.AsNoTracking().Where(m => m.ReferenceType == BulkStockService.Source).OrderBy(m => m.Id).ToListAsync();
        Assert.Equal(2, moves.Count);
        Assert.All(moves, m => Assert.Equal("count.csv", m.ReferenceNo));
        Assert.Equal((StockMovementType.AdjustmentIn, 15m, 25m), (moves[0].Type, moves[0].Quantity, moves[0].BalanceAfter));
        Assert.Contains("10 → 25", moves[0].Note);
        Assert.Equal(_database.StaffId, moves[0].UserId);
        // Movement status: the first receipt starts the aging clock of a product that had no stock.
        Assert.NotNull((await db.Products.AsNoTracking().SingleAsync(p => p.Code == "BULK-B")).AgingFromAt);
    }

    private static Task<decimal> Stock(AppDbContext db, string code) =>
        db.Products.AsNoTracking().Where(p => p.Code == code).Select(p => p.StockQty).SingleAsync();
}
