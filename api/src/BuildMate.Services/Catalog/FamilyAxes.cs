using BuildMate.Domain.Entities;

namespace BuildMate.Services.Catalog;

public static class FamilyAxes
{
    public static List<VariantAxisDto> Build(Product current, List<Product> products)
    {
        Dictionary<string, string> Options(Product p)
        {
            var values = Variants.Parse(p.VariantLabel).GroupBy(x => x.Name).ToDictionary(g => g.Key, g => g.First().Value);
            values["Brand"] = p.Brand.Name;
            var cls = p.ProductClass ?? PipeOptions.Spec(p, "Class");
            if (string.IsNullOrWhiteSpace(cls)) cls = PipeOptions.Spec(p, "SDR");
            if (string.IsNullOrWhiteSpace(cls)) cls = PipeOptions.Spec(p, "Schedule");
            if (!string.IsNullOrWhiteSpace(cls)) values["Class"] = cls;
            var size = p.Size ?? PipeOptions.Spec(p, "Size");
            if (string.IsNullOrEmpty(size) && !string.IsNullOrEmpty(p.VariantLabel) && !p.VariantLabel.Contains(':')) size = p.VariantLabel;
            if (!string.IsNullOrWhiteSpace(size)) values["Size"] = size;
            if (!string.IsNullOrWhiteSpace(p.Length)) values["Length"] = p.Length;
            return values;
        }
        var mine = Options(current);
        var rows = products.Select(p => (Product: p, Values: Options(p))).ToList();
        var names = new[] { "Brand", "Class", "Size", "Length" }.Concat(rows.SelectMany(r => r.Values.Keys)).Distinct().Where(n => rows.Any(r => r.Values.ContainsKey(n))).ToList();
        return names.Select(axis => new VariantAxisDto(axis, rows.Where(r => r.Values.ContainsKey(axis)).Select(r => r.Values[axis]).Distinct()
            .OrderBy(value => SortValue(axis, value)).ThenBy(v => v)
            .Select(value => {
                var best = rows.Where(r => r.Values.GetValueOrDefault(axis) == value)
                    .OrderByDescending(r => names.Where(n => n != axis && mine.ContainsKey(n)).Count(n => mine[n] == r.Values.GetValueOrDefault(n)))
                    .ThenByDescending(r => r.Product.AvailableQty > 0).ThenBy(r => r.Product.Sequence).ThenBy(r => r.Product.Id).First();
                return new VariantChoiceDto(value, best.Product.Id, mine.GetValueOrDefault(axis) == value,
                    names.Where(n => n != axis && mine.ContainsKey(n)).All(n => mine[n] == best.Values.GetValueOrDefault(n)), best.Product.AvailableQty > 0);
            }).ToList())).ToList();
    }

    private static decimal SortValue(string axis, string value)
    {
        if (axis is not ("Size" or "Length")) return decimal.MaxValue;
        try { return CatalogMeasure.Parse(value)?.NormalizedValue ?? decimal.MaxValue; }
        catch (Common.AppException) { return decimal.MaxValue; } // Legacy labels remain displayable.
    }
}
