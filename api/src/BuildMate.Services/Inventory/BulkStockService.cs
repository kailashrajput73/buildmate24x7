using System.Globalization;
using System.Text;
using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Erp;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Inventory;

// ---------------------------------------------------------------------------------------------------------------------
// Bulk stock update (Inventory › Stock › Bulk update stock).
//   1. Preview: the file is read and every row validated against current stock — nothing is changed.
//   2. Apply:   the same file is sent again with the user's choice; rows are re-validated under row locks and all
//               changes are written in ONE transaction (all or nothing), each with a stock movement (ledger) entry.
// ---------------------------------------------------------------------------------------------------------------------

/// <summary>One data row of the uploaded file, as text.</summary>
public record BulkStockInputRow(int Row, string? ProductCode, string? Barcode, string? Quantity, string? Mode, string? Rack, string? Note);

/// <summary>The product a row refers to, with its stock at validation time.</summary>
public record BulkStockProduct(long Id, string Code, string Name, string Unit, decimal StockQty, decimal ReservedQty);

/// <summary>
/// A validated row. <paramref name="Status"/>: preview "OK" / "No change" / "Error"; after apply "Updated" / "Skipped" /
/// "Failed" (or the preview statuses when nothing was applied).
/// </summary>
public record BulkStockRowResult(int Row, string? ProductCode, long? ProductId, string? ProductName, string Mode,
    decimal? Quantity, decimal? CurrentStock, decimal? NewStock, string? Rack, string? Note, string Status, List<string> Errors);

public record BulkStockPreview(string FileName, string DefaultMode, int TotalRows, int ChangeRows, int UnchangedRows, int ErrorRows,
    List<BulkStockRowResult> Rows);

/// <summary><paramref name="Applied"/> false = nothing was changed (errors with "Cancel if any error").</summary>
public record BulkStockApplyResult(bool Applied, string FileName, int Updated, int Skipped, int Failed, List<BulkStockRowResult> Rows);

public interface IBulkStockService
{
    /// <summary>Template pre-filled with every product: quantity = current stock, mode = set (uploading it unchanged changes nothing).</summary>
    Task<(byte[] Content, string ContentType, string FileName)> TemplateAsync(string format, CancellationToken ct = default);
    Task<BulkStockPreview> PreviewAsync(Stream file, string fileName, string? defaultMode, CancellationToken ct = default);
    Task<BulkStockApplyResult> ApplyAsync(Stream file, string fileName, string? defaultMode, bool skipInvalid, CancellationToken ct = default);
}

public class BulkStockService : IBulkStockService
{
    public const string Source = "BulkUpload";

    private readonly AppDbContext _db;
    private readonly IStockService _stock;
    private readonly IOutbox _outbox;

