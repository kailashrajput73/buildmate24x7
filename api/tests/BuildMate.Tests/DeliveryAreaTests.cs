using BuildMate.Services.Common;
using BuildMate.Services.Content;
using Xunit;

namespace BuildMate.Tests;

/// <summary>Delivery Areas: serviceability depends only on the selected delivery PIN code.</summary>
public class DeliveryAreaTests
{
    private sealed class MemorySettings : ISettingsService
    {
        public StoreSettings Value = new();
        public int Saves;
        public Task<StoreSettings> GetAsync(CancellationToken ct = default) => Task.FromResult(Value);
        public Task<StoreSettings> SaveAsync(StoreSettings settings, CancellationToken ct = default)
        {
            DeliveryAreaRules.Normalize(settings);
            Value = settings;
            Saves++;
            return Task.FromResult(settings);
        }
    }

    private sealed class FakeDirectory : IPincodeDirectory
    {
        public Task<PincodePlace?> LookupAsync(string pincode, CancellationToken ct = default) => Task.FromResult<PincodePlace?>(pincode switch
        {
            "370421" => new PincodePlace("370421", "Mundra", "Kachchh", "Gujarat"),
            "302001" => new PincodePlace("302001", "Jaipur", "Jaipur", "Rajasthan"),
            _ => null,
        });
    }

    private static (DeliveryAreaService svc, MemorySettings settings) Make()
    {
        var settings = new MemorySettings();
        return (new DeliveryAreaService(settings, new FakeDirectory()), settings);
    }

    [Fact]
    public async Task Serviceable_kutch_pin_allows_purchase_wherever_the_customer_is()
    {
        var (svc, _) = Make();
        await svc.AddAsync(new DeliveryAreaUpsert("370421", null, null, null, null));

        var result = await svc.CheckAsync("370421");

        Assert.True(result.Serviceable);
        Assert.Equal(DeliveryAreaRules.Serviceable, result.Status);
        Assert.Equal("Mundra", result.City);
        Assert.Equal("Kachchh", result.District);
        Assert.Equal("Gujarat", result.State);
    }

    [Fact]
    public async Task Pin_outside_the_list_is_not_serviceable_but_still_named()
    {
        var (svc, _) = Make();
        await svc.AddAsync(new DeliveryAreaUpsert("370421", null, null, null, null));

        var result = await svc.CheckAsync("302001");

        Assert.False(result.Serviceable);
        Assert.Equal(DeliveryAreaRules.NotServiceable, result.Status);
        Assert.Equal("Jaipur", result.City);
        Assert.Equal("Rajasthan", result.State);
    }

    [Fact]
    public async Task Empty_list_means_nothing_is_serviceable()
    {
        var (svc, _) = Make();
        Assert.False((await svc.CheckAsync("370421")).Serviceable);
    }

    [Fact]
    public async Task Invalid_pin_is_rejected()
    {
        var (svc, _) = Make();
        foreach (var bad in new[] { "", "12345", "1234567", "abcdef", "012345" })
            Assert.Equal(DeliveryAreaRules.Invalid, (await svc.CheckAsync(bad)).Status);
    }

    [Fact]
    public async Task Disabling_a_pin_stops_delivery_and_enabling_restores_it()
    {
        var (svc, settings) = Make();
        await svc.AddAsync(new DeliveryAreaUpsert("370421", null, null, null, null));

        await svc.UpdateAsync("370421", new DeliveryAreaUpsert(null, null, null, null, false));
        Assert.False((await svc.CheckAsync("370421")).Serviceable);
        Assert.False(DeliveryAreaRules.IsServiceable(settings.Value, "370421"));
        Assert.Empty(settings.Value.DeliveryPincodes);

        await svc.UpdateAsync("370421", new DeliveryAreaUpsert(null, null, null, null, true));
        Assert.True((await svc.CheckAsync("370421")).Serviceable);
        Assert.Equal("370421", string.Join(",", settings.Value.DeliveryPincodes));
    }

    [Fact]
    public async Task Admin_added_pin_is_serviceable_immediately_and_removal_reverts_it()
    {
        var (svc, _) = Make();
        Assert.False((await svc.CheckAsync("370201")).Serviceable);

        var added = await svc.AddAsync(new DeliveryAreaUpsert(" 370201 ", "Gandhidham", "Kachchh", "Gujarat", null));
        Assert.Equal("370201", added.Pincode);
        Assert.True((await svc.CheckAsync("370201")).Serviceable);
        Assert.Equal("Gandhidham", (await svc.CheckAsync("370201")).City);

        await svc.RemoveAsync("370201");
        Assert.False((await svc.CheckAsync("370201")).Serviceable);
    }

    [Fact]
    public async Task Duplicate_or_bad_pin_cannot_be_added()
    {
        var (svc, _) = Make();
        await svc.AddAsync(new DeliveryAreaUpsert("370421", null, null, null, null));
        var dup = await Assert.ThrowsAsync<AppException>(() => svc.AddAsync(new DeliveryAreaUpsert("370421", null, null, null, null)));
        Assert.Equal(409, dup.StatusCode);
        await Assert.ThrowsAsync<AppException>(() => svc.AddAsync(new DeliveryAreaUpsert("37042", null, null, null, null)));
    }

    [Fact]
    public async Task Home_delivery_switched_off_makes_every_pin_unavailable()
    {
        var (svc, settings) = Make();
        await svc.AddAsync(new DeliveryAreaUpsert("370421", null, null, null, null));
        settings.Value.HomeDeliveryEnabled = false;
        Assert.False((await svc.CheckAsync("370421")).Serviceable);
    }

    [Fact]
    public void Older_pin_list_is_kept_as_active_areas()
    {
        var s = new StoreSettings { DeliveryPincodes = new() { "370421", "370201", "bad" } };
        DeliveryAreaRules.Normalize(s);
        Assert.Equal("370201,370421", string.Join(",", s.DeliveryAreas.Select(a => a.Pincode).OrderBy(p => p)));
        Assert.True(DeliveryAreaRules.IsServiceable(s, "370201"));
        Assert.False(DeliveryAreaRules.IsServiceable(s, "302001"));
    }
}
