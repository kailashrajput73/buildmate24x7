using BuildMate.Domain.Entities;

namespace BuildMate.Services.Common;

/// <summary>Package prices are independent of piece discounts. All stock quantities remain base units.</summary>
public static class Packaging
{
    public static decimal Mrp(Product p) => p.PackMrp ?? Pricing.Round(p.Mrp * (p.PackSize ?? 0));
    public static decimal Price(Product p) => Price(Mrp(p), p.BoxDiscountType, p.BoxDiscountValue);
    public static decimal Price(decimal mrp, string discountType, decimal value) => Pricing.Round(discountType switch
    {
        "None" => mrp,
        "Percentage" => mrp * (1 - value / 100m),
        "Fixed" => mrp - value,
        _ => throw new AppException("Box discount type must be None, Percentage or Fixed.")
    });
    public static void Validate(Product p)
    {
        if (p.PackMrp is { } mrp && (mrp > 999999999999.99m || decimal.Round(mrp, 2) != mrp)) throw new AppException("MRP Pkg must have at most two decimal places and fit the supported monetary range.");
        if (decimal.Round(p.BoxDiscountValue, 2) != p.BoxDiscountValue || p.BoxDiscountValue > 999999999999.99m) throw new AppException("Box discount must have at most two decimal places.");
        if (p.PackSize is { } pack && new[] { "pcs", "pc", "piece", "pieces", "nos" }.Contains(p.Unit.ToLowerInvariant()) && pack != decimal.Truncate(pack)) throw new AppException("Pack Size in pieces must be a whole number.");
        if (p.BoxDiscountType is not ("None" or "Percentage" or "Fixed")) throw new AppException("Invalid box discount type.");
        if (p.BoxDiscountValue < 0 || (p.BoxDiscountType == "Percentage" && p.BoxDiscountValue >= 100)) throw new AppException("Box discount must be nonnegative and percentage must be below 100.");
        if (p.BoxDiscountType == "None" && p.BoxDiscountValue != 0) throw new AppException("Choose a box discount type for a nonzero discount.");
        if (p.PackSize == null)
        {
            if (p.PackMrp != null || p.BoxDiscountValue != 0 || p.BoxDiscountType != "None") throw new AppException("Configure Pack Size before package prices or discounts.");
            return;
        }
        if (p.PackSize <= 0 || p.PackSize > 10_000 || decimal.Round(p.PackSize.Value, 3) != p.PackSize) throw new AppException("Pack Size must be positive, at most 10,000, with at most 3 decimal places.");
        if (Mrp(p) > 999999999999.99m || Mrp(p) <= 0 || Price(p) <= 0) throw new AppException("Package MRP and final box selling price must be positive; discount must be less than MRP Pkg.");
    }
    public static decimal BaseQuantity(Product p, decimal purchaseQuantity, string unit)
    {
        if (unit == "Piece") return purchaseQuantity;
        if (unit != "Box") throw new AppException("Purchase unit must be Piece or Box.");
        Validate(p);
        if (p.PackSize == null) throw new AppException("This product is not configured for box purchasing.");
        if (purchaseQuantity != decimal.Truncate(purchaseQuantity)) throw new AppException("Order a whole number of boxes.");
        return purchaseQuantity * p.PackSize.Value;
    }
    public static void Snapshot(IPackageSnapshot line, Product p, string unit)
    {
        line.PurchaseUnit = unit;
        line.BaseUnitSnapshot = p.Unit;
        if (unit == "Box")
        {
            Validate(p);
            line.PackSizeSnapshot = p.PackSize ?? throw new AppException("Pack Size is required.");
            line.PackMrpSnapshot = Mrp(p);
            line.BoxPriceSnapshot = Price(p);
        }
    }
    public static decimal PurchaseQuantity(IPackageSnapshot line, decimal baseQuantity)
    {
        if (line.PurchaseUnit != "Box") return baseQuantity;
        if (line.PackSizeSnapshot is not > 0 || line.BoxPriceSnapshot is not > 0 || line.PackMrpSnapshot is not > 0) throw new AppException("Order package snapshot is incomplete.");
        var boxes = baseQuantity / line.PackSizeSnapshot.Value;
        if (boxes != decimal.Truncate(boxes)) throw new AppException("A box order must contain a whole number of its original packages.");
        return boxes;
    }
}
