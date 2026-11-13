using System.Text.Json;
using BuildMate.Services.Common;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace BuildMate.Services.Content;

/// <summary>
/// One serviceable delivery PIN code, managed from the admin dashboard (Delivery Areas). Kept in the store settings
/// record, so adding areas needs no database change.
/// </summary>
public class DeliveryArea
{
    public string Pincode { get; set; } = "";
    public string? City { get; set; }
    public string? District { get; set; }
    public string? State { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? AddedAt { get; set; }
}

public record DeliveryAreaUpsert(string? Pincode, string? City, string? District, string? State, bool? IsActive);

/// <summary>City / district / state of a PIN code, from the configured area or the India Post directory.</summary>
public record PincodePlace(string Pincode, string? City, string? District, string? State);

/// <summary>Result of a delivery check. Status is SERVICEABLE, NOT_SERVICEABLE or INVALID.</summary>
public record DeliveryCheckResult(string Pincode, string Status, bool Serviceable, string? City, string? District, string? State, string Message);

/// <summary>
/// The one serviceability rule, used by the check endpoint, saved addresses and order creation alike:
/// a PIN code is serviceable only when it is in the Delivery Areas list and switched on. Nothing else counts —
/// not the customer's GPS position, IP address or current city.
/// </summary>
public static class DeliveryAreaRules
{
    public const string Serviceable = "SERVICEABLE";
    public const string NotServiceable = "NOT_SERVICEABLE";
    public const string Invalid = "INVALID";

    /// <summary>A valid Indian PIN code: 6 digits, not starting with 0. Returns null otherwise.</summary>
    public static string? Normalize(string? pincode)
    {
        var pin = (pincode ?? "").Trim().Replace(" ", "");
        return pin.Length == 6 && pin.All(char.IsDigit) && pin[0] != '0' ? pin : null;
    }

    public static bool IsServiceable(StoreSettings settings, string? pincode)
    {
        var pin = Normalize(pincode);
        return pin != null && settings.DeliveryAreas.Any(a => a.IsActive && a.Pincode == pin);
    }

    /// <summary>
    /// Brings older settings up to date and keeps the plain PIN list (read by older app versions) in step:
    /// a store that had a "delivery PIN codes" list keeps those PINs as active areas.
    /// </summary>
    public static void Normalize(StoreSettings settings)
    {
        settings.DeliveryAreas ??= new();
        // One-time carry-over; afterwards an empty list really is empty (e.g. the last PIN code was removed).
        if (!settings.DeliveryAreasMigrated)
        {
            if (settings.DeliveryAreas.Count == 0 && settings.DeliveryPincodes is { Count: > 0 })
                foreach (var pin in settings.DeliveryPincodes.Select(Normalize).OfType<string>().Distinct())
                    settings.DeliveryAreas.Add(new DeliveryArea { Pincode = pin, IsActive = true });
            settings.DeliveryAreasMigrated = true;
        }
        settings.DeliveryPincodes = settings.DeliveryAreas.Where(a => a.IsActive).Select(a => a.Pincode).Distinct().ToList();
    }
}

public interface IPincodeDirectory
{
    /// <summary>City, district and state for a PIN code, or null when unknown / the directory can't be reached.</summary>
    Task<PincodePlace?> LookupAsync(string pincode, CancellationToken ct = default);
}

/// <summary>
/// India Post PIN code directory (api.postalpincode.in, free, no key). Used only to fill in city / district /
/// state; serviceability never depends on it. Results are cached; any failure just means "unknown".
/// </summary>
public class IndiaPostPincodeDirectory : IPincodeDirectory
{
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<IndiaPostPincodeDirectory> _log;

    public IndiaPostPincodeDirectory(HttpClient http, IMemoryCache cache, ILogger<IndiaPostPincodeDirectory> log)
    {
        _http = http;
        _cache = cache;
        _log = log;
    }

