namespace BuildMate.Services.Catalog;

/// <summary>One row of the option picker, e.g. "Colour" with Red / Yellow / Blue chips.</summary>
public record VariantAxisDto(string Name, List<VariantChoiceDto> Choices);

/// <summary>
/// One chip. <see cref="ProductId"/> is the product the chip opens: the one with this value and the current
/// product's other options when that combination exists (<see cref="Exact"/>), otherwise the closest one.
/// </summary>
public record VariantChoiceDto(string Value, long ProductId, bool Selected, bool Exact, bool InStock);

/// <summary>
/// Product families with more than one option. A product's VariantLabel lists its options as
/// "Size: 1.5 sq.mm; Colour: Red; Length: 90 m". A plain label ("20 mm (¾")") is a single-option family
/// (the flat size picker), which is how pipes and fittings work.
/// </summary>
public static class Variants
{
    public static List<(string Name, string Value)> Parse(string? label)
    {
        var list = new List<(string, string)>();
        if (string.IsNullOrWhiteSpace(label) || !label.Contains(':')) return list;
        foreach (var part in label.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var kv = part.Split(':', 2, StringSplitOptions.TrimEntries);
            if (kv.Length == 2 && kv[0].Length > 0 && kv[1].Length > 0) list.Add((kv[0], kv[1]));
        }
        return list;
    }

    /// <summary>"Size: 1.5 sq.mm; Colour: Red" → "1.5 sq.mm · Red"; plain labels unchanged.</summary>
    public static string Display(string? label)
    {
        var opts = Parse(label);
        return opts.Count == 0 ? label ?? "" : string.Join(" · ", opts.Select(o => o.Value));
    }

    /// <summary>Picker rows for a family, or an empty list when the family has a single option (flat picker).</summary>
    public static List<VariantAxisDto> Axes(long currentId, IReadOnlyList<(long Id, string? Label, bool InStock)> members)
    {
        var parsed = members.Select(m => (m.Id, m.InStock, Opts: Parse(m.Label).ToDictionary(o => o.Name, o => o.Value))).ToList();
        if (parsed.Count < 2 || parsed.Any(p => p.Opts.Count < 2)) return new();
        var current = parsed.FirstOrDefault(p => p.Id == currentId);
        if (current.Opts == null) return new();

        var names = new List<string>();
        foreach (var p in parsed)
            foreach (var n in p.Opts.Keys)
                if (!names.Contains(n)) names.Add(n);

        var axes = new List<VariantAxisDto>();
        foreach (var axis in names)
        {
            var values = new List<string>();
            foreach (var p in parsed)
                if (p.Opts.TryGetValue(axis, out var v) && !values.Contains(v)) values.Add(v);
            if (values.Count < 2) continue;

            var choices = new List<VariantChoiceDto>();
            foreach (var value in values)
            {
                var candidates = parsed.Where(p => p.Opts.TryGetValue(axis, out var v) && v == value).ToList();
                // Prefer the product that keeps the current product's other options; earlier options weigh more
                // (keeping the size matters more than keeping the coil length).
                int Weight(string n) => 1 << (names.Count - names.IndexOf(n));
                var best = candidates
                    .Select(c => (c, Score: names.Where(n => n != axis && c.Opts.TryGetValue(n, out var cv) && current.Opts.TryGetValue(n, out var mv) && cv == mv).Sum(Weight)))
                    .OrderByDescending(x => x.Score).First();
                var exact = best.Score == names.Where(n => n != axis && current.Opts.ContainsKey(n)).Sum(Weight);
                current.Opts.TryGetValue(axis, out var mine);
                choices.Add(new VariantChoiceDto(value, best.c.Id, mine == value, exact, best.c.InStock));
            }
            axes.Add(new VariantAxisDto(axis, choices));
        }
        return axes.Count >= 2 ? axes : new();
    }

    private static readonly Dictionary<string, (string One, string Many)> Nouns = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Size"] = ("size", "sizes"), ["Colour"] = ("colour", "colours"), ["Color"] = ("colour", "colours"),
        ["Length"] = ("length", "lengths"), ["Type"] = ("type", "types"), ["Category"] = ("category", "categories"),
        ["Conductor"] = ("conductor", "conductors"), ["Cores"] = ("core option", "core options"), ["Pairs"] = ("pair option", "pair options"),
    };

    /// <summary>Card text for a family: "9 sizes" or "6 sizes · 5 colours · 2 lengths".</summary>
    public static string Summary(IEnumerable<string?> labels)
    {
        var all = labels.ToList();
        var parsed = all.Select(Parse).ToList();
        if (parsed.Count == 0 || parsed.Any(p => p.Count < 2)) return $"{all.Count} sizes";
        var parts = new List<string>();
        foreach (var name in parsed.SelectMany(p => p.Select(o => o.Name)).Distinct())
        {
            var n = parsed.Select(p => p.FirstOrDefault(o => o.Name == name).Value).Where(v => v != null).Distinct().Count();
            if (n < 2) continue;
            (string One, string Many) noun = Nouns.TryGetValue(name, out var w) ? w : (name.ToLowerInvariant(), name.ToLowerInvariant() + "s");
            parts.Add($"{n} {(n == 1 ? noun.One : noun.Many)}");
        }
        return parts.Count == 0 ? $"{all.Count} options" : string.Join(" · ", parts);
    }
}
