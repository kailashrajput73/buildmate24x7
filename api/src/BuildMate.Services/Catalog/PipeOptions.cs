using System.Text.RegularExpressions;
using BuildMate.Domain.Entities;

namespace BuildMate.Services.Catalog;

/// <summary>Uses explicit catalogue specifications, never guesses item identity from display names.</summary>
public static class PipeOptions
{
    public static string Spec(Product p, string name) => SpecDto.Parse(p.Specs)
        .FirstOrDefault(s => s.Name.Equals(name, StringComparison.OrdinalIgnoreCase))?.Value.Trim() ?? "";

    public static string Class(Product p)
    {
        foreach (var key in new[] { "Class", "SDR", "Schedule" })
        {
            var value = Spec(p, key);
            if (value.Length == 0) continue;
            return Regex.IsMatch(value, "^(class|sdr|sch)", RegexOptions.IgnoreCase) ? value : $"{(key == "Schedule" ? "Sch" : key)} {value}";
        }
        return "Not specified";
    }

    public static string NormalizeSearch(string value) => Regex.Replace(value.Trim(), @"(?<=\d)(?=[a-zA-Z])|(?<=[a-zA-Z])(?=\d)", " ");

    public static List<VariantAxisDto> Axes(Product current, IReadOnlyList<Product> members)
    {
        string Value(Product p, string axis) => axis switch {
            "Brand" => p.Brand.Name, "Class" => Class(p), _ => Spec(p, "Size") is { Length: > 0 } size ? size : p.VariantLabel ?? "Not specified"
        };
        var names = new[] { "Brand", "Class", "Size" };
        return names.Select(axis => new VariantAxisDto(axis, members.Select(p => Value(p, axis)).Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => axis == "Size" && decimal.TryParse(Regex.Match(value, @"\d+(?:\.\d+)?").Value, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var n) ? n : 0)
            .ThenBy(value => value).Select(value => {
                var best = members.Where(p => Value(p, axis).Equals(value, StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(p => names.Where(n => n != axis).Sum(n => Value(p, n) == Value(current, n) ? (n == "Size" ? 4 : 2) : 0))
                    .ThenByDescending(p => p.AvailableQty > 0).ThenBy(p => p.Id).First();
                return new VariantChoiceDto(value, best.Id, Value(current, axis) == value,
                    names.Where(n => n != axis).All(n => Value(best, n) == Value(current, n)), best.AvailableQty > 0);
            }).ToList())).ToList();
    }
}
