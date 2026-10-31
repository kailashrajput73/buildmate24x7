using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Payments;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace BuildMate.Tests;

public sealed class CashfreeSettingsTests
{
    private static CashfreeCredentialInput TestKeys() => new() { ClientId = "TEST-client-id-123", ClientSecret = "TEST-secret-value-123456789" };
    private static CashfreeCredentialInput LiveKeys() => new() { ClientId = "LIVE-client-id-123", ClientSecret = "LIVE-secret-value-123456789" };

    [Fact]
    public void Sandbox_can_use_a_local_return_url_without_a_public_webhook()
    {
        var options = new CashfreeOptions { Environment = "sandbox", ClientId = TestKeys().ClientId,
            ClientSecret = TestKeys().ClientSecret, WebReturnUrl = "http://127.0.0.1:3000/checkout/return", NotifyUrl = "" };
        Assert.Empty(options.Problems());
        options.Environment = "production";
        Assert.Equal(2, options.Problems().Count);
        options.WebReturnUrl = "https://localhost/return";
        options.NotifyUrl = "https://localhost/webhook";
        Assert.Equal(2, options.Problems().Count);
        options.Environment = "sandbox";
        options.WebReturnUrl = "not-a-url";
        Assert.NotEmpty(options.Problems());
    }

    [Fact]
    public async Task Saving_each_environment_separately_preserves_the_other()
    {
        using var h = new Harness();
        var test = await h.Save(new() { Sandbox = TestKeys() });
        Assert.True(test.SandboxConfigured); Assert.False(test.ProductionConfigured);
        var both = await h.Save(new() { Revision = 1, Production = LiveKeys() });
        Assert.True(both.SandboxConfigured); Assert.True(both.ProductionConfigured);
        await h.Save(new() { Revision = 2, Activate = true });
        using var db = h.Db();
        Assert.Equal(TestKeys().ClientSecret, (await h.Service(db).ResolveAsync(null)).ClientSecret);
    }

    [Fact]
    public async Task Inactive_settings_continue_using_server_environment_for_new_payments()
    {
        using var h = new Harness();
        await h.Save(new() { Sandbox = TestKeys() });
        h.Legacy.ClientId = "updated-server-client-123";
        using var db = h.Db(); var service = h.Service(db);
        Assert.Equal(h.Legacy.ClientId, (await service.ResolveAsync(null)).ClientId);
        var bound = await service.BindAsync("inactive-server-payment");
        Assert.Equal(h.Legacy.ClientId, bound.ClientId);
        await h.Save(new() { Revision = 1, Activate = true });
        Assert.Equal("updated-server-client-123", (await service.ResolveAsync("inactive-server-payment")).ClientId);
    }

    [Theory]
    [InlineData("sandbox")]
    [InlineData("production")]
    public async Task Credentials_are_independent_encrypted_and_never_returned(string mode)
    {
        using var h = new Harness();
        var result = await h.Save(new() { Sandbox = TestKeys(), Production = LiveKeys(), Mode = mode });
        Assert.True(result.SandboxConfigured); Assert.True(result.ProductionConfigured);
        Assert.False(result.Activated);
        var response = JsonSerializer.Serialize(result);
        using var db = h.Db();
        var persisted = string.Join(" ", await db.Settings.Select(x => x.Value).ToListAsync());
        foreach (var secret in new[] { TestKeys().ClientId, TestKeys().ClientSecret, LiveKeys().ClientId, LiveKeys().ClientSecret })
        { Assert.DoesNotContain(secret, response); Assert.DoesNotContain(secret, persisted); }
        Assert.Equal("production", result.EffectiveMode); // Existing live configuration was NOT switched to test.
    }

    [Fact]
    public async Task New_settings_default_to_test_without_activating()
    {
        using var h = new Harness();
        var result = await h.Save(new() { Sandbox = TestKeys() });
        Assert.Equal("sandbox", result.Mode); Assert.False(result.Activated);
        Assert.Equal("production", result.EffectiveMode);
    }

