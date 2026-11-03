using BuildMate.Domain.Entities;

namespace BuildMate.Services.Catalog;

public static class FamilyAxes
{
    /// <param name="narrow">
    /// Family shared by several brands: each option row only offers what exists with the options above it —
    /// every Brand, then the Classes of the selected brand, then only the Sizes of that brand + class (then Lengths…).
    /// So picking a size never jumps to another brand.
    /// </param>
    /// <param name="classLabel">Shown name of the Class row ("Color" for Electrical › Cable).</param>
    public static List<VariantAxisDto> Build(Product current, List<Product> products, bool narrow = false, string classLabel = "Class")
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
        // Rows that agree with the current product on every option above this one (narrow mode only).
        List<(Product Product, Dictionary<string, string> Values)> Pool(string axis) => !narrow ? rows : rows.Where(r =>
            names.TakeWhile(n => n != axis).Where(mine.ContainsKey).All(n => r.Values.GetValueOrDefault(n) == mine[n])).ToList();
        return names.Select(axis => (axis, pool: Pool(axis))).Select(a => new VariantAxisDto(a.axis == "Class" ? classLabel : a.axis,
            a.pool.Where(r => r.Values.ContainsKey(a.axis)).Select(r => r.Values[a.axis]).Distinct()
            .OrderBy(value => SortValue(a.axis, value)).ThenBy(v => v)
            .Select(value => {
                var axis = a.axis;
                var best = a.pool.Where(r => r.Values.GetValueOrDefault(axis) == value)
                    .OrderByDescending(r => names.Where(n => n != axis && mine.ContainsKey(n) && mine[n] == r.Values.GetValueOrDefault(n))
                        // Narrow: keep the higher rows first (a brand switch keeps the class before the size).
                        .Sum(n => narrow ? Math.Pow(2, names.Count - names.IndexOf(n)) : 1))
                    .ThenByDescending(r => r.Product.AvailableQty > 0).ThenBy(r => r.Product.Sequence).ThenBy(r => r.Product.Id).First();
                return new VariantChoiceDto(value, best.Product.Id, mine.GetValueOrDefault(axis) == value,
                    names.Where(n => n != axis && mine.ContainsKey(n)).All(n => mine[n] == best.Values.GetValueOrDefault(n)), best.Product.AvailableQty > 0);
            }).ToList())).Where(a => a.Choices.Count > 0).ToList();
    }

    private static decimal SortValue(string axis, string value)
    {
        if (axis is not ("Size" or "Length")) return decimal.MaxValue;
        try { return CatalogMeasure.Parse(value)?.NormalizedValue ?? decimal.MaxValue; }
        catch (Common.AppException) { return decimal.MaxValue; } // Legacy labels remain displayable.
    }
}
