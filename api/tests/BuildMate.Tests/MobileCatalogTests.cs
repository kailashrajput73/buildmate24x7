using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using BuildMate.Services.Partners;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BuildMate.Tests;

public class MobileCatalogTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;
    public MobileCatalogTests(TestDatabase database) => _database = database;

    [Theory]
    [InlineData("20mm", "20 mm")]
    [InlineData("sdr11", "sdr 11")]
    [InlineData("cpvc coupler 25", "cpvc coupler 25")]
    public void Search_normalizes_unit_spacing(string input, string expected) => Assert.Equal(expected, PipeOptions.NormalizeSearch(input));

    private static Product Item(long id, string brand, string cls, string size) => new() {
        Id = id, Code = $"TEST-{id}", Name = "Unrelated display name", Brand = new Brand { Name = brand },
        Specs = new() { "Material: CPVC", "Item Type: Coupler", $"SDR: {cls}", $"Size: {size}" }, StockQty = 5
    };

    [Fact]
    public void Axes_always_show_three_rows_and_preserve_size_across_brand_changes()
    {
        var a = Item(1, "King", "11", "20 mm");
        var b = Item(2, "Astral", "13", "20 mm");
        var c = Item(3, "Astral", "11", "25 mm");
        var axes = PipeOptions.Axes(a, new[] { a, b, c });
        Assert.Equal(new[] { "Brand", "Class", "Size" }, axes.Select(x => x.Name));
        var astral = axes[0].Choices.Single(c => c.Value == "Astral");
        Assert.Equal(2, astral.ProductId);
        Assert.False(astral.Exact);
        Assert.Equal(3, PipeOptions.Axes(a, new[] { a }).Count);
        Assert.Equal("SDR 11", axes[1].Choices.Single(c => c.Selected).Value);
    }

    [PostgresFact]
    public async Task Search_and_structured_options_work_with_real_postgres_queries()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var category = new Category { Name = "Pipes & Fittings" };
        var sub = new SubCategory { Name = "CPVC Fittings", Category = category };
        var a = Item(0, "King", "11", "20 mm");
        a.Code = "MOBILE-TEST-A"; a.Category = category; a.SubCategory = sub; a.VariantFamily = "Family A";
        var b = Item(0, "Astral", "13", "20 mm");
        b.Code = "MOBILE-TEST-B"; b.Category = category; b.SubCategory = sub; b.VariantFamily = "Family B";
        db.Products.AddRange(a, b);
        await db.SaveChangesAsync();
        var catalog = new CatalogService(db);
        var viewer = new Viewer(ClientChannel.App, CustomerKind.Retail, "en");
        foreach (var text in new[] { "20mm", "sdr 11", "CPVC", "Pipes", "King" })
        {
            var result = await catalog.SearchAsync(new CatalogQuery(text, null, null, null, null, null, null, null), viewer);
            Assert.NotEmpty(result.Items);
        }
        var detail = await catalog.GetAsync(a.Id, viewer);
        // Families are deliberately brand scoped; cross-brand options are no longer mixed.
        Assert.Single(detail.VariantAxes.Single(x => x.Name == "Brand").Choices);
        var scanned = await catalog.GetByScanAsync(" mobile-test-a ", viewer);
        Assert.Equal(a.Id, scanned.Id);
    }

    [PostgresFact]
    public async Task Customers_and_partners_have_kyc_rewards_and_independent_referrals()
    {
        using var scope = _database.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var members = scope.ServiceProvider.GetRequiredService<IMemberService>();
        foreach (var type in new[] { UserType.Customer, UserType.Partner })
        {
            var user = new AppUser { Name = "Mobile test", UserType = type, Phone = type == UserType.Customer ? "9111111111" : "9222222222" };
            if (type == UserType.Partner) user.PartnerProfile = new PartnerProfile { PartnerType = PartnerType.Plumber };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            Assert.Equal(KycStatus.NotSubmitted, (await members.GetKycAsync(user.Id)).Status);
            Assert.Equal(0, (await members.RewardsAsync(user.Id)).Balance);
            var referral = await members.GetReferralAsync(user.Id);
            Assert.False(string.IsNullOrWhiteSpace(referral.Code));
            var invited = new AppUser { Name = "Invited", Phone = "9333333333", UserType = UserType.Customer };
            await members.ApplyReferralAsync(invited, referral.Code.ToLowerInvariant());
            Assert.Equal(user.Id, invited.ReferredById);
            var withoutCode = new AppUser { Name = "No code", UserType = UserType.Customer };
            await members.ApplyReferralAsync(withoutCode, null);
            Assert.Null(withoutCode.ReferredById);
            var before = await db.Users.CountAsync();
            var error = await Assert.ThrowsAsync<AppException>(() => members.ApplyReferralAsync(withoutCode, "INVALIDCODE"));
            Assert.Contains("not valid", error.Message);
            Assert.Equal(before, await db.Users.CountAsync());
        }
    }
}