    [Fact]
    public async Task Switch_both_directions_preserves_credentials_and_requires_live_confirmation()
    {
        using var h = new Harness();
        var first = await h.Save(new() { Sandbox = TestKeys(), Production = LiveKeys(), Activate = true });
        Assert.Equal("sandbox", first.EffectiveMode);
        var failure = await Assert.ThrowsAsync<AppException>(() => h.Save(new() { Revision = 1, Mode = "production", Activate = true }));
        Assert.Equal("live_confirmation_required", failure.Code);
        var live = await h.Save(new() { Revision = 1, Mode = "production", Activate = true, ConfirmLive = true });
        Assert.Equal("production", live.EffectiveMode);
        var test = await h.Save(new() { Revision = 2, Mode = "sandbox" });
        Assert.Equal("sandbox", test.EffectiveMode);
        Assert.True(test.ProductionConfigured); Assert.True(test.SandboxConfigured);
        using var db = h.Db();
        var audit = await h.Service(db).AuditAsync();
        Assert.Contains(audit, x => x.Action == "mode_changed" && x.ToMode == "production" && x.ActorId == 42);
        Assert.DoesNotContain(LiveKeys().ClientSecret, JsonSerializer.Serialize(audit));
    }

    [Fact]
    public async Task Missing_invalid_or_unverified_credentials_cannot_activate()
    {
        using var h = new Harness();
        await Assert.ThrowsAsync<AppException>(() => h.Save(new() { Activate = true }));
        await Assert.ThrowsAsync<AppException>(() => h.Save(new() { Sandbox = new() { ClientId = "bad", ClientSecret = "bad" } }));
        h.Handler.RejectKeys = true;
        await Assert.ThrowsAsync<AppException>(() => h.Save(new() { Sandbox = TestKeys(), Activate = true }));
        using var db = h.Db(); Assert.Empty(await db.Settings.ToListAsync());
    }

    [Theory]
    [InlineData("sandbox", "sandbox.cashfree.com")]
    [InlineData("production", "api.cashfree.com")]
    public async Task Creation_status_refunds_and_checkout_mode_use_selected_environment(string mode, string host)
    {
        using var h = new Harness();
        await h.Save(new() { Sandbox = TestKeys(), Production = LiveKeys(), Activate = true, Mode = mode, ConfirmLive = true });
        using var db = h.Db(); var gateway = new ConfiguredCashfreeGateway(h.Service(db));
        await gateway.CreateOrderAsync(Order("BM-1"));
        Assert.Equal(mode, await gateway.EnvironmentAsync("BM-1"));
        await gateway.GetStatusAsync("BM-1");
        await gateway.RefundAsync("BM-1", 10, "refund-1", "test");
        var calls = h.Handler.Calls.Where(x => !x.Path.Contains("connection-test")).ToList();
        Assert.Equal(3, calls.Count); Assert.All(calls, x => Assert.Equal(host, x.Host));
        Assert.All(calls, x => Assert.Equal(mode == "sandbox" ? TestKeys().ClientId : LiveKeys().ClientId, x.ClientId));
    }

