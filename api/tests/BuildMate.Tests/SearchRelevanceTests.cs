using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BuildMate.Tests;

/// <summary>Product search (website and app use the same API): only products the words are about.</summary>
public class SearchRelevanceTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;
    public SearchRelevanceTests(TestDatabase database) => _database = database;

    [PostgresFact]
    public async Task Search_returns_only_relevant_products()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pipes = new Category { Name = "Srch Pipes & Fittings" };
        var electrical = new Category { Name = "Srch Electrical" };
        var astral = new Brand { Name = "Srchastral" };
        var havells = new Brand { Name = "Srchhavells India" };
        var modular = new SubCategory { Name = "Srchmodular Accessories", Category = electrical };
        Product P(string code, string name, Category c, Brand b, SubCategory? s = null) =>
            new() { Code = code, Name = name, Category = c, Brand = b, SubCategory = s, ListPrice = 10, Mrp = 10 };
        db.Products.AddRange(
            P("SRCH-1", "Srch CPVC Pipe SDR 11 20 mm", pipes, astral),
            P("SRCH-2", "Srch UPVC Pipes 6 m", pipes, astral),
            P("SRCH-3", "Srch CPVC Elbow 20 mm", pipes, astral),
            P("SRCH-4", "Srch 10A 1 Way Switch", electrical, havells, modular),
            P("SRCH-5", "Srch 6A Socket", electrical, havells, modular),
            P("SRCH-6", "Srch Switchboard Telephone Cable", electrical, astral),
            P("SRCH-7", "Srch Pipeline Cleaner", pipes, astral));
        await db.SaveChangesAsync();
        var catalog = new CatalogService(db);
        var viewer = Viewer.Retail(ClientChannel.Web);
        async Task<List<string>> Codes(string text) =>
            (await catalog.SearchAsync(new CatalogQuery(text, null, null, null, null, null, null, null, PageSize: 200), viewer))
                .Items.Where(c => c.Code.StartsWith("SRCH")).Select(c => c.Code).OrderBy(c => c).ToList();

        Assert.Equal(new[] { "SRCH-1", "SRCH-2" }, await Codes("Pipe"));                // not the switch, not "Pipeline"
        Assert.Equal(new[] { "SRCH-1", "SRCH-2" }, await Codes("  PIPES  "));           // case, plural, extra spaces
        Assert.Equal(new[] { "SRCH-1", "SRCH-3" }, await Codes("cpvc"));
        Assert.Equal(new[] { "SRCH-4" }, await Codes("Switch"));                       // not the socket or switchboard cable
        Assert.Equal(new[] { "SRCH-4", "SRCH-5" }, await Codes("srchhavells"));         // brand
        Assert.Equal(new[] { "SRCH-4", "SRCH-5" }, await Codes("srchmodular"));          // sub-category name
        Assert.Equal(new[] { "SRCH-4" }, await Codes("srch-4"));                        // code / SKU
        Assert.Equal(new[] { "SRCH-4", "SRCH-6" }, await Codes("Srch swi"));            // partly typed word
        Assert.Empty(await Codes("xyzzy"));
    }
}
