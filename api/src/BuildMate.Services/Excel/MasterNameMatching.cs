using System.Text;

namespace BuildMate.Services.Excel;

/// <summary>Safe name matching for master rows in catalog uploads.</summary>
internal static class MasterNameMatching
{
    public static string Display(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormKC).Trim();
        return string.Join(' ', normalized.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
    }

    public static string Key(string value) => Display(value).ToUpperInvariant();

    /// <summary>
    /// Returns true only for a possible singular/plural spelling pair. This is a warning signal,
    /// never an automatic merge: words such as Glass/Glasses or Class/Classes need human review.
    /// </summary>
    public static bool CouldBePluralVariant(string left, string right)
    {
        var a = Key(left);
        var b = Key(right);
        if (a == b) return false;
        return Forms(a).Contains(b) || Forms(b).Contains(a);
    }

    private static HashSet<string> Forms(string word)
    {
        var forms = new HashSet<string>(StringComparer.Ordinal) { word };
        if (word.EndsWith("IES", StringComparison.Ordinal) && word.Length > 3) forms.Add(word[..^3] + "Y");
        if (word.EndsWith("ES", StringComparison.Ordinal) && word.Length > 2) forms.Add(word[..^2]);
        if (word.EndsWith('S') && !word.EndsWith("SS", StringComparison.Ordinal) && word.Length > 1) forms.Add(word[..^1]);

        if (word.EndsWith('Y') && word.Length > 1 && !"AEIOU".Contains(word[^2])) forms.Add(word[..^1] + "IES");
        else if (word.EndsWith("CH", StringComparison.Ordinal) || word.EndsWith("SH", StringComparison.Ordinal) ||
                 word.EndsWith('S') || word.EndsWith('X') || word.EndsWith('Z')) forms.Add(word + "ES");
        else forms.Add(word + "S");
        return forms;
    }
}
