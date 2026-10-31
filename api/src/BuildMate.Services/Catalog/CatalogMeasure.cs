using System.Globalization;
using System.Text.RegularExpressions;
using BuildMate.Services.Common;

namespace BuildMate.Services.Catalog;

public record CatalogMeasure(string Display, decimal? Value, string? Unit, string Dimension, decimal? NormalizedValue)
{
    // Linear values normalize to mm; area values normalize to square mm. Dimensions never mix.
    public static CatalogMeasure? Parse(string? text, bool length = false)
    {
        var display = text?.Trim();
        if (string.IsNullOrEmpty(display)) return null;
        if (display.Length > 120 || display.Any(char.IsControl)) throw new AppException("Size/Length must be at most 120 printable characters.");
        var match = Regex.Match(display, @"^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([a-zA-Z²\"".]+)$");
        if (!match.Success)
        {
            // Preserve compound sizes (20 x 25 mm), gauges and other product-specific labels.
            if (Regex.IsMatch(display, @"^[-+]?(?:0+(?:\.0+)?)\s*(?:[a-zA-Z]+)?$") || display.StartsWith('-'))
                throw new AppException("Size/Length must be positive.");
            return new(display, null, null, "Other", null);
        }
        if (!decimal.TryParse(match.Groups[1].Value, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var value) || value <= 0 || value > 1_000_000_000m)
            throw new AppException("Size/Length must be a positive quantity below 1,000,000,000.");
        var unit = match.Groups[2].Value.ToLowerInvariant().Replace(".", "");
        (string Unit, string Dimension, decimal Factor) normalized = unit switch
        {
            "mm" or "millimeter" or "millimeters" => ("mm", "Linear", 1),
            "cm" or "centimeter" or "centimeters" => ("cm", "Linear", 10),
            "m" or "mtr" or "mtrs" or "meter" or "meters" or "metre" or "metres" => ("m", "Linear", 1000),
            "in" or "inch" or "inches" or "\"" => ("inch", "Linear", 25.4m),
            "ft" or "feet" or "foot" => ("ft", "Linear", 304.8m),
            "sqmm" or "mm²" => ("sqmm", "Area", 1),
            "sqcm" or "cm²" => ("sqcm", "Area", 100),
            "sqm" or "m²" => ("sqm", "Area", 1_000_000),
            _ => (unit, "Other", 1)
        };
        if (length && normalized.Dimension == "Area") throw new AppException("Length cannot use an area unit such as sqmm.");
        return new(display, value, normalized.Unit, normalized.Dimension, normalized.Dimension == "Other" ? null : value * normalized.Factor);
    }
}
