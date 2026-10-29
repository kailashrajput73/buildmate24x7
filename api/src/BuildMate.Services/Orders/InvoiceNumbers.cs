using BuildMate.Data;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Orders;

public record InvoiceNumberingDto(string FinancialYear, string Prefix, int Digits, long NextNumber, string NextInvoiceNo);

/// <summary>
/// Tax-invoice numbers in the store's own format, e.g. SES/26-27/001. The running number restarts every
/// financial year (April). Each year's counter lives in the settings table under "counter:invoice:26-27" and
/// is row-locked while a number is taken, so two dispatches can never get the same number. The next number
/// can be set from Admin → Settings, e.g. to continue after invoices raised in the store's other billing software.
/// </summary>
public interface IInvoiceNumbers
{
    /// <summary>Takes the next number. Call inside the dispatch transaction.</summary>
    Task<string> TakeAsync(CancellationToken ct = default);
    Task<InvoiceNumberingDto> PeekAsync(CancellationToken ct = default);
    Task<InvoiceNumberingDto> SetNextAsync(long next, CancellationToken ct = default);
}

public class InvoiceNumbers : IInvoiceNumbers
{
    private readonly AppDbContext _db;
    private readonly ISettingsService _settings;

    public InvoiceNumbers(AppDbContext db, ISettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    private static string Fy => Clock.FinancialYearLabel(Clock.TodayIst);
    private static string Key(string fy) => $"counter:invoice:{fy}";

    private static string Format(StoreSettings s, string fy, long n) =>
        $"{(string.IsNullOrWhiteSpace(s.InvoicePrefix) ? "INV" : s.InvoicePrefix.Trim())}/{fy}/{n.ToString(new string('0', Math.Clamp(s.InvoiceNumberDigits, 1, 8)))}";

    public async Task<string> TakeAsync(CancellationToken ct = default)
    {
        var s = await _settings.GetAsync(ct);
        var fy = Fy;
        await _db.Database.ExecuteSqlRawAsync(
            "INSERT INTO settings (key, value, updated_at) VALUES ({0}, '1', now()) ON CONFLICT (key) DO NOTHING", new object[] { Key(fy) }, ct);
        var row = (await _db.Settings.FromSqlRaw("SELECT * FROM settings WHERE key = {0} FOR UPDATE", Key(fy)).ToListAsync(ct)).First();
        var n = long.TryParse(row.Value, out var v) && v > 0 ? v : 1;
        // Skip any number already used (e.g. the next number was set back by hand).
        var no = Format(s, fy, n);
        while (await _db.Dispatches.AnyAsync(d => d.InvoiceNo == no, ct)) no = Format(s, fy, ++n);
        row.Value = (n + 1).ToString();
        row.UpdatedAt = DateTime.UtcNow;
        return no;
    }

    public async Task<InvoiceNumberingDto> PeekAsync(CancellationToken ct = default)
    {
        var s = await _settings.GetAsync(ct);
        var fy = Fy;
        var row = await _db.Settings.AsNoTracking().FirstOrDefaultAsync(x => x.Key == Key(fy), ct);
        var n = row != null && long.TryParse(row.Value, out var v) && v > 0 ? v : 1;
        return new InvoiceNumberingDto(fy, s.InvoicePrefix, s.InvoiceNumberDigits, n, Format(s, fy, n));
    }

    public async Task<InvoiceNumberingDto> SetNextAsync(long next, CancellationToken ct = default)
    {
        if (next < 1 || next > 99_999_999) throw new AppException("The next invoice number must be between 1 and 99999999.");
        var fy = Fy;
        var row = await _db.Settings.FirstOrDefaultAsync(x => x.Key == Key(fy), ct);
        if (row == null) _db.Settings.Add(new Domain.Entities.AppSetting { Key = Key(fy), Value = next.ToString() });
        else { row.Value = next.ToString(); row.UpdatedAt = DateTime.UtcNow; }
        await _db.SaveChangesAsync(ct);
        return await PeekAsync(ct);
    }
}