    public BulkStockService(AppDbContext db, IStockService stock, IOutbox outbox)
    {
        _db = db;
        _stock = stock;
        _outbox = outbox;
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> TemplateAsync(string format, CancellationToken ct = default)
    {
        var products = await _db.Products.AsNoTracking().OrderBy(p => p.Code)
            .Select(p => new { p.Code, p.Barcode, p.Name, p.StockQty }).ToListAsync(ct);
        var rows = products.Select(p => new object?[] { p.Code, p.Barcode, p.Name, p.StockQty, p.StockQty, "set", null, null }).ToList();
        if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
        {
            var sb = new StringBuilder();
            sb.AppendLine(string.Join(",", BulkStockFile.TemplateHeaders));
            foreach (var r in rows) sb.AppendLine(string.Join(",", r.Select(BulkStockFile.CsvCell)));
            // UTF-8 with BOM so Excel opens product names correctly.
            return (Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray(), "text/csv", "bulk-stock-template.csv");
        }
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Stock");
        for (var c = 0; c < BulkStockFile.TemplateHeaders.Length; c++)
        {
            var cell = ws.Cell(1, c + 1);
            cell.Value = BulkStockFile.TemplateHeaders[c];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E8F0FE");
        }
        for (var i = 0; i < rows.Count; i++)
            for (var c = 0; c < rows[i].Length; c++)
                ws.Cell(i + 2, c + 1).Value = rows[i][c] switch { null => (XLCellValue)Blank.Value, decimal d => (XLCellValue)d, var v => (XLCellValue)(v.ToString() ?? "") };
        ws.SheetView.FreezeRows(1);
        ws.Columns().AdjustToContents(1, Math.Min(rows.Count + 1, 200), 8, 60);
        var notes = wb.Worksheets.Add("How to fill");
        var help = new[]
        {
            "product_code: the product's code (or leave it blank and fill barcode).",
            "product_name and current_stock are for reference only and are ignored on upload.",
            "quantity: a number, 0 or more.",
            "mode: set = make stock equal to quantity; add = increase stock by quantity. Blank = the mode chosen on the upload screen.",
            "rack: optional rack location (e.g. R1-A1). note: optional, saved in the stock history.",
            "Rows you don't change (same quantity, mode set) are skipped. You can delete rows you don't need.",
        };
        for (var i = 0; i < help.Length; i++) notes.Cell(i + 1, 1).Value = help[i];
        notes.Columns().AdjustToContents();
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return (ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "bulk-stock-template.xlsx");
    }

    public async Task<BulkStockPreview> PreviewAsync(Stream file, string fileName, string? defaultMode, CancellationToken ct = default)
    {
        var mode = BulkStockRules.DefaultMode(defaultMode);
        var input = BulkStockFile.Read(file, fileName);
        var lookup = await LoadLookupAsync(input, ct);
        var rows = BulkStockRules.Validate(input, mode, lookup.ByCode, lookup.ByBarcode, lookup.Racks);
        return new BulkStockPreview(fileName, mode, rows.Count, rows.Count(r => r.Status == BulkStockRules.Ok),
            rows.Count(r => r.Status == BulkStockRules.NoChange), rows.Count(r => r.Status == BulkStockRules.Error), rows);
    }

    public async Task<BulkStockApplyResult> ApplyAsync(Stream file, string fileName, string? defaultMode, bool skipInvalid, CancellationToken ct = default)
    {
        var mode = BulkStockRules.DefaultMode(defaultMode);
        var input = BulkStockFile.Read(file, fileName);
        var source = BulkStockFile.SafeName(fileName);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var lookup = await LoadLookupAsync(input, ct);
        // Lock the products and validate again with their stock as it is now (a sale may have happened since the preview).
        var ids = lookup.ByCode.Values.Concat(lookup.ByBarcode.Values.SelectMany(x => x)).Select(p => p.Id).Distinct().ToList();
        var locked = (await _db.LockProductsAsync(ids, ct)).ToDictionary(p => p.Id);
        BulkStockProduct Fresh(BulkStockProduct p) => locked.TryGetValue(p.Id, out var l) ? p with { StockQty = l.StockQty, ReservedQty = l.ReservedQty } : p;
        var byCode = lookup.ByCode.ToDictionary(x => x.Key, x => Fresh(x.Value), StringComparer.OrdinalIgnoreCase);
        var byBarcode = lookup.ByBarcode.ToDictionary(x => x.Key, x => x.Value.Select(Fresh).ToList(), StringComparer.OrdinalIgnoreCase);
        var rows = BulkStockRules.Validate(input, mode, byCode, byBarcode, lookup.Racks);

        var failed = rows.Count(r => r.Status == BulkStockRules.Error);
        if (failed > 0 && !skipInvalid)
        {
            await tx.RollbackAsync(ct);
            return new BulkStockApplyResult(false, fileName, 0, 0, failed, rows);
        }

        var result = new List<BulkStockRowResult>();
        var updated = 0;
        foreach (var r in rows)
        {
            if (r.Status != BulkStockRules.Ok) { result.Add(r with { Status = r.Status == BulkStockRules.Error ? "Failed" : "Skipped" }); continue; }
            var p = locked[r.ProductId!.Value];
            var oldQty = p.StockQty;
            var delta = r.NewStock!.Value - oldQty;
            var note = $"Bulk upload: {oldQty:0.###} → {r.NewStock.Value:0.###}" + (string.IsNullOrWhiteSpace(r.Note) ? "" : $" — {r.Note}");
            _stock.Apply(p, delta > 0 ? StockMovementType.AdjustmentIn : StockMovementType.AdjustmentOut, delta, 0, Source, null, source, note);
            if (r.Rack != null && lookup.Racks(r.Rack) is { } rackId) await _stock.PlaceAsync(p.Id, rackId, delta, ct);
            _outbox.Add(ErpEvents.StockAdjusted, new { ProductId = p.Id, p.Code, Quantity = delta, Reason = note, BalanceAfter = p.StockQty });
            updated++;
            result.Add(r with { Status = "Updated" });
        }
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new BulkStockApplyResult(true, fileName, updated, result.Count(r => r.Status == "Skipped"), failed, result);
    }

    private sealed record Lookup(Dictionary<string, BulkStockProduct> ByCode, Dictionary<string, List<BulkStockProduct>> ByBarcode, Func<string, long?> Racks);

    private async Task<Lookup> LoadLookupAsync(List<BulkStockInputRow> input, CancellationToken ct)
    {
        var codes = input.Select(r => r.ProductCode?.Trim().ToUpperInvariant()).Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
        var barcodes = input.Where(r => string.IsNullOrWhiteSpace(r.ProductCode)).Select(r => r.Barcode?.Trim()).Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
        var byCode = (await _db.Products.AsNoTracking().Where(p => codes.Contains(p.Code.ToUpper()))
                .Select(p => new BulkStockProduct(p.Id, p.Code, p.Name, p.Unit, p.StockQty, p.ReservedQty)).ToListAsync(ct))
            .GroupBy(p => p.Code, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var byBarcode = (await _db.Products.AsNoTracking().Where(p => p.Barcode != null && barcodes.Contains(p.Barcode))
                .Select(p => new { p.Barcode, P = new BulkStockProduct(p.Id, p.Code, p.Name, p.Unit, p.StockQty, p.ReservedQty) }).ToListAsync(ct))
            .GroupBy(x => x.Barcode!, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.Select(x => x.P).ToList(), StringComparer.OrdinalIgnoreCase);
        var labels = input.Select(r => r.Rack?.Trim().ToUpperInvariant()).Where(l => !string.IsNullOrEmpty(l)).Distinct().ToList();
        var racks = await _db.RackLocations.AsNoTracking().Where(l => labels.Contains(l.Label.ToUpper()))
            .Select(l => new { l.Label, l.Id }).ToListAsync(ct);
        var rackMap = racks.GroupBy(r => r.Label.ToUpperInvariant()).ToDictionary(g => g.Key, g => g.First().Id);
        return new Lookup(byCode, byBarcode, label => rackMap.TryGetValue(label.Trim().ToUpperInvariant(), out var id) ? id : null);
    }
}

/// <summary>Row validation (pure; unit tested without a database).</summary>
public static class BulkStockRules
{
    public const string Ok = "OK", NoChange = "No change", Error = "Error";
    public const int MaxNote = 200;

    /// <summary>The mode chosen on the upload screen: "set" (default) or "add".</summary>
    public static string DefaultMode(string? mode) => Mode(mode) ?? (string.IsNullOrWhiteSpace(mode) ? "set" : throw new AppException("Default mode must be set or add."));

    /// <summary>"set" / "add" (also "replace" → set, "increase" → add), any case; blank or anything else → null.</summary>
    public static string? Mode(string? raw) => raw?.Trim().ToLowerInvariant() switch
    {
        "set" or "replace" => "set",
        "add" or "increase" => "add",
        _ => null
    };

    public static List<BulkStockRowResult> Validate(IReadOnlyList<BulkStockInputRow> rows, string defaultMode,
        IReadOnlyDictionary<string, BulkStockProduct> byCode, IReadOnlyDictionary<string, List<BulkStockProduct>> byBarcode,
        Func<string, long?> rack)
    {
        var results = new List<BulkStockRowResult>(rows.Count);
        foreach (var r in rows)
        {
            var errors = new List<string>();
            BulkStockProduct? product = null;
            var code = r.ProductCode?.Trim();
            var barcode = r.Barcode?.Trim();
            if (!string.IsNullOrEmpty(code))
            {
                if (!byCode.TryGetValue(code, out product)) errors.Add($"Unknown product code '{code}'.");
            }
            else if (!string.IsNullOrEmpty(barcode))
            {
                if (!byBarcode.TryGetValue(barcode, out var matches) || matches.Count == 0) errors.Add($"Unknown barcode '{barcode}'.");
                else if (matches.Count > 1) errors.Add($"Barcode '{barcode}' belongs to more than one product. Use product_code.");
                else product = matches[0];
            }
            else errors.Add("Product code or barcode is required.");

            var mode = string.IsNullOrWhiteSpace(r.Mode) ? defaultMode : Mode(r.Mode);
            if (mode == null) errors.Add($"Invalid mode '{r.Mode!.Trim()}'. Use set or add.");

            decimal? qty = null;
            if (string.IsNullOrWhiteSpace(r.Quantity)) errors.Add("Quantity is required.");
            else if (!decimal.TryParse(r.Quantity.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var q)) errors.Add($"Quantity '{r.Quantity.Trim()}' is not a number.");
            else if (q < 0) errors.Add("Quantity can't be negative.");
            else if (decimal.Round(q, 3) != q) errors.Add("Quantity can have at most 3 decimal places.");
            else qty = q;

            var rackLabel = string.IsNullOrWhiteSpace(r.Rack) ? null : r.Rack.Trim();
            if (rackLabel != null && rack(rackLabel) == null) errors.Add($"Unknown rack location '{rackLabel}'.");
            var note = string.IsNullOrWhiteSpace(r.Note) ? null : r.Note.Trim();
            if (note?.Length > MaxNote) errors.Add($"Note must be at most {MaxNote} characters.");

            decimal? newStock = null;
            if (product != null && qty != null && mode != null)
            {
                newStock = mode == "set" ? qty.Value : product.StockQty + qty.Value;
                if (product.Unit.Trim().ToLowerInvariant() is "pcs" or "pc" or "piece" or "pieces" or "nos" && newStock != decimal.Truncate(newStock.Value))
                    errors.Add($"{product.Unit} must be a whole number.");
                if (newStock < product.ReservedQty)
                    errors.Add($"New stock {newStock:0.###} is less than the {product.ReservedQty:0.###} reserved for paid orders.");
            }
            results.Add(new BulkStockRowResult(r.Row, product?.Code ?? code ?? barcode, product?.Id, product?.Name, mode ?? r.Mode?.Trim() ?? defaultMode,
                qty, product?.StockQty, newStock, rackLabel, note,
                errors.Count > 0 ? Error : newStock == product!.StockQty ? NoChange : Ok, errors));
        }

        // The same product twice in one file is ambiguous: every row for it is an error.
        foreach (var dup in results.Where(x => x.ProductId != null).GroupBy(x => x.ProductId).Where(g => g.Count() > 1))
        {
            var rowNos = string.Join(", ", dup.Select(x => x.Row));
            foreach (var x in dup)
            {
                var i = results.IndexOf(x);
                results[i] = x with { Status = Error, Errors = x.Errors.Append($"Duplicate product: {x.ProductCode} appears on rows {rowNos}.").ToList() };
            }
        }
        return results;
    }
}

/// <summary>Reads the uploaded .xlsx or .csv file into text rows.</summary>
public static class BulkStockFile
{
    public const long MaxBytes = 5 * 1024 * 1024;
    public const int MaxRows = 20000;
    public static readonly string[] TemplateHeaders = { "product_code", "barcode", "product_name", "current_stock", "quantity", "mode", "rack", "note" };

    private static string Normalize(string h) => new(h.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    public static string SafeName(string fileName)
    {
        var name = Path.GetFileName(fileName ?? "").Trim();
        name = new string(name.Where(c => !char.IsControl(c)).ToArray());
        return string.IsNullOrEmpty(name) ? "upload" : name.Length > 120 ? name[..120] : name;
    }

    public static List<BulkStockInputRow> Read(Stream file, string fileName)
    {
        var ext = Path.GetExtension(fileName ?? "").ToLowerInvariant();
        using var buffer = new MemoryStream();
        file.CopyTo(buffer);
        if (buffer.Length == 0) throw new AppException("The file is empty.");
        if (buffer.Length > MaxBytes) throw new AppException("The file is larger than 5 MB. Split it into smaller files.");
        buffer.Position = 0;
        List<string?[]> table = ext switch
        {
            ".csv" => ParseCsv(Encoding.UTF8.GetString(buffer.ToArray())),
            ".xlsx" => ReadXlsx(buffer),
            _ => throw new AppException("Upload a .csv or .xlsx file."),
        };
        if (table.Count == 0) throw new AppException("The file has no header row. Download the template.");
        var header = table[0].Select(h => Normalize(h ?? "")).ToList();
        int Col(params string[] names) => names.Select(n => header.IndexOf(Normalize(n))).FirstOrDefault(i => i >= 0, -1);
        var cCode = Col("product_code", "code", "product code");
        var cBarcode = Col("barcode");
        var cQty = Col("quantity", "qty");
        if (cQty < 0 || (cCode < 0 && cBarcode < 0))
            throw new AppException("The file needs a quantity column and a product_code (or barcode) column. Download the template.");
        var cMode = Col("mode");
        var cRack = Col("rack", "rack location");
        var cNote = Col("note", "notes");
        string? Cell(string?[] row, int c) => c < 0 || c >= row.Length ? null : string.IsNullOrWhiteSpace(row[c]) ? null : row[c]!.Trim();

        var rows = new List<BulkStockInputRow>();
        for (var i = 1; i < table.Count; i++)
        {
            var row = table[i];
            if (row.All(string.IsNullOrWhiteSpace)) continue;
            rows.Add(new BulkStockInputRow(i + 1, Cell(row, cCode), Cell(row, cBarcode), Cell(row, cQty), Cell(row, cMode), Cell(row, cRack), Cell(row, cNote)));
            if (rows.Count > MaxRows) throw new AppException($"The file has more than {MaxRows} rows. Split it into smaller files.");
        }
        if (rows.Count == 0) throw new AppException("The file has no rows.");
        return rows;
    }

    private static List<string?[]> ReadXlsx(Stream s)
    {
        XLWorkbook wb;
        try { wb = new XLWorkbook(s); }
        catch (Exception) { throw new AppException("Couldn't read this file. Upload an .xlsx file saved from Excel or Google Sheets, or a .csv file."); }
        using (wb)
        {
            var ws = wb.Worksheets.First();
            var last = ws.LastRowUsed()?.RowNumber() ?? 0;
            if (last > MaxRows + 1) throw new AppException($"The file has more than {MaxRows} rows. Split it into smaller files.");
            var lastCol = ws.Row(1).CellsUsed().Select(c => c.Address.ColumnNumber).DefaultIfEmpty(0).Max();
            var table = new List<string?[]>();
            for (var r = 1; r <= last; r++)
            {
                var row = new string?[lastCol];
                for (var c = 1; c <= lastCol; c++)
                {
                    var text = ws.Cell(r, c).GetFormattedString().Trim();
                    // Numbers formatted with thousands separators ("1,250") are read as plain numbers.
                    if (text.Length > 0 && text.Contains(',') && decimal.TryParse(text.Replace(",", ""), NumberStyles.Number, CultureInfo.InvariantCulture, out _))
                        text = text.Replace(",", "");
                    row[c - 1] = text.Length == 0 ? null : text;
                }
                table.Add(row);
            }
            return table;
        }
    }

    /// <summary>RFC 4180 CSV: commas, quoted fields with "" escapes and line breaks; a UTF-8 BOM is ignored.</summary>
    public static List<string?[]> ParseCsv(string text)
    {
        var rows = new List<string?[]>();
        var row = new List<string?>();
        var field = new StringBuilder();
        var quoted = false;
        var i = text.Length > 0 && text[0] == '﻿' ? 1 : 0;
        for (; i < text.Length; i++)
        {
            var ch = text[i];
            if (quoted)
            {
                if (ch == '"' && i + 1 < text.Length && text[i + 1] == '"') { field.Append('"'); i++; }
                else if (ch == '"') quoted = false;
                else field.Append(ch);
            }
            else if (ch == '"') quoted = true;
            else if (ch == ',') { row.Add(field.ToString()); field.Clear(); }
            else if (ch == '\r') { }
            else if (ch == '\n') { row.Add(field.ToString()); field.Clear(); rows.Add(row.ToArray()); row = new(); }
            else field.Append(ch);
        }
        if (field.Length > 0 || row.Count > 0) { row.Add(field.ToString()); rows.Add(row.ToArray()); }
        return rows;
    }

    public static string CsvCell(object? v)
    {
        var s = v switch { null => "", decimal d => d.ToString("0.###", CultureInfo.InvariantCulture), _ => v.ToString() ?? "" };
        return s.IndexOfAny(new[] { ',', '"', '\n', '\r' }) >= 0 ? $"\"{s.Replace("\"", "\"\"")}\"" : s;
    }
}
