using BuildMate.Domain.Entities;
using BuildMate.Services.Catalog;
using Xunit;

namespace BuildMate.Tests;

/// <summary>
/// "UI flow for Pipe &amp; Fitting / Electrical cable": one card per family for all brands, and a product page that offers
/// Brand → Class → only the Sizes of that brand + class (no jumping to another brand).
/// </summary>
public class AllBrandFamilyTests
{
    private static Product P(long id, string brand, string? cls, string? size, int seq, decimal stock = 10, string? length = null) => new()
    {
        Id = id, Sequence = seq, Brand = new Brand { Name = brand }, ProductClass = cls, Size = size, Length = length, StockQty = stock,
    };

    // Astral has SCH 40 in 50 and 75 mm; King has SCH 40 in 50 and 100 mm and SCH 80 in 50 mm.
    private static readonly List<Product> Pipes = new()
    {
        P(1, "Astral", "SCH 40", "50 mm", 1), P(2, "Astral", "SCH 40", "75 mm", 2),
        P(3, "King", "SCH 40", "50 mm", 3), P(4, "King", "SCH 40", "100 mm", 4), P(5, "King", "SCH 80", "50 mm", 5),
    };

    private static string Values(List<VariantAxisDto> axes, string name) => string.Join(" | ", axes.Single(a => a.Name == name).Choices.Select(c => c.Value));

    [Fact]
    public void Narrow_sizes_are_only_those_of_the_selected_brand_and_class()
    {
        var axes = FamilyAxes.Build(Pipes[0], Pipes, narrow: true);
        Assert.Equal("Astral | King", Values(axes, "Brand"));
        Assert.Equal("SCH 40", Values(axes, "Class"));          // Astral makes only SCH 40
        Assert.Equal("50 mm | 75 mm", Values(axes, "Size"));  // 100 mm is King only: not offered
        Assert.True(axes.Single(a => a.Name == "Size").Choices.All(c => c.Exact));
    }

    [Fact]
    public void Switching_brand_keeps_class_then_size_when_that_brand_has_them()
    {
        var axes = FamilyAxes.Build(Pipes[0], Pipes, narrow: true);
        var king = axes.Single(a => a.Name == "Brand").Choices.Single(c => c.Value == "King");
        Assert.Equal(3, king.ProductId); // King SCH 40 50 mm (same class and size)
        var kingAxes = FamilyAxes.Build(Pipes[3], Pipes, narrow: true); // King SCH 40 100 mm
        Assert.Equal("SCH 40 | SCH 80", Values(kingAxes, "Class"));
        Assert.Equal("50 mm | 100 mm", Values(kingAxes, "Size"));
        Assert.Equal(1, kingAxes.Single(a => a.Name == "Brand").Choices.Single(c => c.Value == "Astral").ProductId); // falls back to Astral SCH 40 50 mm
    }

    [Fact]
    public void Without_narrow_the_old_behaviour_is_unchanged()
    {
        var axes = FamilyAxes.Build(Pipes[0], Pipes);
        Assert.Equal("50 mm | 75 mm | 100 mm", Values(axes, "Size"));
    }

    [Fact]
    public void Class_row_uses_the_type_label()
    {
        var cables = new List<Product> { P(1, "Ultravolt", "White", null, 1, length: "90 m"), P(2, "Ultravolt", "White", null, 2, length: "180 m"), P(3, "Ultravolt", "Black", null, 3, length: "90 m") };
        var axes = FamilyAxes.Build(cables[0], cables, narrow: true, classLabel: "Color");
        Assert.Equal("Brand | Color | Length", string.Join(" | ", axes.Select(a => a.Name)));
        Assert.Equal("Black | White", Values(axes, "Color"));
        Assert.Equal("90 m | 180 m", Values(axes, "Length"));
    }

    // Global family grouping: every module shows one card per family for all brands unless the admin chose "One card per brand".
    [Theory]
    [InlineData("Pipe & Fitting", "CPVC", true, "Class")]
    [InlineData("Pipes & Fittings", "UPVC", true, "Class")]
    [InlineData("Electrical", "CABLE", true, "Color")]
    [InlineData("Electrical", "SWITCH", true, "Class")]
    [InlineData("Paints", "EMULSION", true, "Class")]
    [InlineData("Sanitary", "FAUCETS", true, "Class")]
    public void Automatic_rules(string category, string typeKey, bool allBrands, string label)
    {
        var t = new ProductType { Key = typeKey, Name = typeKey };
        Assert.Equal(allBrands, CatalogStructure.AllBrands(t, category));
        Assert.Equal(label, CatalogStructure.ClassLabel(t, category));
    }

    [Fact]
    public void Admin_settings_override_the_automatic_rules()
    {
        var t = new ProductType { Key = "SWITCH", GroupAcrossBrands = true, ClassLabel = "Finish" };
        Assert.True(CatalogStructure.AllBrands(t, "Electrical"));
        Assert.Equal("Finish", CatalogStructure.ClassLabel(t, "Electrical"));
        Assert.False(CatalogStructure.AllBrands(new ProductType { Key = "CPVC", GroupAcrossBrands = false }, "Pipe & Fitting"));
        Assert.False(CatalogStructure.AllBrands(new ProductType { Key = "SWITCH", GroupAcrossBrands = false }, "Electrical"));
    }

    [Theory]
    [InlineData("CPVC", "PIPE", "CPVC PIPE")]
    [InlineData("CPVC", "CPVC Pipe", "CPVC Pipe")]
    [InlineData("Cable", "CCTV", "Cable CCTV")]
    [InlineData("Cable", "CCTV Cable", "CCTV Cable")]
    [InlineData("Switches", "Switches", "Switches")]
    [InlineData("Switch", "Switches", "Switches")]            // singular / plural is the same word
    [InlineData("Modular Switches", "Flat Switches", "Flat Switches")]
    [InlineData("Faucets", "Pillar Cock", "Faucets Pillar Cock")]
    [InlineData(null, "Switches", "Switches")]                // no Type
    public void Card_title_has_no_brand(string? type, string family, string title) => Assert.Equal(title, CatalogStructure.CardTitle(type, family));

    // ---- Product attributes as options (switches: one family for WIT and Anchor) ----

    private static Product S(long id, string brand, string? module, string? color, int seq, decimal stock = 10) => new()
    {
        Id = id, Sequence = seq, Brand = new Brand { Name = brand }, Module = module, Color = color, StockQty = stock,
    };

    [Fact]
    public void Attributes_that_differ_in_the_family_become_options_others_do_not()
    {
        var switches = new List<Product> { S(1, "Anchor", "1M", "White", 1), S(2, "Anchor", "2M", "White", 2), S(3, "WIT", "1M", "White", 3, stock: 0) };
        var axes = FamilyAxes.Build(switches[0], switches, narrow: true);
        Assert.Equal("Brand | Module", string.Join(" | ", axes.Select(a => a.Name))); // every switch is White: no Color row
        Assert.Equal("Anchor | WIT", Values(axes, "Brand"));
        Assert.Equal("1M | 2M", Values(axes, "Module"));
        var wit = axes.Single(a => a.Name == "Brand").Choices.Single(c => c.Value == "WIT");
        Assert.Equal(3, wit.ProductId);   // opens the WIT variant itself
        Assert.False(wit.InStock);        // shown with "Out of stock", not hidden
    }

    [Fact]
    public void Families_without_attributes_get_the_same_options_as_before()
    {
        var axes = FamilyAxes.Build(Pipes[0], Pipes, narrow: true);
        Assert.Equal("Brand | Class | Size", string.Join(" | ", axes.Select(a => a.Name)));
    }
}