    [Theory]
    [InlineData("sandbox")]
    [InlineData("production")]
    public async Task Pending_payments_and_webhooks_keep_original_version_after_switch_and_replacement(string original)
    {
        using var h = new Harness();
        await h.Save(new() { Sandbox = TestKeys(), Production = LiveKeys(), Activate = true, Mode = original, ConfirmLive = true });
        using (var db = h.Db()) await new ConfiguredCashfreeGateway(h.Service(db)).CreateOrderAsync(Order("BM-pending"));
        var next = original == "sandbox" ? "production" : "sandbox";
        await h.Save(new() { Revision = 1, Mode = next, ConfirmLive = true, Sandbox = new() { ClientId = "TEST-new-client-123", ClientSecret = "TEST-new-secret-1234567890" }, Production = new() { ClientId = "LIVE-new-client-123", ClientSecret = "LIVE-new-secret-1234567890" } });
        using var context = h.Db(); var gateway = new ConfiguredCashfreeGateway(h.Service(context));
        Assert.Equal(original, await gateway.EnvironmentAsync("BM-pending"));
        await gateway.GetStatusAsync("BM-pending");
        await gateway.RefundAsync("BM-pending", 10, "refund", "test");
        var body = "{\"data\":{\"order\":{\"order_id\":\"BM-pending\"}}}";
        var secret = original == "sandbox" ? TestKeys().ClientSecret : LiveKeys().ClientSecret;
        Assert.True(await gateway.VerifyWebhookAsync(body, Sign(body, secret), "123"));
        Assert.False(await gateway.VerifyWebhookAsync(body, Sign(body, "wrong-secret"), "123"));
        Assert.False(await gateway.VerifyWebhookAsync(body + " ", Sign(body, secret), "123"));
        Assert.All(h.Handler.Calls.Where(x => x.Path.Contains("BM-pending")), x => Assert.Equal(original == "sandbox" ? TestKeys().ClientId : LiveKeys().ClientId, x.ClientId));
        // A retry of the same gateway order ID reuses its durable binding, even before a Payment row exists.
        await gateway.CreateOrderAsync(Order("BM-pending"));
        Assert.Equal(original, await gateway.EnvironmentAsync("BM-pending"));
        await gateway.CreateOrderAsync(Order("BM-new"));
        Assert.Equal(next, await gateway.EnvironmentAsync("BM-new"));
    }

    [Fact]
    public async Task Unbound_historical_payments_use_preserved_environment_even_when_server_env_changes()
    {
        using var h = new Harness();
        await h.Save(new() { Sandbox = TestKeys(), Activate = true });
        h.Legacy.Environment = "sandbox"; h.Legacy.ClientSecret = "changed-environment-secret";
        using var db = h.Db(); var gateway = new ConfiguredCashfreeGateway(h.Service(db));
        Assert.Equal("production", await gateway.EnvironmentAsync("historical-payment"));
        var body = "{\"data\":{\"order\":{\"order_id\":\"historical-payment\"}}}";
        Assert.True(await gateway.VerifyWebhookAsync(body, Sign(body, "original-live-secret-123456"), "123"));
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task Unauthorized_callers_cannot_read_write_or_read_audit(bool staff, bool permission)
    {
        using var h = new Harness(); h.User.Staff = staff; h.User.Permission = permission;
        using var db = h.Db(); var service = h.Service(db);
        await Assert.ThrowsAsync<ForbiddenException>(() => service.GetAsync());
        await Assert.ThrowsAsync<ForbiddenException>(() => service.SaveAsync(new()));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.AuditAsync());
        Assert.Empty(h.Handler.Calls);
    }

    [Fact]
    public async Task Stale_revision_is_rejected_and_encryption_failure_cannot_save()
    {
        using var h = new Harness();
        await h.Save(new() { Sandbox = TestKeys() });
        Assert.Equal(409, (await Assert.ThrowsAsync<AppException>(() => h.Save(new() { Production = LiveKeys() }))).StatusCode);
        h.Config["PaymentEncryption:Keys:k1"] = "";
        Assert.Equal(503, (await Assert.ThrowsAsync<AppException>(() => h.Save(new() { Revision = 1, Sandbox = TestKeys() }))).StatusCode);
    }

