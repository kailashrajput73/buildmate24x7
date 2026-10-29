namespace BuildMate.Services.Common;

/// <summary>GST state codes (the first two digits of a GSTIN), used for "State Code" and place of supply on invoices.</summary>
public static class GstStates
{
    private static readonly Dictionary<string, string> ByName = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Jammu and Kashmir"] = "01", ["Himachal Pradesh"] = "02", ["Punjab"] = "03", ["Chandigarh"] = "04", ["Uttarakhand"] = "05",
        ["Haryana"] = "06", ["Delhi"] = "07", ["Rajasthan"] = "08", ["Uttar Pradesh"] = "09", ["Bihar"] = "10", ["Sikkim"] = "11",
        ["Arunachal Pradesh"] = "12", ["Nagaland"] = "13", ["Manipur"] = "14", ["Mizoram"] = "15", ["Tripura"] = "16", ["Meghalaya"] = "17",
        ["Assam"] = "18", ["West Bengal"] = "19", ["Jharkhand"] = "20", ["Odisha"] = "21", ["Chhattisgarh"] = "22", ["Madhya Pradesh"] = "23",
        ["Gujarat"] = "24", ["Dadra and Nagar Haveli and Daman and Diu"] = "26", ["Maharashtra"] = "27", ["Karnataka"] = "29", ["Goa"] = "30",
        ["Lakshadweep"] = "31", ["Kerala"] = "32", ["Tamil Nadu"] = "33", ["Puducherry"] = "34", ["Andaman and Nicobar Islands"] = "35",
        ["Telangana"] = "36", ["Andhra Pradesh"] = "37", ["Ladakh"] = "38",
        // common alternative spellings
        ["Orissa"] = "21", ["Pondicherry"] = "34", ["New Delhi"] = "07", ["J&K"] = "01", ["Daman and Diu"] = "26", ["Dadra and Nagar Haveli"] = "26",
    };

    public static string? CodeFor(string? state, string? gstin = null)
    {
        if (!string.IsNullOrWhiteSpace(gstin) && gstin.Trim().Length >= 2 && char.IsDigit(gstin.Trim()[0]) && char.IsDigit(gstin.Trim()[1]))
            return gstin.Trim()[..2];
        return state != null && ByName.TryGetValue(state.Trim(), out var c) ? c : null;
    }

    public static IReadOnlyCollection<string> Names => ByName.Keys.Take(37).ToList();
}