    public async Task<PincodePlace?> LookupAsync(string pincode, CancellationToken ct = default)
    {
        var pin = DeliveryAreaRules.Normalize(pincode);
        if (pin == null) return null;
        var key = $"pin:{pin}";
        if (_cache.TryGetValue(key, out PincodePlace? cached)) return cached;
        try
        {
            using var res = await _http.GetAsync($"https://api.postalpincode.in/pincode/{pin}", ct);
            if (!res.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            PincodePlace? place = null;
            if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
            {
                var first = doc.RootElement[0];
                if (first.TryGetProperty("PostOffice", out var offices) && offices.ValueKind == JsonValueKind.Array && offices.GetArrayLength() > 0)
                {
                    var po = offices[0];
                    string? Get(string name) => po.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
                    var district = Get("District");
                    place = new PincodePlace(pin, Get("Block") is { Length: > 0 } block && block != "NA" ? block : district, district, Get("State"));
                }
            }
            _cache.Set(key, place, TimeSpan.FromDays(place == null ? 1 : 30));
            return place;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
        {
            _log.LogInformation("PIN code lookup for {Pin} failed: {Message}", pin, e.Message);
            return null;
        }
    }
}

public interface IDeliveryAreaService
{
    Task<DeliveryCheckResult> CheckAsync(string? pincode, CancellationToken ct = default);
    Task<List<DeliveryArea>> ListAsync(CancellationToken ct = default);
    Task<DeliveryArea> AddAsync(DeliveryAreaUpsert dto, CancellationToken ct = default);
    Task<DeliveryArea> UpdateAsync(string pincode, DeliveryAreaUpsert dto, CancellationToken ct = default);
    Task RemoveAsync(string pincode, CancellationToken ct = default);
    Task<PincodePlace?> LookupAsync(string pincode, CancellationToken ct = default);
}

public class DeliveryAreaService : IDeliveryAreaService
{
    private readonly ISettingsService _settings;
    private readonly IPincodeDirectory _directory;

    public DeliveryAreaService(ISettingsService settings, IPincodeDirectory directory)
    {
        _settings = settings;
        _directory = directory;
    }

    public async Task<DeliveryCheckResult> CheckAsync(string? pincode, CancellationToken ct = default)
    {
        var pin = DeliveryAreaRules.Normalize(pincode);
        if (pin == null)
            return new DeliveryCheckResult((pincode ?? "").Trim(), DeliveryAreaRules.Invalid, false, null, null, null, "Enter a valid 6-digit PIN code.");

        var settings = await _settings.GetAsync(ct);
        var area = settings.DeliveryAreas.FirstOrDefault(a => a.Pincode == pin);
        var serviceable = area is { IsActive: true } && settings.HomeDeliveryEnabled;
        PincodePlace? place = area is { City: { Length: > 0 } } ? new PincodePlace(pin, area.City, area.District, area.State) : await _directory.LookupAsync(pin, ct);
        var where = place?.City ?? place?.District;
        var message = serviceable
            ? $"Delivery available to {pin}{(where != null ? $" ({where})" : "")}."
            : settings.HomeDeliveryEnabled
                ? $"Sorry, we don't deliver to {pin}{(where != null ? $" ({where})" : "")} yet."
                : "Home delivery is not available right now.";
        return new DeliveryCheckResult(pin, serviceable ? DeliveryAreaRules.Serviceable : DeliveryAreaRules.NotServiceable, serviceable,
            place?.City, place?.District, place?.State, message);
    }

    public async Task<List<DeliveryArea>> ListAsync(CancellationToken ct = default) =>
        (await _settings.GetAsync(ct)).DeliveryAreas.OrderBy(a => a.Pincode).ToList();

    public async Task<DeliveryArea> AddAsync(DeliveryAreaUpsert dto, CancellationToken ct = default)
    {
        var pin = DeliveryAreaRules.Normalize(dto.Pincode) ?? throw new AppException("Enter a valid 6-digit PIN code.");
        var settings = await Copy(ct);
        if (settings.DeliveryAreas.Any(a => a.Pincode == pin)) throw new AppException($"{pin} is already in the list.", 409, "pincode_exists");
        var area = new DeliveryArea { Pincode = pin, IsActive = dto.IsActive ?? true, AddedAt = DateTime.UtcNow };
        await Fill(area, dto, ct);
        settings.DeliveryAreas.Add(area);
        await _settings.SaveAsync(settings, ct);
        return area;
    }

    public async Task<DeliveryArea> UpdateAsync(string pincode, DeliveryAreaUpsert dto, CancellationToken ct = default)
    {
        var pin = DeliveryAreaRules.Normalize(pincode) ?? throw new AppException("Enter a valid 6-digit PIN code.");
        var settings = await Copy(ct);
        var area = settings.DeliveryAreas.FirstOrDefault(a => a.Pincode == pin) ?? throw new NotFoundException("PIN code");
        if (dto.IsActive is { } active) area.IsActive = active;
        if (dto.City != null) area.City = Clean(dto.City);
        if (dto.District != null) area.District = Clean(dto.District);
        if (dto.State != null) area.State = Clean(dto.State);
        await _settings.SaveAsync(settings, ct);
        return area;
    }

    public async Task RemoveAsync(string pincode, CancellationToken ct = default)
    {
        var pin = DeliveryAreaRules.Normalize(pincode) ?? throw new AppException("Enter a valid 6-digit PIN code.");
        var settings = await Copy(ct);
        if (settings.DeliveryAreas.RemoveAll(a => a.Pincode == pin) == 0) throw new NotFoundException("PIN code");
        await _settings.SaveAsync(settings, ct);
    }

    public Task<PincodePlace?> LookupAsync(string pincode, CancellationToken ct = default)
    {
        var pin = DeliveryAreaRules.Normalize(pincode) ?? throw new AppException("Enter a valid 6-digit PIN code.");
        return _directory.LookupAsync(pin, ct);
    }

    /// <summary>Typed-in city / district / state win; blanks are filled from the PIN directory when it answers.</summary>
    private async Task Fill(DeliveryArea area, DeliveryAreaUpsert dto, CancellationToken ct)
    {
        area.City = Clean(dto.City);
        area.District = Clean(dto.District);
        area.State = Clean(dto.State);
        if (area.City != null && area.District != null && area.State != null) return;
        var place = await _directory.LookupAsync(area.Pincode, ct);
        area.City ??= place?.City;
        area.District ??= place?.District;
        area.State ??= place?.State;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>A private copy of the settings: the cached instance is never changed in place.</summary>
    private async Task<StoreSettings> Copy(CancellationToken ct)
    {
        var current = await _settings.GetAsync(ct);
        var json = JsonSerializer.Serialize(current);
        return JsonSerializer.Deserialize<StoreSettings>(json)!;
    }
}