    [Fact]
    public void Ciphertext_is_bound_to_version_and_old_keys_can_be_retained_during_rotation()
    {
        using var h = new Harness(); var secrets = new PaymentSecrets(h.Config);
        var encrypted = secrets.Encrypt("secret", "version-1");
        Assert.Throws<AppException>(() => secrets.Decrypt(encrypted, "version-2"));
        h.Config["PaymentEncryption:ActiveKeyId"] = "k2";
        h.Config["PaymentEncryption:Keys:k2"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        Assert.Equal("secret", secrets.Decrypt(encrypted, "version-1"));
        Assert.StartsWith("k2.", secrets.Encrypt("new-secret", "version-2"));
    }

    [Fact]
    public async Task Provider_error_bodies_are_never_logged_or_returned_by_validation()
    {
        var handler = new FakeHandler { RejectKeys = true };
        var logger = new CaptureLogger();
        var gateway = new CashfreeGateway(new HttpClient(handler), Options.Create(new CashfreeOptions { ClientId = TestKeys().ClientId, ClientSecret = TestKeys().ClientSecret }), logger);
        var result = await gateway.TestConnectionAsync();
        await Assert.ThrowsAsync<AppException>(() => gateway.CreateOrderAsync(Order("BM-log")));
        await Assert.ThrowsAsync<AppException>(() => gateway.GetStatusAsync("BM-log"));
        await Assert.ThrowsAsync<AppException>(() => gateway.RefundAsync("BM-log", 1, "rf", "test"));
        Assert.DoesNotContain(TestKeys().ClientSecret, result.Message + string.Join(" ", logger.Messages));
    }

    private static GatewayOrderRequest Order(string id) => new(id, 10, "customer-1", "Test", "9999999999", null, "https://shop.example.test/return");
    private static string Sign(string body, string secret) => Convert.ToBase64String(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes("123" + body)));

    private sealed class SettingsModel(DbContextOptions options) : DbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder b) { b.Entity<AppSetting>().ToTable("settings").HasKey(x => x.Key); }
    }
    private sealed class Harness : IDisposable
    {
        private readonly SqliteConnection connection = new("Data Source=:memory:");
        private readonly DbContextOptions<AppDbContext> options;
        public IConfigurationRoot Config { get; } = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["PaymentEncryption:ActiveKeyId"] = "k1", ["PaymentEncryption:Keys:k1"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)) }).Build();
        public CashfreeOptions Legacy { get; } = new() { Environment = "production", ClientId = "original-live-id-123", ClientSecret = "original-live-secret-123456", WebReturnUrl = "https://shop.example.test/return", NotifyUrl = "https://api.example.test/webhook" };
        public FakeHandler Handler { get; } = new();
        public Caller User { get; } = new();
        public Harness()
        {
            connection.Open();
            using var model = new SettingsModel(new DbContextOptionsBuilder().UseSqlite(connection).Options);
            options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).UseModel(model.Model).Options;
            model.Database.EnsureCreated();
        }
        public AppDbContext Db() => new(options);
        public CashfreeSettingsService Service(AppDbContext db) => new(db, options, Options.Create(Legacy), new PaymentSecrets(Config), new Clients(Handler), NullLoggerFactory.Instance, User);
        public async Task<CashfreeSettingsStatus> Save(SaveCashfreeSettings req) { using var db = Db(); return await Service(db).SaveAsync(req); }
        public void Dispose() => connection.Dispose();
    }
    private sealed class Caller : ICurrentUser
    {
        public bool Staff = true, Permission = true;
        public long? Id => 42;
        public string? Name => "Administrator";
        public UserType? UserType => Staff ? BuildMate.Domain.Enums.UserType.Staff : BuildMate.Domain.Enums.UserType.Customer;
        public bool HasPermission(string permission) => Permission;
        public long RequireId() => 42;
    }
    private sealed class Clients(FakeHandler handler) : IHttpClientFactory { public HttpClient CreateClient(string name) => new(handler, false); }
    private sealed class FakeHandler : HttpMessageHandler
    {
        public bool RejectKeys;
        public List<(string Host, string Path, string ClientId)> Calls { get; } = new();
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            Calls.Add((req.RequestUri!.Host, req.RequestUri.AbsolutePath, req.Headers.GetValues("x-client-id").Single()));
            if (RejectKeys) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent(JsonSerializer.Serialize(new { message = TestKeys().ClientSecret })) });
            if (req.RequestUri.AbsolutePath.Contains("connection-test")) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound) { Content = new StringContent("{\"code\":\"order_not_found\"}") });
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"payment_session_id\":\"session-test\",\"cf_order_id\":\"123\",\"order_status\":\"ACTIVE\",\"order_amount\":10}") });
        }
    }
    private sealed class CaptureLogger : ILogger<CashfreeGateway>
    {
        public List<string> Messages { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
    }
}
