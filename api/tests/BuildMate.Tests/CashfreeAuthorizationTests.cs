using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using BuildMate.Api.Controllers.Admin;
using BuildMate.Domain.Common;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace BuildMate.Tests;

public sealed class CashfreeAuthorizationTests
{
    [Theory]
    [InlineData("GET", "", "", 401)]
    [InlineData("PUT", "", "", 401)]
    [InlineData("GET", "/audit", "", 401)]
    [InlineData("GET", "", "customer", 403)]
    [InlineData("PUT", "", "customer", 403)]
    [InlineData("GET", "/audit", "customer", 403)]
    [InlineData("GET", "", "staff-without-settings", 403)]
    [InlineData("PUT", "", "staff-without-settings", 403)]
    [InlineData("GET", "/audit", "staff-without-settings", 403)]
    public async Task Actual_controller_routes_reject_unauthorized_requests(string method, string suffix, string caller, int expected)
    {
        using var server = new TestServer(new WebHostBuilder().ConfigureServices(services =>
        {
            services.AddLogging();
            services.AddControllers().AddApplicationPart(typeof(CashfreeSettingsController).Assembly);
            services.AddAuthentication("test").AddScheme<AuthenticationSchemeOptions, CallerHandler>("test", _ => { });
            services.AddAuthorization(options =>
            {
                options.AddPolicy(Policies.Staff, p => p.RequireClaim("staff", "true"));
                options.AddPolicy(Permissions.SettingsManage, p => p.RequireClaim("permission", Permissions.SettingsManage));
            });
        }).Configure(app => { app.UseRouting(); app.UseAuthentication(); app.UseAuthorization(); app.UseEndpoints(e => e.MapControllers()); }));
        using var client = server.CreateClient();
        using var request = new HttpRequestMessage(new HttpMethod(method), "/api/admin/settings/cashfree" + suffix);
        if (caller != "") request.Headers.Add("Test-Caller", caller);
        if (method == "PUT") request.Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request);
        Assert.Equal((HttpStatusCode)expected, response.StatusCode);
    }
    private sealed class CallerHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var caller = Request.Headers["Test-Caller"].ToString();
            if (caller == "") return Task.FromResult(AuthenticateResult.NoResult());
            var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "42") };
            if (caller.StartsWith("staff")) claims.Add(new("staff", "true"));
            else claims.Add(new("permission", Permissions.SettingsManage)); // A non-staff account still must fail.
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(claims, "test")), "test")));
        }
    }
}
