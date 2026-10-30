using BuildMate.Services.Payments;
using Xunit;

namespace BuildMate.Tests;

/// <summary>Cashfree set-up problems shown in admin → Integrations and logged at start-up.</summary>
public class CashfreeSetupTests
{
    private static CashfreeOptions Good(string env = "sandbox") => new()
    {
        Environment = env, ClientId = "TEST123", ClientSecret = "secret",
        WebReturnUrl = "https://buildmate24x7.com/checkout/return?order={orderId}",
        NotifyUrl = "https://api.buildmate24x7.com/api/payments/cashfree/webhook",
    };

    [Fact]
    public void Complete_setup_has_no_problems() => Assert.Empty(Good("production").Problems());

    [Fact]
    public void Missing_keys_are_reported()
    {
        var o = Good(); o.ClientSecret = "";
        Assert.False(o.KeysSet);
        Assert.Contains(o.Problems(), p => p.Contains("keys are empty"));
    }

    [Fact]
    public void Placeholder_addresses_are_reported()
    {
        var o = Good(); o.WebReturnUrl = "https://www.example.com/checkout/return?order={orderId}"; o.NotifyUrl = "http://localhost:8080/api/payments/cashfree/webhook";
        Assert.Equal(2, o.Problems().Count(p => p.Contains("set the real public address")));
    }

    [Fact]
    public void Production_needs_https()
    {
        var o = Good("production"); o.NotifyUrl = "http://api.buildmate24x7.com/api/payments/cashfree/webhook";
        Assert.Contains(o.Problems(), p => p.Contains("https://"));
        o.Environment = "sandbox";
        Assert.Empty(o.Problems());
    }

    [Fact]
    public void Unknown_environment_is_reported()
    {
        var o = Good("live");
        Assert.Contains(o.Problems(), p => p.Contains("sandbox"));
    }
}
