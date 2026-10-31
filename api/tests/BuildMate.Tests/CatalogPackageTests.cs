using BuildMate.Services.Inventory;
using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Excel;
using BuildMate.Services.Orders;
using BuildMate.Services.Content;
using BuildMate.Services.Payments;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace BuildMate.Tests;

public class CatalogPackageTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;
    public CatalogPackageTests(TestDatabase database) => _database = database;

    [Theory]
    [InlineData("20 mm", "Linear", 20)]
    [InlineData("2 inch", "Linear", 50.8)]
    [InlineData("5 cm", "Linear", 50)]
    [InlineData("4 sqmm", "Area", 4)]
    [InlineData("3 m", "Linear", 3000)]
    [InlineData("6 mtr", "Linear", 6000)]
    [InlineData("10 feet", "Linear", 3048)]
    [InlineData("12 ft", "Linear", 3657.6)]
    [InlineData("100 cm", "Linear", 1000)]
    public void Measures_preserve_display_and_dimension(string text, string dimension, double normalized)
    {
        var measure = CatalogMeasure.Parse(text)!;
        Assert.Equal(text, measure.Display);
        Assert.Equal(dimension, measure.Dimension);
        Assert.Equal((decimal)normalized, measure.NormalizedValue);
    }

    [Fact]
    public void Area_is_not_a_length_and_nonpositive_measure_rejected()
    {
        Assert.Throws<AppException>(() => CatalogMeasure.Parse("4 sqmm", length: true));
        Assert.Throws<AppException>(() => CatalogMeasure.Parse("-2 mm"));
        Assert.Throws<AppException>(() => CatalogMeasure.Parse("0 m"));
    }

    [Theory]
    [InlineData("None", 0, 1000)]
    [InlineData("Percentage", 10, 900)]
    [InlineData("Fixed", 75, 925)]
    public void Package_price_and_snapshot_remain_independent_of_later_product_changes(string kind, decimal discount, decimal expected)
    {
        var p = new Product { Mrp = 50, ListPrice = 45, PackSize = 20, BoxDiscountType = kind, BoxDiscountValue = discount, Unit = "pcs" };
        Packaging.Validate(p);
        Assert.Equal(1000, Packaging.Mrp(p));
        Assert.Equal(expected, Packaging.Price(p));
        Assert.Equal(40, Packaging.BaseQuantity(p, 2, "Box"));
        Assert.Equal(2, Packaging.BaseQuantity(p, 2, "Piece"));
        var item = new OrderItem { Quantity = 40, ListPrice = 45, GstRate = 18 };
        Packaging.Snapshot(item, p, "Box");
        p.PackSize = 3; p.BoxDiscountValue = 0; p.Mrp = 100;
        var order = new Order { Items = new List<OrderItem> { item } };
        Pricing.Recalculate(order);
        Assert.Equal(expected * 2, order.GrandTotal);
        Assert.Equal(2000, order.SubTotal);
        Assert.Equal(2, Packaging.PurchaseQuantity(item, item.Quantity));
        Assert.Equal(20, item.PackSizeSnapshot);
    }

    [Fact]
    public void Box_rounding_uses_package_price_not_rounded_piece_price()
    {
        var p = new Product { PackSize = 3, PackMrp = 100, Mrp = 40 };
        var item = new OrderItem { Quantity = 9 };
        Packaging.Snapshot(item, p, "Box");
        Pricing.Recalculate(item);
        Assert.Equal(300, item.LineTotal);
        Assert.Throws<AppException>(() => Packaging.BaseQuantity(p, 1.5m, "Box"));
        item.Quantity = 10;
        Assert.Throws<AppException>(() => Pricing.Recalculate(item));
        p.BoxDiscountType = "Fixed"; p.BoxDiscountValue = 100;
        Assert.Throws<AppException>(() => Packaging.Validate(p));
    }

    [Fact]
    public void Image_priority_preserves_product_images()
    {
        var p = new Product { CatalogFamily = new CatalogFamily { ImageUrl = "https://example.test/family.jpg" } };
        Assert.Equal(p.CatalogFamily.ImageUrl, CatalogStructure.Image(p));
        p.ImageUrls.Add("https://example.test/product.jpg");
        p.CatalogFamily.ImageUrl = "https://example.test/new-family.jpg";
        Assert.Equal(p.ImageUrls[0], CatalogStructure.Image(p));
        Assert.Throws<AppException>(() => CatalogStructure.ImageUrl("javascript:alert(1)"));
    }

    [PostgresFact]
    public async Task Import_roundtrip_masters_family_boundaries_filters_and_cart_use_real_database()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var excel = scope.ServiceProvider.GetRequiredService<IExcelService>();
        var admin = scope.ServiceProvider.GetRequiredService<ICatalogAdminService>();
        var category = new Category { Name = "Catalog test" };
        var sub = new SubCategory { Category = category, Name = "Fitting" };
        var type = new ProductType { Category = category, Name = "UPVC", Key = "UPVC" };
        type.SubCategories.Add(new ProductTypeSubCategory { SubCategory = sub });
        var a = new Brand { Name = "Brand A" }; var b = new Brand { Name = "Brand B" };
        db.AddRange(type, a, b); await db.SaveChangesAsync();

        using var template = new XLWorkbook(new MemoryStream(excel.Template("products")));
        var headers = template.Worksheet(1).Row(1).CellsUsed().Select(c => c.GetString()).ToList();
        foreach (var name in new[] { "Category", "Type", "Sub-Category", "Class", "Brand", "product_family", "Size", "Length", "Pack Size", "MRP Pkg" }) Assert.Contains(name, headers);
        using var import = Workbook(new[] { "UPVC", "UPVC", "UPVC" });
        var result = await excel.ImportProductsAsync(import, false);
        Assert.Equal(3, result.Created);
        import.Position = 0;
        Assert.Equal(3, (await excel.ImportProductsAsync(import, false)).Updated);
        Assert.Equal(2, await db.CatalogFamilies.CountAsync(f => f.CategoryId == category.Id));
        var products = await db.Products.Where(p => p.CategoryId == category.Id).OrderBy(p => p.Code).ToListAsync();
        Assert.Equal(products[0].CatalogFamilyId, products[1].CatalogFamilyId);
        Assert.NotEqual(products[0].CatalogFamilyId, products[2].CatalogFamilyId);
        products.ForEach(p => p.StockQty = 100);
        await db.SaveChangesAsync();

        var viewer = Viewer.Retail(ClientChannel.Web);
        var catalog = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var query = new CatalogQuery(null, category.Id, sub.Id, null, null, null, null, null, Collapse: true, TypeId: type.Id, Class: "SDR 11");
        var cards = await catalog.SearchAsync(query, viewer);
        Assert.Equal(2, cards.Total);
        Assert.Equal(2, (await catalog.SearchAsync(query, Viewer.Retail(ClientChannel.App))).Total);
        Assert.Equal(1, Assert.Single((await catalog.SearchAsync(query with { Size = "25 mm" }, viewer)).Items).VariantCount);
        Assert.Single((await catalog.GetAsync(products[0].Id, viewer)).VariantAxes.Single(x => x.Name == "Brand").Choices);
        var selected = await admin.ListProductsAsync(new ProductAdminQuery(null, null, null, null, null, null, null, null, Ids: products[0].Id.ToString()));
        Assert.Single(selected.Items);
        var exported = excel.Export("Products", selected.Items, ExcelService.ProductExportColumns());
        Assert.Equal(1, (await excel.ImportProductsAsync(new MemoryStream(exported), false)).Updated);
        Assert.Equal("SDR 11", (await admin.GetProductAsync(products[0].Id)).Catalog!.Class);

        var shopper = new AppUser { Name = "Package shopper", UserType = UserType.Customer };
        db.Users.Add(shopper); await db.SaveChangesAsync();
        var cart = scope.ServiceProvider.GetRequiredService<ICartService>();
        await cart.SetQuantityAsync(shopper.Id, new CartUpdate(products[0].Id, 1, "Box"), viewer, false);
        var mixed = await cart.SetQuantityAsync(shopper.Id, new CartUpdate(products[0].Id, 2), viewer, false);
        Assert.Equal(2, mixed.Items.Count);
        Assert.Equal(20, mixed.Items.Single(i => i.PurchaseUnit == "Box").BaseQuantity);
        Assert.Equal(900, mixed.Items.Single(i => i.PurchaseUnit == "Box").LineTotal);
        Assert.Equal(100, await db.Products.Where(p => p.Id == products[0].Id).Select(p => p.StockQty).SingleAsync());
        await Assert.ThrowsAsync<AppException>(() => cart.SetQuantityAsync(shopper.Id, new CartUpdate(products[0].Id, 5, "Box"), viewer, false));
        foreach (var invalid in new[] { "UNKNOWN", "" })
        {
            // Blank Type is allowed for legacy files; unknown predefined values are not.
            if (invalid.Length == 0) continue;
            using var bad = Workbook(new[] { invalid });
            await Assert.ThrowsAsync<ImportValidationException>(() => excel.ImportProductsAsync(bad, true));
            db.ChangeTracker.Clear();
        }
        using var badSub = Workbook(new[] { "UPVC" }, "Unknown Subcategory");
        await Assert.ThrowsAsync<ImportValidationException>(() => excel.ImportProductsAsync(badSub, true));
    }

    [PostgresFact]
    public async Task Mixed_piece_and_box_dispatch_deducts_base_units_once_and_invoice_uses_snapshot()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var p = new Product { Code = "PKG-DISPATCH", Name = "Dispatch package", Category = new Category { Name = "Dispatch category" }, Brand = new Brand { Name = "Dispatch brand" }, StockQty = 100, Mrp = 50, ListPrice = 45, PackSize = 20, BoxDiscountType = "Percentage", BoxDiscountValue = 10 };
        db.Products.Add(p); await db.SaveChangesAsync();
        var order = new Order { OrderNo = "PACKAGE-DISPATCH", CustomerName = "Test", Status = OrderStatus.Paid, PaymentStatus = PaymentStatus.Success, PaymentMethod = PaymentMethod.CashAtStore, CustomerKind = CustomerKind.Retail, Channel = SalesChannel.Web };
        var box = new OrderItem { ProductId = p.Id, ProductCode = p.Code, ProductName = p.Name, Quantity = 20, ListPrice = 45, GstRate = 18 };
        Packaging.Snapshot(box, p, "Box");
        order.Items.Add(box);
        order.Items.Add(new OrderItem { ProductId = p.Id, ProductCode = p.Code, ProductName = p.Name, Quantity = 2, ListPrice = 45, GstRate = 18 });
        Pricing.Recalculate(order); order.AmountPaid = order.GrandTotal;
        db.Orders.Add(order); await db.SaveChangesAsync();
        var orders = scope.ServiceProvider.GetRequiredService<IOrderService>();
        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            await orders.ReserveAsync(order, default); await db.SaveChangesAsync(); await tx.CommitAsync();
        }
        Assert.Equal(22, p.ReservedQty);
        p.PackSize = 5; p.Mrp = 100; p.BoxDiscountValue = 0;
        await db.SaveChangesAsync();
        var admin = scope.ServiceProvider.GetRequiredService<IOrderAdminService>();
        await admin.DispatchAsync(order.Id, new DispatchRequest(null, null, null, null, null));
        db.ChangeTracker.Clear();
        var saved = await db.Products.SingleAsync(x => x.Id == p.Id);
        Assert.Equal(78, saved.StockQty); Assert.Equal(0, saved.ReservedQty);
        var detail = await orders.GetAsync(order.Id, null);
        Assert.Equal(990, detail.GrandTotal);
        Assert.Equal(20, detail.Items.Single(x => x.PurchaseUnit == "Box").PackSize);
        var invoice = await orders.InvoiceAsync(order.Id, null);
        var line = invoice.Lines.Single(x => x.Unit == "BOX");
        Assert.Equal(1, line.Quantity); Assert.Equal(900, line.Total);
        await Assert.ThrowsAsync<AppException>(() => admin.DispatchAsync(order.Id, new DispatchRequest(null, null, null, null, null)));
        Assert.Equal(78, await db.Products.Where(x => x.Id == p.Id).Select(x => x.StockQty).SingleAsync());
    }

    [PostgresFact]
    public async Task Checkout_and_pending_payment_keep_original_package_price_and_reserve_base_units()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var p = new Product { Code = "PKG-CHECKOUT", Name = "Checkout package", Category = new Category { Name = "Checkout category" }, Brand = new Brand { Name = "Checkout brand" }, StockQty = 100, Mrp = 50, ListPrice = 45, PackSize = 20, BoxDiscountType = "Fixed", BoxDiscountValue = 100 };
        var user = new AppUser { Name = "Local test shopper", UserType = UserType.Customer, Phone = "9000000001" };
        db.AddRange(p, user); await db.SaveChangesAsync();
        var cart = scope.ServiceProvider.GetRequiredService<ICartService>();
        var orders = scope.ServiceProvider.GetRequiredService<IOrderService>();
        await cart.SetQuantityAsync(user.Id, new CartUpdate(p.Id, 1, "Box"), Viewer.Retail(ClientChannel.Web), false);
        var gateway = new TestGateway();
        var checkout = new CheckoutService(db, cart, orders, gateway, scope.ServiceProvider.GetRequiredService<ISettingsService>(), Options.Create(new CashfreeOptions()), NullLogger<CheckoutService>.Instance);
        var result = await checkout.CheckoutAsync(user.Id, new CheckoutRequest(FulfilmentType.StorePickup, null, null, null, null), Viewer.Retail(ClientChannel.Web));
        Assert.Equal(900, result.Amount); Assert.Equal("sandbox", result.Environment);
        p.PackSize = 5; p.Mrp = 100; p.BoxDiscountValue = 0; await db.SaveChangesAsync();
        var retry = await checkout.RetryPaymentAsync(user.Id, result.OrderId, null);
        Assert.Equal(900, retry.Amount); Assert.Equal(result.PaymentSessionId, retry.PaymentSessionId);
        await cart.SetQuantityAsync(user.Id, new CartUpdate(p.Id, 2, "Piece"), Viewer.Retail(ClientChannel.Web), false);
        gateway.Paid = true;
        await checkout.ConfirmAsync(user.Id, result.OrderId);
        await checkout.ConfirmAsync(user.Id, result.OrderId);
        db.ChangeTracker.Clear();
        Assert.Equal(20, await db.Products.Where(x => x.Id == p.Id).Select(x => x.ReservedQty).SingleAsync());
        var order = await orders.GetAsync(result.OrderId, user.Id);
        Assert.Equal(900, order.GrandTotal); Assert.Equal(20, order.Items.Single().PackSize);
        Assert.Equal(1, order.Items.Single().PurchaseQuantity);
        var remaining = await cart.GetAsync(user.Id, Viewer.Retail(ClientChannel.Web));
        Assert.Equal("Piece", remaining.Items.Single().PurchaseUnit);
        Assert.Equal(2, remaining.Items.Single().Quantity);
    }

    // Test-only gateway double; no real Cashfree credentials or network calls.
    private sealed class TestGateway : IPaymentGateway
    {
        public bool Paid { get; set; }
        private decimal _amount;
        public Task<GatewayOrderResult> CreateOrderAsync(GatewayOrderRequest r, CancellationToken ct = default) { _amount = r.Amount; return Task.FromResult(new GatewayOrderResult(r.GatewayOrderId, "local-test-session", null, "{}")); }
        public Task<GatewayStatus> GetStatusAsync(string id, CancellationToken ct = default) => Task.FromResult(new GatewayStatus(id, Paid, false, _amount, "local-test", "{}"));
        public Task<string> EnvironmentAsync(string id, CancellationToken ct = default) => Task.FromResult("sandbox");
        public Task<string> RefundAsync(string id, decimal amount, string refundId, string note, CancellationToken ct = default) => Task.FromResult("{}");
        public Task<bool> VerifyWebhookAsync(string body, string? signature, string? timestamp, CancellationToken ct = default) => Task.FromResult(false);
        public Task<(bool Ok, string Message)> TestConnectionAsync(CancellationToken ct = default) => Task.FromResult((true, "Test only"));
        public string? ExtractOrderIdFromWebhook(string body) => null;
    }

    private static MemoryStream Workbook(string[] types, string sub = "Fitting")
    {
        using var wb = new XLWorkbook(); var ws = wb.AddWorksheet("Products");
        var headers = new[] { "Code", "Name", "Category", "Sub-Category", "Brand", "Unit", "List Price", "MRP", "Type", "Class", "product_family", "Size", "Length", "Pack Size", "Box Discount Type", "Box Discount Value", "Image URL" };
        for (int i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
        for (int row = 0; row < types.Length; row++)
        {
            var values = new[] { $"PKG-{row}", "Test fitting", "Catalog test", sub, row == 2 ? "Brand B" : "Brand A", "pcs", "45", "50", types[row], "SDR 11", "Elbow", row == 1 ? "25 mm" : "20 mm", "3 m", "20 pieces", "Percentage", "10", "https://example.test/w_200,h_200/image.jpg" };
            for (int i = 0; i < values.Length; i++) ws.Cell(row + 2, i + 1).Value = values[i];
        }
        var stream = new MemoryStream(); wb.SaveAs(stream); stream.Position = 0; return stream;
    }
}

