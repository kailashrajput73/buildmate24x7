using System.Net;
using System.Security.Cryptography;
using System.Text;
using BuildMate.Services.Common;
using BuildMate.Services.Payments;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace BuildMate.Tests;

/// <summary>Test Mode talks to Cashfree's sandbox with the Test keys; Live Mode to production with the Live keys.</summary>
public class CashfreeModeTests
{
    private sealed class Recorder : HttpMessageHandler
    {
        public readonly List<HttpRequestMessage> Requests = new();
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add(request);
            var body = request.Method == HttpMethod.Post
                ? "{\"order_id\":\"BM-1\",\"payment_session_id\":\"session_abc\",\"cf_order_id\":\"42\"}"
                : "{\"code\":\"order_not_found\",\"message\":\"order not found\"}";
            return Task.FromResult(new HttpResponseMessage(request.Method == HttpMethod.Post ? HttpStatusCode.OK : HttpStatusCode.NotFound)
            { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }

    private static CashfreeOptions Options(string env) => new()
    {
        Environment = env, ClientId = env == "production" ? "LIVEAPPID123" : "TESTAPPID123",
        ClientSecret = env == "production" ? "live-secret-0123456789" : "test-secret-0123456789",
        WebReturnUrl = "https://buildmate24x7.com/checkout/return?order={orderId}",
        NotifyUrl = "https://api.buildmate24x7.com/api/payments/cashfree/webhook",
    };

    private static (CashfreeGateway Gateway, Recorder Http) Gateway(string env)
    {
        var http = new Recorder();
        return (new CashfreeGateway(new HttpClient(http), Microsoft.Extensions.Options.Options.Create(Options(env)), NullLogger<CashfreeGateway>.Instance), http);
    }

    [Theory]
    [InlineData("sandbox", "https://sandbox.cashfree.com/pg/orders", "TESTAPPID123")]
    [InlineData("production", "https://api.cashfree.com/pg/orders", "LIVEAPPID123")]
    public async Task Orders_go_to_the_selected_environment_with_its_own_keys(string env, string url, string clientId)
    {
        var (gateway, http) = Gateway(env);
        var result = await gateway.CreateOrderAsync(new GatewayOrderRequest("BM-1", 500, "7", "Asha", "9811100001", null, null));
        Assert.Equal("session_abc", result.PaymentSessionId);
        var sent = http.Requests.Single();
        Assert.Equal(url, sent.RequestUri!.ToString());
        Assert.Equal(clientId, sent.Headers.GetValues("x-client-id").Single());
        Assert.Equal(env, await gateway.EnvironmentAsync("BM-1"));
    }

    [Theory]
    [InlineData("sandbox", "https://sandbox.cashfree.com/pg/orders/")]
    [InlineData("production", "https://api.cashfree.com/pg/orders/")]
    public async Task Key_check_uses_the_selected_environment(string env, string prefix)
    {
        var (gateway, http) = Gateway(env);
        var (ok, _) = await gateway.TestConnectionAsync();
        Assert.True(ok);
        Assert.StartsWith(prefix, http.Requests.Single().RequestUri!.ToString());
    }

    private static string Sign(string secret, string timestamp, string body)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(timestamp + body)));
    }

    [Fact]
    public async Task Webhooks_are_verified_with_the_secret_of_their_mode()
    {
        const string body = "{\"data\":{\"order\":{\"order_id\":\"BM-1\"}}}", ts = "1730000000";
        var (test, _) = Gateway("sandbox");
        var (live, _) = Gateway("production");
        Assert.True(await test.VerifyWebhookAsync(body, Sign("test-secret-0123456789", ts, body), ts));
        Assert.False(await test.VerifyWebhookAsync(body, Sign("live-secret-0123456789", ts, body), ts));
        Assert.True(await live.VerifyWebhookAsync(body, Sign("live-secret-0123456789", ts, body), ts));
        Assert.False(await live.VerifyWebhookAsync(body + " ", Sign("live-secret-0123456789", ts, body), ts)); // tampered body
        Assert.False(await live.VerifyWebhookAsync(body, null, ts));
    }

    private static PaymentSecrets Secrets() => new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["PaymentEncryption:ActiveKeyId"] = "k1",
        ["PaymentEncryption:Keys:k1"] = Convert.ToBase64String(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray()),
    }).Build());

    [Fact]
    public void Stored_credentials_are_encrypted_and_bound_to_their_version()
    {
        var secrets = Secrets();
        var stored = secrets.Encrypt("{\"ClientSecret\":\"live-secret-0123456789\"}", "v1");
        Assert.DoesNotContain("live-secret", stored);
        Assert.Contains("live-secret-0123456789", secrets.Decrypt(stored, "v1"));
        Assert.Throws<AppException>(() => secrets.Decrypt(stored, "v2")); // copied to another version: rejected
    }

    [Fact]
    public void Saving_without_an_encryption_key_is_refused()
    {
        var none = new PaymentSecrets(new ConfigurationBuilder().Build());
        var e = Assert.Throws<AppException>(() => none.Encrypt("x", "v1"));
        Assert.Equal(503, e.StatusCode);
    }

    [Theory]
    [InlineData("TESTAPPID123", "test-secret-0123456789", true)]
    [InlineData("short", "test-secret-0123456789", false)]
    [InlineData("TESTAPPID123", "with space secret 123", false)]
    public void Credential_format_is_checked(string id, string secret, bool ok)
    {
        var input = new CashfreeCredentialInput { ClientId = id, ClientSecret = secret };
        if (ok) CashfreeSettingsService.ValidateCredentials(input);
        else Assert.Throws<AppException>(() => CashfreeSettingsService.ValidateCredentials(input));
    }
}
