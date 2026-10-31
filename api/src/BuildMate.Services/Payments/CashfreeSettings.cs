using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using BuildMate.Data;
using BuildMate.Domain.Common;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BuildMate.Services.Payments;

// Request classes intentionally have no generated ToString that could print credentials.
public sealed class CashfreeCredentialInput
{
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
}
public sealed class SaveCashfreeSettings
{
    public long Revision { get; set; }
    public CashfreeCredentialInput? Sandbox { get; set; }
    public CashfreeCredentialInput? Production { get; set; }
    public string Mode { get; set; } = "sandbox";
    public bool Activate { get; set; }
    public bool ConfirmLive { get; set; }
}
public record CashfreeSettingsStatus(long Revision, bool Activated, string Mode, string EffectiveMode,
    bool SandboxConfigured, bool ProductionConfigured, bool LegacyConfigured);
public record CashfreeAudit(DateTime At, long ActorId, string Action, string FromMode, string ToMode, long Revision);

public sealed class CashfreeSettingsState
{
    public long Revision { get; set; }
    public bool Activated { get; set; }
    public string Mode { get; set; } = "sandbox";
    public string? Sandbox { get; set; }
    public string? Production { get; set; }
    public string Legacy { get; set; } = "";
}

/// <summary>Uses private namespaced rows in the existing settings table. Public store settings read only key "store".
/// Versions and bindings are append-only; no credential values are included in status or audit DTOs.</summary>
public sealed class CashfreeSettingsService(
    AppDbContext db, DbContextOptions<AppDbContext> dbOptions, IOptions<CashfreeOptions> legacy,
    PaymentSecrets secrets, IHttpClientFactory clients, ILoggerFactory logs, ICurrentUser user)
{
    internal const string StateKey = "payments:cashfree:state";
    private const string VersionPrefix = "payments:cashfree:version:";
    private const string AuditPrefix = "payments:cashfree:audit:";

    private void Authorize()
    {
        if (user.UserType != UserType.Staff || user.Id == null || !user.HasPermission(Permissions.SettingsManage))
            throw new ForbiddenException();
    }
    private static async Task LockAsync(AppDbContext context, CancellationToken ct)
    {
        // Cross-process lock, held only for this transaction. Also coordinates activation with payment binding.
        if (context.Database.IsNpgsql())
            await context.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(72424001)", ct);
    }
    private static async Task<CashfreeSettingsState?> StateAsync(AppDbContext context, CancellationToken ct)
    {
        var row = await context.Settings.AsNoTracking().SingleOrDefaultAsync(x => x.Key == StateKey, ct);
        return row == null ? null : JsonSerializer.Deserialize<CashfreeSettingsState>(row.Value)!;
    }
    private async Task<CashfreeOptions> VersionAsync(AppDbContext context, string id, CancellationToken ct)
    {
        var row = await context.Settings.AsNoTracking().SingleAsync(x => x.Key == VersionPrefix + id, ct);
        return JsonSerializer.Deserialize<CashfreeOptions>(secrets.Decrypt(row.Value, id))!;
    }
    private string AddVersion(AppDbContext context, CashfreeOptions options)
    {
        var id = Guid.NewGuid().ToString("N");
        context.Settings.Add(new AppSetting { Key = VersionPrefix + id, Value = secrets.Encrypt(JsonSerializer.Serialize(options), id) });
        return id;
    }
    private static string Selected(CashfreeSettingsState state) => !state.Activated ? state.Legacy :
        (state.Mode == "production" ? state.Production : state.Sandbox) ?? throw new AppException("Configure credentials before activating this mode.");

    public async Task<CashfreeSettingsStatus> GetAsync(CancellationToken ct = default)
    {
        Authorize();
        var state = await StateAsync(db, ct);
        var effective = state == null || !state.Activated ? legacy.Value : await VersionAsync(db, Selected(state), ct);
        return new(state?.Revision ?? 0, state?.Activated ?? false, state?.Mode ?? "sandbox", effective.Environment,
            state?.Sandbox != null, state?.Production != null, legacy.Value.KeysSet);
    }
    public async Task<IReadOnlyList<CashfreeAudit>> AuditAsync(CancellationToken ct = default)
    {
        Authorize();
        var rows = await db.Settings.AsNoTracking().Where(x => x.Key.StartsWith(AuditPrefix))
            .OrderByDescending(x => x.UpdatedAt).Take(50).ToListAsync(ct);
        return rows.Select(x => JsonSerializer.Deserialize<CashfreeAudit>(x.Value)!).ToList();
    }
    public static void ValidateCredentials(CashfreeCredentialInput input)
    {
        // Do not assume undocumented TEST/live prefixes. The environment-specific API validates the pair.
        if (string.IsNullOrWhiteSpace(input.ClientId) || string.IsNullOrWhiteSpace(input.ClientSecret) ||
            !Regex.IsMatch(input.ClientId, "^[A-Za-z0-9_-]{8,256}$") ||
            !Regex.IsMatch(input.ClientSecret, "^[A-Za-z0-9_+=/.-]{16,512}$"))
            throw new AppException("Enter a valid Client ID (8–256 characters) and Client Secret (16–512 characters), without spaces.", 400, "cashfree_credentials_invalid");
    }
    private CashfreeOptions Options(string mode, CashfreeCredentialInput input) => new()
    {
        Environment = mode, ClientId = input.ClientId, ClientSecret = input.ClientSecret,
        ApiVersion = legacy.Value.ApiVersion, WebReturnUrl = legacy.Value.WebReturnUrl, NotifyUrl = legacy.Value.NotifyUrl
    };
    public CashfreeGateway Gateway(CashfreeOptions options) => new(clients.CreateClient("cashfree"), Microsoft.Extensions.Options.Options.Create(options), logs.CreateLogger<CashfreeGateway>());
    private async Task ValidateRemoteAsync(CashfreeOptions options, CancellationToken ct)
    {
        var (ok, _) = await Gateway(options).TestConnectionAsync(ct);
        if (!ok) throw new AppException("Cashfree could not validate these credentials for the selected environment. Check the keys, IP allowlist and network, then retry.", 400, "cashfree_validation_failed");
    }
    public async Task<CashfreeSettingsStatus> SaveAsync(SaveCashfreeSettings request, CancellationToken ct = default)
    {
        Authorize();
        if (request.Mode is not ("sandbox" or "production")) throw new AppException("Select Test or Live mode.");
        // Validate before taking the configuration lock. An unsuccessful validation stores nothing.
        foreach (var (mode, input) in new[] { ("sandbox", request.Sandbox), ("production", request.Production) })
        {
            if (input == null) continue;
            ValidateCredentials(input);
            await ValidateRemoteAsync(Options(mode, input), ct);
        }
        await using var tx = await db.Database.BeginTransactionAsync(db.Database.IsNpgsql() ? IsolationLevel.ReadCommitted : IsolationLevel.Serializable, ct);
        await LockAsync(db, ct);
        var state = await StateAsync(db, ct) ?? new CashfreeSettingsState();
        if (state.Revision != request.Revision) throw new AppException("Settings changed in another session. Reload before saving.", 409, "settings_conflict");
        var before = !state.Activated ? legacy.Value.Environment : (await VersionAsync(db, Selected(state), ct)).Environment;
        if (state.Revision == 0) state.Legacy = AddVersion(db, legacy.Value);
        if (request.Sandbox != null) state.Sandbox = AddVersion(db, Options("sandbox", request.Sandbox));
        if (request.Production != null) state.Production = AddVersion(db, Options("production", request.Production));
        var wasActive = state.Activated;
        state.Activated |= request.Activate; // Once active, environment fallback cannot silently reappear.
        state.Mode = request.Mode;
        if (state.Activated)
        {
            var target = request.Mode == "production" ? request.Production : request.Sandbox;
            var targetId = Selected(state);
            var options = target == null ? await VersionAsync(db, targetId, ct) : Options(request.Mode, target);
            if (options.Environment == "production" && (!wasActive || before != "production") && !request.ConfirmLive)
                throw new AppException("Confirm switching to Live Mode. Real payments will be collected.", 400, "live_confirmation_required");
            if (!options.KeysSet) throw new AppException("Configure both credentials before activating this mode.");
            if (options.Problems().Count != 0) throw new AppException("Configure valid public return and webhook URLs on the server before activation.");
            if (target == null) await ValidateRemoteAsync(options, ct);
        }
        state.Revision++;
        var row = await db.Settings.SingleOrDefaultAsync(x => x.Key == StateKey, ct);
        if (row == null) db.Settings.Add(new AppSetting { Key = StateKey, Value = JsonSerializer.Serialize(state) });
        else { row.Value = JsonSerializer.Serialize(state); row.UpdatedAt = DateTime.UtcNow; }
        var actions = new List<string>();
        if (request.Sandbox != null) actions.Add("sandbox_credentials_replaced");
        if (request.Production != null) actions.Add("production_credentials_replaced");
        if (!wasActive && state.Activated) actions.Add("dashboard_activated");
        actions.Add("settings_saved");
        var after = state.Activated ? state.Mode : before;
        if (before != after) actions.Add("mode_changed");
        foreach (var action in actions)
        {
            var entry = new CashfreeAudit(DateTime.UtcNow, user.RequireId(), action, before, after, state.Revision);
            db.Settings.Add(new AppSetting { Key = AuditPrefix + Guid.NewGuid().ToString("N"), Value = JsonSerializer.Serialize(entry) });
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(ct);
    }

    private static string BindingKey(string orderId) => "payments:cashfree:order:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(orderId)));
    public async Task<CashfreeOptions> ResolveAsync(string? orderId, CancellationToken ct = default)
    {
        var state = await StateAsync(db, ct);
        if (state == null) return legacy.Value;
        if (orderId == null) return !state.Activated ? legacy.Value : await VersionAsync(db, Selected(state), ct);
        var binding = await db.Settings.AsNoTracking().SingleOrDefaultAsync(x => x.Key == BindingKey(orderId), ct);
        // Unbound historical payments ALWAYS use the preserved pre-activation configuration, never the active mode.
        return await VersionAsync(db, binding?.Value ?? state.Legacy, ct);
    }
    public async Task<CashfreeOptions> BindAsync(string orderId, CancellationToken ct = default)
    {
        // Independent transaction: a remote order may exist even if the checkout transaction later rolls back.
        // Preserve the binding for deterministic retries of that gateway order ID.
        await using var context = new AppDbContext(dbOptions);
        await using var tx = await context.Database.BeginTransactionAsync(context.Database.IsNpgsql() ? IsolationLevel.ReadCommitted : IsolationLevel.Serializable, ct);
        await LockAsync(context, ct);
        var state = await StateAsync(context, ct);
        if (state == null) { await tx.CommitAsync(ct); return legacy.Value; }
        var key = BindingKey(orderId);
        var binding = await context.Settings.AsNoTracking().SingleOrDefaultAsync(x => x.Key == key, ct);
        var version = binding?.Value ?? (state.Activated ? Selected(state) : AddVersion(context, legacy.Value));
        if (binding == null)
        {
            context.Settings.Add(new AppSetting { Key = key, Value = version });
            await context.SaveChangesAsync(ct);
        }
        var result = await VersionAsync(context, version, ct);
        await tx.CommitAsync(ct);
        return result;
    }
}
