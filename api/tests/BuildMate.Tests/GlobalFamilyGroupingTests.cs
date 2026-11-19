using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BuildMate.Tests;

/// <summary>
/// One card per product family for all brands, in every module (real PostgreSQL: set BUILDMATE_TEST_DB to run).
/// Family identity = category + Type + family key; the brand is only an option on the product page.
/// </summary>
public class GlobalFamilyGroupingTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;
    public GlobalFamilyGroupingTests(TestDatabase database) => _database = database;

    private sealed class Data
    {
        public Category Pipes = new() { Name = "Gfg Pipe & Fitting" }, Electrical = new() { Name = "Gfg Electrical" },
            Sanitary = new() { Name = "Gfg Sanitary" }, Paints = new() { Name = "Gfg Paints" };
        public Dictionary<string, Brand> Brands = new();
        public Dictionary<string, Product> Products = new();
    }

    private static async Task<Data> SeedAsync(AppDbContext db)
    {
        var d = new Data();
        Brand B(string name) => d.Brands.TryGetValue(name, out var b) ? b : d.Brands[name] = new Brand { Name = "Gfg " + name };
        var families = new Dictionary<string, CatalogFamily>();
        CatalogFamily F(Category c, string brand, string name) =>
            families.TryGetValue($"{c.Name}|{brand}|{name}", out var f) ? f
                : families[$"{c.Name}|{brand}|{name}"] = new CatalogFamily { Category = c, Brand = B(brand), Key = CatalogStructure.Key(name), Name = name };
        var cpvc = new ProductType { Category = d.Pipes, Name = "CPVC", Key = "CPVC" };
        var switches = new ProductType { Category = d.Electrical, Name = "Switches", Key = "SWITCHES" };
        var sockets = new ProductType { Category = d.Electrical, Name = "Sockets", Key = "SOCKETS" };
        var emulsion = new ProductType { Category = d.Paints, Name = "Emulsion", Key = "EMULSION", GroupAcrossBrands = false }; // admin: one card per brand
        var seq = 0;
        void P(string code, Category c, string brand, ProductType? type, string? family, decimal price, decimal stock = 10, string? size = null,
            string? module = null, bool active = true, string? legacyFamily = null) =>
            d.Products[code] = new Product
            {
                Code = "GFG-" + code, Name = $"Gfg {brand} {family ?? legacyFamily ?? code} {size ?? module}".Trim(), Category = c, Brand = B(brand),
                ProductType = type, CatalogFamily = family == null ? null : F(c, brand, family), VariantFamily = family ?? legacyFamily,
                Size = size, Module = module, ListPrice = price, Mrp = price, StockQty = stock, Sequence = ++seq, IsActive = active,
            };
        // 1. CPVC Pipe: Astral / Finolex / King / Supreme → one family (Supreme out of stock).
        P("ASTRAL-20", d.Pipes, "Astral", cpvc, "PIPE", 100, size: "20 mm"); P("ASTRAL-25", d.Pipes, "Astral", cpvc, "PIPE", 140, size: "25 mm");
        P("FINOLEX-20", d.Pipes, "Finolex", cpvc, "PIPE", 95, size: "20 mm"); P("KING-20", d.Pipes, "King", cpvc, "Pipe", 90, size: "20 mm");
        P("SUPREME-20", d.Pipes, "Supreme", cpvc, "PIPE", 85, stock: 0, size: "20 mm");
        P("ASTRAL-ELBOW", d.Pipes, "Astral", cpvc, "ELBOW 90", 20, size: "20 mm"); P("KING-ELBOW", d.Pipes, "King", cpvc, "ELBOW 90", 18, size: "20 mm");
        // 2. WIT + Anchor switches (same Type) → one "Switches" card; WIT is out of stock.
        P("WIT-1M", d.Electrical, "WIT", switches, "Switches", 60, stock: 0, module: "1M");
        P("ANCHOR-1M", d.Electrical, "Anchor", switches, "Switches", 55, module: "1M"); P("ANCHOR-2M", d.Electrical, "Anchor", switches, "Switches", 80, module: "2M");
        // 3. Different families / types stay separate.
        P("ANCHOR-FLAT", d.Electrical, "Anchor", switches, "Flat Switches", 70); P("ANCHOR-FLAT-2", d.Electrical, "Anchor", switches, "Flat Switches", 75);
        P("ANCHOR-SOCKET-SW", d.Electrical, "Anchor", sockets, "Switches", 99);
        P("NOFAMILY", d.Electrical, "WIT", switches, null, 30);
        // 7. Other modules: no Type, a legacy family name only, an admin "one card per brand" Type, a fully inactive family.
        P("JAQUAR-PC", d.Sanitary, "Jaquar", null, "Pillar Cock", 900); P("HINDWARE-PC", d.Sanitary, "Hindware", null, "Pillar Cock", 850);
        P("JAQUAR-BIB", d.Sanitary, "Jaquar", null, null, 500, legacyFamily: "Bib Cock"); P("CERA-BIB", d.Sanitary, "Cera", null, null, 450, legacyFamily: " bib cock ");
        P("HIDDEN-1", d.Sanitary, "Jaquar", null, "Retired Mixer", 10, active: false); P("HIDDEN-2", d.Sanitary, "Cera", null, "Retired Mixer", 10, active: false);
        P("ASIAN-EM", d.Paints, "Asian", emulsion, "Emulsion", 400); P("ASIAN-EM-2", d.Paints, "Asian", emulsion, "Emulsion", 700);
        P("BERGER-EM", d.Paints, "Berger", emulsion, "Emulsion", 380); P("BERGER-EM-2", d.Paints, "Berger", emulsion, "Emulsion", 650);
        db.Products.AddRange(d.Products.Values);
        await db.SaveChangesAsync();
        return d;
    }

    private static async Task<List<ProductCardDto>> Cards(ICatalogService catalog, Category c, Viewer v, long? brandId = null, int pageSize = 200, int page = 1) =>
        (await catalog.SearchAsync(new CatalogQuery(null, c.Id, null, brandId, null, null, null, null, page, pageSize, Collapse: true), v)).Items.ToList();

    [PostgresFact]
    public async Task One_card_per_family_for_all_brands_in_every_module()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var d = await SeedAsync(db);
        var v = Viewer.Retail(ClientChannel.Web);
        string Names(List<ProductCardDto> cards) => string.Join(" | ", cards.Select(c => c.Name).OrderBy(n => n));

        // 1. CPVC PIPE: one card, 5 variants of 4 brands, from the lowest price; Supreme being out of stock doesn't matter.
        var pipes = await Cards(catalog, d.Pipes, v);
        Assert.Equal("CPVC ELBOW 90 | CPVC PIPE", Names(pipes));
        var pipe = pipes.Single(c => c.Name == "CPVC PIPE");
        Assert.True(pipe.AllBrands);
        Assert.Equal((5, 85m, true), (pipe.VariantCount, pipe.FromPrice!.Value, pipe.InStock));
        Assert.Equal(new[] { "Gfg Astral", "Gfg Finolex", "Gfg King", "Gfg Supreme" }, pipe.Brands);

        // 2 + 3. Electrical: one "Switches" card (WIT + Anchor); Flat Switches, the Sockets type and a product without family stay separate.
        var electrical = await Cards(catalog, d.Electrical, v);
        Assert.Equal(4, electrical.Count);
        var sw = electrical.Single(c => c.AllBrands && c.Catalog!.TypeName == "Switches" && c.Catalog.ProductFamily == "Switches");
        Assert.Equal(("Switches", 3, 55m, true), (sw.Name, sw.VariantCount, sw.FromPrice!.Value, sw.InStock));
        Assert.Equal(new[] { "Gfg Anchor", "Gfg WIT" }, sw.Brands);
        Assert.Single(electrical, c => c.Name == "Flat Switches");
        Assert.Single(electrical, c => c.Catalog!.TypeName == "Sockets");
        Assert.Single(electrical, c => c.Code == "GFG-NOFAMILY");

        // Pagination counts families, not variants; the brand filter narrows the same cards.
        var page1 = await catalog.SearchAsync(new CatalogQuery(null, d.Electrical.Id, null, null, null, null, null, null, 1, 3, Collapse: true), v);
        var page2 = await catalog.SearchAsync(new CatalogQuery(null, d.Electrical.Id, null, null, null, null, null, null, 2, 3, Collapse: true), v);
        Assert.Equal(4, page1.Total);
        Assert.Equal(4, page1.Items.Concat(page2.Items).Select(c => c.Id).Distinct().Count());
        var anchorOnly = (await Cards(catalog, d.Electrical, v, d.Brands["Anchor"].Id)).Single(c => c.Catalog!.ProductFamily == "Switches" && c.Catalog.TypeName == "Switches");
        Assert.Equal(2, anchorOnly.VariantCount);

        // 7. Other modules: typeless and legacy families group by name; "one card per brand" keeps two cards; inactive family hidden.
        var sanitary = await Cards(catalog, d.Sanitary, v);
        Assert.Equal("Bib Cock | Pillar Cock", Names(sanitary));
        Assert.All(sanitary, c => Assert.Equal(2, c.VariantCount));
        var paints = await Cards(catalog, d.Paints, v);
        Assert.Equal(2, paints.Count);
        Assert.All(paints, c => Assert.False(c.AllBrands));

        // 5. A family is out of stock only when every brand is: make Anchor 0 too.
        await db.Products.Where(p => p.Code == "GFG-ANCHOR-1M" || p.Code == "GFG-ANCHOR-2M").ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQty, 0m));
        Assert.False((await Cards(catalog, d.Electrical, v)).Single(c => c.Id == sw.Id).InStock);
        await db.Products.Where(p => p.Code == "GFG-ANCHOR-1M" || p.Code == "GFG-ANCHOR-2M").ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQty, 10m));
    }

    [PostgresFact]
    public async Task Product_page_offers_every_brand_and_the_cart_gets_the_variant()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        var cart = scope.ServiceProvider.GetRequiredService<ICartService>();
        var d = await SeedAsync(db);
        var v = Viewer.Retail(ClientChannel.Web);
        string Values(ProductDetailDto x, string axis) => string.Join(" | ", x.VariantAxes.Single(a => a.Name == axis).Choices.Select(c => c.Value));

        // 4. Brand switch: each choice opens that brand's own variant (its price, code and stock).
        var astral = await catalog.GetAsync(d.Products["ASTRAL-20"].Id, v);
        Assert.Equal("Gfg Astral | Gfg Finolex | Gfg King | Gfg Supreme", Values(astral, "Brand"));
        var king = astral.VariantAxes.Single(a => a.Name == "Brand").Choices.Single(c => c.Value == "Gfg King");
        Assert.Equal(d.Products["KING-20"].Id, king.ProductId);
        var kingPage = await catalog.GetAsync(king.ProductId, v);
        Assert.Equal(("GFG-KING-20", 90m, true), (kingPage.Code, kingPage.Price, kingPage.InStock));
        // 5. Out-of-stock brand stays visible, marked out of stock.
        Assert.False(astral.VariantAxes.Single(a => a.Name == "Brand").Choices.Single(c => c.Value == "Gfg Supreme").InStock);

        // Switches: Brand, then Module (it differs); no Size/Class rows that the family doesn't have.
        var wit = await catalog.GetAsync(d.Products["WIT-1M"].Id, v);
        Assert.Equal("Brand | Module", string.Join(" | ", wit.VariantAxes.Select(a => a.Name)));
        Assert.Equal("Gfg Anchor | Gfg WIT", Values(wit, "Brand"));
        Assert.False(wit.InStock);
        Assert.DoesNotContain(wit.Related, r => r.Catalog?.ProductFamily == "Switches" && r.Catalog.TypeName == "Switches"); // not "related" to itself

        // 6. The cart receives the variant id (never a family), with that variant's code, brand and price; stock is checked per variant.
        var shopper = new AppUser { Name = "Gfg shopper", UserType = UserType.Customer };
        db.Users.Add(shopper); await db.SaveChangesAsync();
        var anchor = wit.VariantAxes.Single(a => a.Name == "Brand").Choices.Single(c => c.Value == "Gfg Anchor").ProductId;
        var line = (await cart.SetQuantityAsync(shopper.Id, new CartUpdate(anchor, 2), v, false)).Items.Single();
        Assert.Equal((anchor, "GFG-ANCHOR-1M", "Gfg Anchor", 55m), (line.ProductId, line.Code, line.BrandName, line.UnitPrice));
        var refused = await Assert.ThrowsAsync<AppException>(() => cart.SetQuantityAsync(shopper.Id, new CartUpdate(d.Products["WIT-1M"].Id, 1), v, false));
        Assert.Contains("in stock", refused.Message); // WIT has none — Anchor's stock does not count for it
    }
}
