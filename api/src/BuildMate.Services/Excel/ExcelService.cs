using System.Text.RegularExpressions;
using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Erp;
using BuildMate.Services.Inventory;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Excel;

public record ExcelColumn<T>(string Header, Func<T, object?> Value, string? Format = null);

public record ImportSummary(int Created, int Updated, int Skipped, List<ImportError> Warnings);

/// <summary>Bulk Excel import/export for masters, products and purchases.</summary>
public interface IExcelService
{
    byte[] Export<T>(string sheetName, IEnumerable<T> rows, params ExcelColumn<T>[] columns);
    byte[] Template(string kind);
    Task<ImportSummary> ImportSubCategoriesAsync(Stream file, CancellationToken ct = default);
    Task<ImportSummary> ImportProductsAsync(Stream file, bool createMissingMasters, CancellationToken ct = default);
    List<PurchaseLineInput> ParsePurchaseLines(Stream file);
}

public class ExcelService : IExcelService
{
    private static readonly Regex CodePattern = new(@"^[A-Z0-9][A-Z0-9\-/.]{0,19}$", RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly ICatalogAdminService _catalog;
    private readonly ICurrentUser _me;
    private readonly IOutbox _outbox;

    public ExcelService(AppDbContext db, ICatalogAdminService catalog, ICurrentUser me, IOutbox outbox)
    {
        _db = db;
        _catalog = catalog;
        _me = me;
        _outbox = outbox;
    }

    // ------------------------------------------------------------------ Export

    public byte[] Export<T>(string sheetName, IEnumerable<T> rows, params ExcelColumn<T>[] columns)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(sheetName.Length > 31 ? sheetName[..31] : sheetName);
        for (var c = 0; c < columns.Length; c++)
        {
            var cell = ws.Cell(1, c + 1);
            cell.Value = columns[c].Header;
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E8F0FE");
        }
        var r = 2;
        foreach (var row in rows)
        {
            for (var c = 0; c < columns.Length; c++)
            {
                var cell = ws.Cell(r, c + 1);
                cell.Value = ToCellValue(columns[c].Value(row));
                if (columns[c].Format is { } fmt) cell.Style.NumberFormat.Format = fmt;
            }
            r++;
        }
        ws.SheetView.FreezeRows(1);
        ws.Range(1, 1, Math.Max(1, r - 1), columns.Length).SetAutoFilter();
        ws.Columns().AdjustToContents(1, Math.Min(r, 200), 8, 60);
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static XLCellValue ToCellValue(object? v) => v switch
    {
        null => Blank.Value,
        string s => s,
        decimal d => d,
        double d => d,
        int i => i,
        long l => l,
        bool b => b ? "Yes" : "No",
        DateTime dt => Clock.ToIst(dt),
        DateOnly d => d.ToDateTime(TimeOnly.MinValue),
        Enum e => e.ToString(),
        _ => v.ToString() ?? ""
    };

    // ------------------------------------------------------------------ Templates

    public static readonly string[] ProductColumns =
    {
        "Code", "Name", "Category", "SubCategory", "Brand", "Unit", "HSN", "GST %", "MRP", "List Price",
        "Partner Discount %", "Retail Discount %", "Reward Points / Unit", "Reorder Level", "Sequence",
        "Barcode", "Aliases (comma separated)", "Name (Hindi)", "Name (Gujarati)", "Active", "Show On Web", "Show On App", "Description",
        "Image URL", "Variant Family", "Variant Label", "Specs", "Purchase Discount %"
    };

    public byte[] Template(string kind)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(kind);
        string[] headers;
        object?[] sample;
        switch (kind.ToLowerInvariant())
        {
            case "subcategories":
                headers = new[] { "Category", "SubCategory", "Sort Order", "Active" };
                sample = new object?[] { "Plumbing", "CPVC Pipes", 1, "Yes" };
                break;
            case "products":
                headers = ProductColumns;
                sample = new object?[] { "C1115CKG", "King CPVC Coupler SDR 11 – 15 mm (½\")", "Pipes & Fittings", "CPVC Fittings", "King", "pcs", "39174000", 18, 7.42, 7.42,
                    0, 0, 0, 500, 1, "", "socket, coupling", "", "", "Yes", "Yes", "Yes", "King CPVC coupler, class SDR 11, size 15 mm (½\").",
                    "https://example.com/coupler.png", "King CPVC Coupler SDR 11", "15 mm (½\")", "Material: CPVC; SDR: SDR 11; Size: 15 mm (½\")", 5 };
                break;
            case "purchases":
                headers = new[] { "Product Code", "Quantity", "List Price", "Purchase Discount %", "Rack Location" };
                sample = new object?[] { "BM000001", 100, 300, 30, "R1-A1" };
                break;
            default:
                throw new AppException("Unknown template.");
        }
        for (var i = 0; i < headers.Length; i++)
        {
            ws.Cell(1, i + 1).Value = headers[i];
            ws.Cell(1, i + 1).Style.Font.Bold = true;
            ws.Cell(2, i + 1).Value = ToCellValue(sample[i]);
        }
        ws.Columns().AdjustToContents();
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ------------------------------------------------------------------ Import helpers

    private sealed class Sheet
    {
        private readonly Dictionary<string, int> _cols;
        public IXLWorksheet Ws { get; }
        public int LastRow { get; }

        public Sheet(Stream file)
        {
            var wb = new XLWorkbook(file);
            Ws = wb.Worksheets.First();
            LastRow = Ws.LastRowUsed()?.RowNumber() ?? 1;
            _cols = Ws.Row(1).CellsUsed().ToDictionary(c => Normalize(c.GetString()), c => c.Address.ColumnNumber);
        }

        private static string Normalize(string h) => new string(h.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

        public bool Has(string header) => _cols.ContainsKey(Normalize(header));

        public string? Str(int row, string header)
        {
            if (!_cols.TryGetValue(Normalize(header), out var c)) return null;
            var s = Ws.Cell(row, c).GetFormattedString().Trim();
            return s.Length == 0 ? null : s;
        }

        public decimal? Dec(int row, string header, List<ImportError> errors)
        {
            var s = Str(row, header);
            if (s == null) return null;
            if (decimal.TryParse(s.Replace(",", "").Replace("₹", "").Replace("%", ""), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var d)) return d;
            errors.Add(new ImportError(row, $"\"{header}\" should be a number (got \"{s}\")."));
            return null;
        }

        public bool? Bool(int row, string header)
        {
            var s = Str(row, header)?.ToLowerInvariant();
            return s switch { null => null, "yes" or "y" or "true" or "1" or "active" => true, _ => false };
        }

        public bool IsBlank(int row) => Ws.Row(row).CellsUsed().All(c => string.IsNullOrWhiteSpace(c.GetString()));
    }

    private static Sheet Open(Stream file)
    {
        try { return new Sheet(file); }
        catch (Exception) { throw new AppException("Couldn't read this file. Upload an .xlsx file saved from Excel or Google Sheets."); }
    }

    // ------------------------------------------------------------------ Sub categories

    public async Task<ImportSummary> ImportSubCategoriesAsync(Stream file, CancellationToken ct = default)
    {
        var sheet = Open(file);
        if (!sheet.Has("Category") || !sheet.Has("SubCategory")) throw new AppException("The sheet needs Category and SubCategory columns. Download the template.");

        var errors = new List<ImportError>();
        var cats = await _db.Categories.ToDictionaryAsync(c => c.Name.ToLower(), ct);
        var subs = await _db.SubCategories.ToListAsync(ct);
        int created = 0, updated = 0, skipped = 0;
        var seen = new HashSet<string>();

        for (var r = 2; r <= sheet.LastRow; r++)
        {
            if (sheet.IsBlank(r)) continue;
            var catName = sheet.Str(r, "Category");
            var subName = sheet.Str(r, "SubCategory");
            if (catName == null || subName == null) { errors.Add(new(r, "Category and SubCategory are required.")); continue; }
            if (!seen.Add($"{catName.ToLower()}|{subName.ToLower()}")) { errors.Add(new(r, $"Duplicate row for {catName} / {subName}.")); continue; }

            if (!cats.TryGetValue(catName.ToLower(), out var cat))
            {
                cat = new Category { Name = catName, CreatedById = _me.Id };
                _db.Categories.Add(cat);
                cats[catName.ToLower()] = cat;
            }
            var sort = (int)(sheet.Dec(r, "Sort Order", errors) ?? 0);
            var active = sheet.Bool(r, "Active") ?? true;
            var existing = subs.FirstOrDefault(s => (s.Category == cat || (cat.Id != 0 && s.CategoryId == cat.Id))
                                                    && s.Name.Equals(subName, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                var s = new SubCategory { Category = cat, Name = subName, SortOrder = sort, IsActive = active, CreatedById = _me.Id };
                _db.SubCategories.Add(s);
                subs.Add(s);
                created++;
            }
            else if (existing.SortOrder != sort || existing.IsActive != active)
            {
                existing.SortOrder = sort;
                existing.IsActive = active;
                existing.UpdatedById = _me.Id;
                updated++;
            }
            else skipped++;
        }
        if (errors.Count > 0) throw new ImportValidationException(errors);
        await _db.SaveChangesAsync(ct);
        return new ImportSummary(created, updated, skipped, new());
    }

    // ------------------------------------------------------------------ Products (upsert by Code)

    public async Task<ImportSummary> ImportProductsAsync(Stream file, bool createMissingMasters, CancellationToken ct = default)
    {
        var sheet = Open(file);
        foreach (var h in new[] { "Name", "Category", "Brand", "List Price" })
            if (!sheet.Has(h)) throw new AppException($"Missing column \"{h}\". Download the product template.");

        var errors = new List<ImportError>();
        var cats = await _db.Categories.ToDictionaryAsync(c => c.Name.ToLower(), ct);
        var subs = await _db.SubCategories.ToListAsync(ct);
        var brands = await _db.Brands.ToDictionaryAsync(b => b.Name.ToLower(), ct);
        var codes = new List<string>();
        for (var r = 2; r <= sheet.LastRow; r++) if (sheet.Str(r, "Code") is { } c) codes.Add(c.ToUpperInvariant());
        var existing = await _db.Products.Include(p => p.Aliases).Include(p => p.Translations)
            .Where(p => codes.Contains(p.Code)).ToDictionaryAsync(p => p.Code, ct);

        var pending = new List<(int Row, Product P, bool IsNew, List<string> Aliases, Dictionary<string, string> Tr)>();
        var seenCodes = new HashSet<string>();
        for (var r = 2; r <= sheet.LastRow; r++)
        {
            if (sheet.IsBlank(r)) continue;
            var before = errors.Count;
            var code = sheet.Str(r, "Code")?.ToUpperInvariant();
            var name = sheet.Str(r, "Name");
            var catName = sheet.Str(r, "Category");
            var brandName = sheet.Str(r, "Brand");
            var listPrice = sheet.Dec(r, "List Price", errors);
            if (name == null) errors.Add(new(r, "Name is required."));
            if (catName == null) errors.Add(new(r, "Category is required."));
            if (brandName == null) errors.Add(new(r, "Brand is required."));
            var active = sheet.Bool(r, "Active") ?? true;
            // Hidden products may wait for a price; anything customers can see must have one.
            if (active && listPrice is null or <= 0) errors.Add(new(r, "List Price must be more than zero (or set Active to No)."));
            if (listPrice is < 0) errors.Add(new(r, "List Price can't be negative."));
            if (code != null && !CodePattern.IsMatch(code)) errors.Add(new(r, $"Code {code} can only use letters, numbers, - / . and be up to 20 characters."));
            if (code != null && !seenCodes.Add(code)) errors.Add(new(r, $"Code {code} appears twice."));
            var gst = sheet.Dec(r, "GST %", errors) ?? 18;
            if (gst is not (0 or 0.25m or 3 or 5 or 12 or 18 or 28)) errors.Add(new(r, $"GST {gst}% is not a valid slab."));
            var mrp = sheet.Dec(r, "MRP", errors) ?? 0;
            if (mrp > 0 && listPrice > mrp) errors.Add(new(r, "List Price is higher than MRP."));
            var pd = sheet.Dec(r, "Partner Discount %", errors) ?? 0;
            var rd = sheet.Dec(r, "Retail Discount %", errors) ?? 0;
            if (pd is < 0 or > 90 || rd is < 0 or > 90) errors.Add(new(r, "Discounts must be between 0 and 90%."));
            if (errors.Count > before) continue;

            if (!cats.TryGetValue(catName!.ToLower(), out var cat))
            {
                if (!createMissingMasters) { errors.Add(new(r, $"Unknown category \"{catName}\".")); continue; }
                cat = new Category { Name = catName, CreatedById = _me.Id };
                _db.Categories.Add(cat);
                cats[catName.ToLower()] = cat;
            }
            if (!brands.TryGetValue(brandName!.ToLower(), out var brand))
            {
                if (!createMissingMasters) { errors.Add(new(r, $"Unknown brand \"{brandName}\".")); continue; }
                brand = new Brand { Name = brandName, CreatedById = _me.Id };
                _db.Brands.Add(brand);
                brands[brandName.ToLower()] = brand;
            }
            SubCategory? sub = null;
            if (sheet.Str(r, "SubCategory") is { } subName)
            {
                sub = subs.FirstOrDefault(s => (s.Category == cat || (cat.Id != 0 && s.CategoryId == cat.Id)) && s.Name.Equals(subName, StringComparison.OrdinalIgnoreCase));
                if (sub == null)
                {
                    if (!createMissingMasters) { errors.Add(new(r, $"Unknown sub category \"{subName}\" in {catName}.")); continue; }
                    sub = new SubCategory { Category = cat, Name = subName, CreatedById = _me.Id };
                    _db.SubCategories.Add(sub);
                    subs.Add(sub);
                }
            }

            // A code that isn't in the system yet creates the product under that code (e.g. the brand's own code).
            var isNew = code == null || !existing.ContainsKey(code);
            var p = isNew ? new Product { Code = code!, CreatedById = _me.Id } : existing[code!];
            p.Name = name!;
            p.Category = cat;
            p.SubCategory = sub;
            if (sub == null) p.SubCategoryId = null;
            p.Brand = brand;
            p.Unit = sheet.Str(r, "Unit") ?? "pcs";
            p.HsnCode = sheet.Str(r, "HSN");
            p.GstRate = gst;
            p.Mrp = mrp;
            p.ListPrice = listPrice ?? 0;
            p.PartnerDiscountPercent = pd;
            p.RetailDiscountPercent = rd;
            p.RewardPointsPerUnit = sheet.Dec(r, "Reward Points / Unit", errors) ?? 0;
            p.ReorderLevel = sheet.Dec(r, "Reorder Level", errors) ?? 0;
            p.Sequence = (int)(sheet.Dec(r, "Sequence", errors) ?? 0);
            p.Barcode = sheet.Str(r, "Barcode");
            p.Description = sheet.Str(r, "Description") ?? p.Description;
            p.IsActive = active;
            if (sheet.Has("Image URL"))
                p.ImageUrls = (sheet.Str(r, "Image URL") ?? "").Split(new[] { ',', ' ', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Where(u => u.StartsWith("http://") || u.StartsWith("https://") || u.StartsWith("/")).Distinct().ToList();
            if (sheet.Has("Variant Family")) p.VariantFamily = sheet.Str(r, "Variant Family");
            if (sheet.Has("Variant Label")) p.VariantLabel = sheet.Str(r, "Variant Label");
            if (sheet.Has("Specs"))
                p.Specs = (sheet.Str(r, "Specs") ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Where(x => x.Contains(':')).ToList();
            // Purchase discount gives a starting cost for margin reports until the first purchase entry sets the real average.
            if (sheet.Dec(r, "Purchase Discount %", errors) is { } purchaseDisc && p.StockQty == 0)
            {
                if (purchaseDisc is < 0 or >= 100) errors.Add(new(r, "Purchase Discount % must be between 0 and 99."));
                else p.AverageCost = Math.Round((mrp > 0 ? mrp : p.ListPrice) * (1 - purchaseDisc / 100m), 4);
            }
            p.ShowOnWeb = sheet.Bool(r, "Show On Web") ?? true;
            p.ShowOnApp = sheet.Bool(r, "Show On App") ?? true;
            p.UpdatedById = _me.Id;

            var aliases = (sheet.Str(r, "Aliases (comma separated)") ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            var tr = new Dictionary<string, string>();
            if (sheet.Str(r, "Name (Hindi)") is { } hi) tr["hi"] = hi;
            if (sheet.Str(r, "Name (Gujarati)") is { } gu) tr["gu"] = gu;
            pending.Add((r, p, isNew, aliases, tr));
        }
        if (errors.Count > 0) throw new ImportValidationException(errors);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        foreach (var (_, p, isNew, aliases, tr) in pending)
        {
            if (isNew)
            {
                if (string.IsNullOrEmpty(p.Code)) p.Code = await _catalog.NextProductCodeAsync(ct);
                _db.Products.Add(p);
            }
            foreach (var a in p.Aliases.Where(a => !aliases.Contains(a.Alias, StringComparer.OrdinalIgnoreCase)).ToList()) p.Aliases.Remove(a);
            foreach (var a in aliases.Where(a => !p.Aliases.Any(x => x.Alias.Equals(a, StringComparison.OrdinalIgnoreCase)))) p.Aliases.Add(new ProductAlias { Alias = a });
            foreach (var (lang, nm) in tr)
            {
                var t = p.Translations.FirstOrDefault(x => x.LanguageCode == lang);
                if (t == null) p.Translations.Add(new ProductTranslation { LanguageCode = lang, Name = nm });
                else t.Name = nm;
            }
        }
        await _db.SaveChangesAsync(ct);
        foreach (var (_, p, _, _, _) in pending)
            _outbox.Add(ErpEvents.ProductUpserted, new { p.Id, p.Code, p.Name, p.HsnCode, p.GstRate, p.Mrp, p.ListPrice, p.Unit, p.Barcode, p.IsActive });
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new ImportSummary(pending.Count(x => x.IsNew), pending.Count(x => !x.IsNew), 0, new());
    }

    // ------------------------------------------------------------------ Purchases

    public List<PurchaseLineInput> ParsePurchaseLines(Stream file)
    {
        var sheet = Open(file);
        foreach (var h in new[] { "Product Code", "Quantity", "List Price" })
            if (!sheet.Has(h)) throw new AppException($"Missing column \"{h}\". Download the purchase template.");
        var errors = new List<ImportError>();
        var lines = new List<PurchaseLineInput>();
        for (var r = 2; r <= sheet.LastRow; r++)
        {
            if (sheet.IsBlank(r)) continue;
            lines.Add(new PurchaseLineInput(null, sheet.Str(r, "Product Code"), sheet.Dec(r, "Quantity", errors) ?? 0,
                sheet.Dec(r, "List Price", errors) ?? 0, sheet.Dec(r, "Purchase Discount %", errors) ?? 0, null, sheet.Str(r, "Rack Location")));
        }
        if (errors.Count > 0) throw new ImportValidationException(errors);
        if (lines.Count == 0) throw new AppException("The sheet has no rows.");
        return lines;
    }
}
