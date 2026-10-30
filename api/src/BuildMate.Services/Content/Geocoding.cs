using System.Globalization;
using System.Text.Json;
using BuildMate.Services.Common;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BuildMate.Services.Content;

public class GeocodingOptions
{
    /// <summary>"Nominatim" (OpenStreetMap, free, max 1 request/second) or "Google" (paid, needs GoogleApiKey).</summary>
    public string Provider { get; set; } = "Nominatim";
    /// <summary>Server-side key for Google's Geocoding API (never sent to browsers).</summary>
    public string? GoogleApiKey { get; set; }
    /// <summary>Nominatim's usage policy requires an identifying User-Agent with a contact.</summary>
    public string UserAgent { get; set; } = "BuildMate24x7/1.0 (support@buildmate24x7.com)";
    public int CacheHours { get; set; } = 24;
}

public record GeocodedPlace(string Address, string? Area, string? City, string? State, string? Pincode);

public interface IGeocodingService
{
    Task<GeocodedPlace> ReverseAsync(double lat, double lng, CancellationToken ct = default);
}

/// <summary>
/// Address for a map position, looked up by the server instead of every browser calling OpenStreetMap directly:
/// results are cached (positions rounded to ~10 m), Nominatim is called at most once a second with a proper
/// User-Agent, and a paid provider (Google) can be switched on in configuration.
/// </summary>
public class GeocodingService : IGeocodingService
{
    private static readonly SemaphoreSlim NominatimGate = new(1, 1);
    private static DateTime _lastNominatimCall = DateTime.MinValue;

    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly GeocodingOptions _opt;
    private readonly ILogger<GeocodingService> _log;

    public GeocodingService(HttpClient http, IMemoryCache cache, IOptions<GeocodingOptions> opt, ILogger<GeocodingService> log)
    {
        _http = http;
        _cache = cache;
        _opt = opt.Value;
        _log = log;
    }

    public async Task<GeocodedPlace> ReverseAsync(double lat, double lng, CancellationToken ct = default)
    {
        if (double.IsNaN(lat) || double.IsNaN(lng) || lat is < -90 or > 90 || lng is < -180 or > 180)
            throw new AppException("Invalid location.", 400, "geo_invalid");

        // 4 decimals ≈ 11 m: nearby positions share one lookup.
        var rLat = Math.Round(lat, 4);
        var rLng = Math.Round(lng, 4);
        var key = $"geo:{rLat.ToString(CultureInfo.InvariantCulture)},{rLng.ToString(CultureInfo.InvariantCulture)}";
        if (_cache.TryGetValue(key, out GeocodedPlace? cached) && cached != null) return cached;

        GeocodedPlace place;
        try
        {
            place = string.Equals(_opt.Provider, "Google", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(_opt.GoogleApiKey)
                ? await GoogleAsync(rLat, rLng, ct)
                : await NominatimAsync(rLat, rLng, ct);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
        {
            _log.LogWarning(e, "Reverse geocoding failed for {Lat},{Lng}", rLat, rLng);
            throw new AppException("Address lookup is unavailable right now.", 502, "geo_unavailable");
        }

        _cache.Set(key, place, TimeSpan.FromHours(Math.Max(1, _opt.CacheHours)));
        return place;
    }

    private async Task<GeocodedPlace> NominatimAsync(double lat, double lng, CancellationToken ct)
    {
        await NominatimGate.WaitAsync(ct);
        try
        {
            var wait = _lastNominatimCall.AddMilliseconds(1100) - DateTime.UtcNow;
            if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
            _lastNominatimCall = DateTime.UtcNow;

            var url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1" +
                      $"&lat={lat.ToString(CultureInfo.InvariantCulture)}&lon={lng.ToString(CultureInfo.InvariantCulture)}";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.TryAddWithoutValidation("User-Agent", _opt.UserAgent);
            req.Headers.TryAddWithoutValidation("Accept-Language", "en-IN,en");
            using var res = await _http.SendAsync(req, ct);
            res.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var root = doc.RootElement;
            string? Get(JsonElement a, params string[] names)
            {
                foreach (var n in names)
                    if (a.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString())) return v.GetString();
                return null;
            }
            var addr = root.TryGetProperty("address", out var a) ? a : default;
            var display = root.TryGetProperty("display_name", out var d) ? d.GetString() : null;
            return new GeocodedPlace(
                string.IsNullOrWhiteSpace(display) ? Coordinates(lat, lng) : display!.Trim(),
                addr.ValueKind == JsonValueKind.Object ? Get(addr, "road", "neighbourhood", "suburb", "village", "hamlet") : null,
                addr.ValueKind == JsonValueKind.Object ? Get(addr, "city", "town", "village", "county", "state_district") : null,
                addr.ValueKind == JsonValueKind.Object ? Get(addr, "state") : null,
                addr.ValueKind == JsonValueKind.Object ? Get(addr, "postcode")?.Replace(" ", "") : null);
        }
        finally
        {
            NominatimGate.Release();
        }
    }

    private async Task<GeocodedPlace> GoogleAsync(double lat, double lng, CancellationToken ct)
    {
        var url = "https://maps.googleapis.com/maps/api/geocode/json?language=en&latlng=" +
                  $"{lat.ToString(CultureInfo.InvariantCulture)},{lng.ToString(CultureInfo.InvariantCulture)}&key={Uri.EscapeDataString(_opt.GoogleApiKey!)}";
        using var res = await _http.GetAsync(url, ct);
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var results = doc.RootElement.GetProperty("results");
        if (results.GetArrayLength() == 0) return new GeocodedPlace(Coordinates(lat, lng), null, null, null, null);
        var first = results[0];
        string? Part(string type)
        {
            foreach (var c in first.GetProperty("address_components").EnumerateArray())
                if (c.GetProperty("types").EnumerateArray().Any(t => t.GetString() == type)) return c.GetProperty("long_name").GetString();
            return null;
        }
        return new GeocodedPlace(
            first.GetProperty("formatted_address").GetString() ?? Coordinates(lat, lng),
            Part("sublocality") ?? Part("route") ?? Part("neighborhood"),
            Part("locality") ?? Part("administrative_area_level_3") ?? Part("administrative_area_level_2"),
            Part("administrative_area_level_1"),
            Part("postal_code"));
    }

    private static string Coordinates(double lat, double lng) =>
        $"{lat.ToString("F5", CultureInfo.InvariantCulture)}, {lng.ToString("F5", CultureInfo.InvariantCulture)}";
}
