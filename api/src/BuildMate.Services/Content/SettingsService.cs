using System.Text.Json;
using BuildMate.Data;
using BuildMate.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace BuildMate.Services.Content;

/// <summary>Store-wide settings editable from the admin panel. Read by web, app and invoices.</summary>
public class StoreSettings
{
    public string StoreName { get; set; } = "BuildMate 24x7";
    // Seller details as printed on the store's own tax invoices (SES/25-26/068).
    public string LegalName { get; set; } = "Shivani Electrochem Services";
    public string AddressLine { get; set; } = "16/18 E, Sahajanand Society, Vill Baroi, Ta-Mundra, Dist-Bhuj";
    public string City { get; set; } = "Mundra (Kutchh)";
    public string State { get; set; } = "Gujarat";
    public string Pincode { get; set; } = "370421";
    public string? Gstin { get; set; } = "24AUWPC0904B1Z5";
    public string? Pan { get; set; } = "AUWPC0904B";
    public string? BankName { get; set; } = "Axis Bank";
    public string? BankBranch { get; set; } = "Baroi";
    public string? BankAccountNo { get; set; } = "918020016036424";
    public string? BankIfsc { get; set; } = "UTIB0002227";
    /// <summary>Logo printed at the top of invoices (the company's, not the BuildMate app logo).</summary>
    public string? InvoiceLogoUrl { get; set; } = "/ses-logo.png";
    public string SupportPhone { get; set; } = "";
    public string? SupportEmail { get; set; }
    public string? WhatsAppNumber { get; set; }
    public string OpeningHours { get; set; } = "Open 24x7";

    public decimal MinOrderValue { get; set; } = 0;
    public decimal DeliveryFee { get; set; } = 0;
    public decimal FreeDeliveryAbove { get; set; } = 0;
    /// <summary>Empty list = deliver to any pincode.</summary>
    public List<string> DeliveryPincodes { get; set; } = new();
    public bool HomeDeliveryEnabled { get; set; } = true;
    public bool StorePickupEnabled { get; set; } = true;

    /// <summary>Rupee value of one reward point when redeemed offline.</summary>
    public decimal RewardPointValue { get; set; } = 1m;
    /// <summary>Refer &amp; Earn: points for the person who invited a new user (0 = no points, codes still tracked).</summary>
    public decimal ReferralRewardPoints { get; set; } = 0m;
    /// <summary>Refer &amp; Earn: welcome points for the new user who signed up with a code.</summary>
    public decimal ReferralWelcomePoints { get; set; } = 0m;
    /// <summary>Invoice numbers read {prefix}/{financial year}/{number}, e.g. SESW/26-27/001 (online sales — the store keeps SES for its own bills); the number restarts each April.</summary>
    public string InvoicePrefix { get; set; } = "SESW";
    public int InvoiceNumberDigits { get; set; } = 3;
    /// <summary>One term per line, printed numbered under "Terms &amp; Conditions".</summary>
    public string InvoiceTerms { get; set; } = "Interest @ 18% p.a. will be charged if payment is not made within due date.\nOur risk and responsibility ceases as soon as the goods leave our premises.\nSubject to MUNDRA Jurisdiction only.\nE. & O. E.";

    public List<string> SupportedLanguages { get; set; } = new() { "en", "hi" };
    public string? AndroidAppUrl { get; set; }
    public string? IosAppUrl { get; set; }
    public string? MinAppVersion { get; set; }
}

public interface ISettingsService
{
    Task<StoreSettings> GetAsync(CancellationToken ct = default);
    Task<StoreSettings> SaveAsync(StoreSettings settings, CancellationToken ct = default);
}

public class SettingsService : ISettingsService
{
    private const string Key = "store";
    private const string CacheKey = "settings:store";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;

    public SettingsService(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<StoreSettings> GetAsync(CancellationToken ct = default)
    {
        if (_cache.TryGetValue(CacheKey, out StoreSettings? cached) && cached != null) return cached;
        var row = await _db.Settings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == Key, ct);
        var value = row == null ? new StoreSettings() : JsonSerializer.Deserialize<StoreSettings>(row.Value, Json) ?? new StoreSettings();
        _cache.Set(CacheKey, value, TimeSpan.FromMinutes(5));
        return value;
    }

    public async Task<StoreSettings> SaveAsync(StoreSettings settings, CancellationToken ct = default)
    {
        var row = await _db.Settings.FirstOrDefaultAsync(s => s.Key == Key, ct);
        var json = JsonSerializer.Serialize(settings, Json);
        if (row == null) _db.Settings.Add(new AppSetting { Key = Key, Value = json });
        else { row.Value = json; row.UpdatedAt = DateTime.UtcNow; }
        await _db.SaveChangesAsync(ct);
        _cache.Remove(CacheKey);
        return settings;
    }
}
