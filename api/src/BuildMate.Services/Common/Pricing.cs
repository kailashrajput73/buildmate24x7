using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;

namespace BuildMate.Services.Common;

/// <summary>
/// Single place for price math so the storefront, app, cart and invoice always agree.
/// All prices are GST-inclusive (Indian retail norm). Tax is extracted from the inclusive amount.
/// </summary>
public static class Pricing
{
    public static decimal DiscountFor(Product p, CustomerKind kind) => kind switch
    {
        CustomerKind.Partner => p.PartnerDiscountPercent,
        _ => p.RetailDiscountPercent
    };

    public static decimal UnitPrice(decimal listPrice, decimal discountPercent, decimal specialDiscountPercent = 0)
    {
        var total = Math.Clamp(discountPercent + specialDiscountPercent, 0, 100);
        return Round(listPrice * (1 - total / 100m));
    }

    public static decimal UnitPrice(Product p, CustomerKind kind) => UnitPrice(p.ListPrice, DiscountFor(p, kind));

    /// <summary>GST portion contained in a GST-inclusive amount.</summary>
    public static decimal InclusiveTax(decimal inclusiveAmount, decimal gstRate) =>
        gstRate <= 0 ? 0 : Round(inclusiveAmount * gstRate / (100m + gstRate));

    public static decimal Round(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    /// <summary>Nearest whole rupee — what the customer pays and the invoice shows (the store's own invoices round the same way).</summary>
    public static decimal RoundRupee(decimal v) => Math.Round(v, 0, MidpointRounding.AwayFromZero);

    /// <summary>
    /// GST rate applied to the delivery charge. Delivery sold with goods is a composite supply taxed at the rate of
    /// the goods; almost everything in the catalogue is 18%. Confirmed by the store (Oct 2026).
    /// </summary>
    public const decimal DeliveryGstRate = 18m;
    /// <summary>SAC printed against the delivery line (goods transport). Confirmed by the store.</summary>
    public const string DeliverySac = "996511";

    /// <summary>Recomputes one order line from its inputs.</summary>
    public static void Recalculate(OrderItem i)
    {
        if (i.PurchaseUnit == "Box")
        {
            var count = Packaging.PurchaseQuantity(i, i.Quantity);
            var boxPrice = UnitPrice(i.BoxPriceSnapshot!.Value, 0, i.SpecialDiscountPercent);
            i.UnitPrice = Round(boxPrice / i.PackSizeSnapshot!.Value);
            i.LineTotal = Round(boxPrice * count);
        }
        else
        {
            i.UnitPrice = UnitPrice(i.ListPrice, i.DiscountPercent, i.SpecialDiscountPercent);
            i.LineTotal = Round(i.UnitPrice * i.Quantity);
        }
        i.TaxAmount = InclusiveTax(i.LineTotal, i.GstRate);
    }

    /// <summary>Recomputes order totals from its lines. Call after any line change.</summary>
    public static void Recalculate(Order o, decimal rewardPointsMultiplier = 1m)
    {
        foreach (var i in o.Items) Recalculate(i);
        o.SubTotal = Round(o.Items.Sum(i => i.PurchaseUnit == "Box" ? i.PackMrpSnapshot!.Value * Packaging.PurchaseQuantity(i, i.Quantity) : i.ListPrice * i.Quantity));
        var net = o.Items.Sum(i => i.LineTotal);
        o.DiscountTotal = Round(o.SubTotal - net);
        o.TaxTotal = o.Items.Sum(i => i.TaxAmount) + InclusiveTax(o.ShippingFee, DeliveryGstRate);
        var exact = Round(net + o.ShippingFee);
        o.GrandTotal = RoundRupee(exact);
        o.RoundOff = o.GrandTotal - exact;
        o.RewardPointsEarned = o.CustomerKind == CustomerKind.Partner
            ? Round(o.Items.Sum(i => i.RewardPoints) * rewardPointsMultiplier)
            : 0;
    }
}
