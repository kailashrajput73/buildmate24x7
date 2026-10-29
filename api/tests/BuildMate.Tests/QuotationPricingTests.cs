using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Orders;
using Xunit;

namespace BuildMate.Tests;

/// <summary>
/// Quotation money and expiry rules (Orders/QuotationService.cs). The accepted order is rebuilt with Pricing.Recalculate,
/// so these also check that a quote and the order made from it always agree to the rupee. Pure tests — no database.
/// </summary>
public class QuotationPricingTests
{
    private static Quotation Quote(decimal shipping, params (decimal list, decimal disc, decimal special, decimal qty)[] lines)
    {
        var q = new Quotation { ShippingFee = shipping, CustomerKind = CustomerKind.Partner };
        foreach (var (list, disc, special, qty) in lines)
            q.Items.Add(new QuotationItem { ListPrice = list, DiscountPercent = disc, SpecialDiscountPercent = special, Quantity = qty, GstRate = 18 });
        QuotationService.Recalculate(q);
        return q;
    }

    private static Order OrderFrom(Quotation q)
    {
        var o = new Order { ShippingFee = q.ShippingFee, CustomerKind = q.CustomerKind };
        foreach (var i in q.Items)
            o.Items.Add(new OrderItem { ListPrice = i.ListPrice, DiscountPercent = i.DiscountPercent, SpecialDiscountPercent = i.SpecialDiscountPercent, Quantity = i.Quantity, GstRate = i.GstRate });
        Pricing.Recalculate(o);
        return o;
    }

    [Fact]
    public void Extra_discount_stacks_on_the_regular_discount()
    {
        var q = Quote(0, (100m, 10m, 5m, 1m));
        Assert.Equal(85m, q.Items.Single().UnitPrice);
        Assert.Equal(85m, q.GrandTotal);
        Assert.Equal(15m, q.DiscountTotal);
    }

    [Fact]
    public void Total_is_rounded_to_the_rupee_with_round_off()
    {
        var q = Quote(0, (7.42m, 0m, 0m, 3m)); // 22.26
        Assert.Equal(22m, q.GrandTotal);
        Assert.Equal(-0.26m, q.RoundOff);
    }

    [Fact]
    public void Delivery_is_added_before_rounding()
    {
        var q = Quote(99m, (316.2m, 0m, 0m, 1m)); // 415.20
        Assert.Equal(415m, q.GrandTotal);
        Assert.Equal(-0.2m, q.RoundOff);
    }

    [Theory]
    [InlineData(340, 16, 3.5, 7)]
    [InlineData(7.42, 0, 12.25, 150)]
    [InlineData(8450, 10, 2, 3)]
    [InlineData(12.71, 4.5, 0.75, 1000)]
    public void Order_built_from_a_quote_has_the_same_total(double list, double disc, double special, double qty)
    {
        var q = Quote(49m, ((decimal)list, (decimal)disc, (decimal)special, (decimal)qty), (19.95m, 2m, 1m, 12m));
        var o = OrderFrom(q);
        Assert.Equal(q.GrandTotal, o.GrandTotal);
        Assert.Equal(q.DiscountTotal, o.DiscountTotal);
        Assert.Equal(q.SubTotal, o.SubTotal);
    }

    [Fact]
    public void Quoted_price_expires_after_valid_until()
    {
        var now = new DateTime(2026, 10, 29, 6, 0, 0, DateTimeKind.Utc);
        var q = new Quotation { Status = QuotationStatus.Quoted, ValidUntil = now.AddMinutes(-1) };
        Assert.Equal(QuotationStatus.Expired, QuotationService.EffectiveStatus(q, now));
        q.ValidUntil = now.AddMinutes(1);
        Assert.Equal(QuotationStatus.Quoted, QuotationService.EffectiveStatus(q, now));
    }

    [Theory]
    [InlineData(QuotationStatus.Requested)]
    [InlineData(QuotationStatus.Accepted)]
    [InlineData(QuotationStatus.Declined)]
    [InlineData(QuotationStatus.Cancelled)]
    public void Only_quoted_prices_can_expire(QuotationStatus status)
    {
        var now = new DateTime(2026, 10, 29, 6, 0, 0, DateTimeKind.Utc);
        var q = new Quotation { Status = status, ValidUntil = now.AddDays(-3) };
        Assert.Equal(status, QuotationService.EffectiveStatus(q, now));
    }
}
