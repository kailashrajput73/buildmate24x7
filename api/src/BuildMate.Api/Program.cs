using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using BuildMate.Api.Infrastructure;
using BuildMate.Data;
using BuildMate.Domain.Common;
using BuildMate.Services;
using BuildMate.Services.Auth;
using BuildMate.Services.Common;
using BuildMate.Services.Files;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

// ---------------------------------------------------------------- Services
builder.Services.AddBuildMate(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddExceptionHandler<ProblemExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
});

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.SigningKey) || jwt.SigningKey.Length < 32)
    throw new InvalidOperationException("Jwt:SigningKey must be set to at least 32 characters (use user-secrets or an environment variable).");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = jwt.Issuer,
        ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1),
        NameClaimType = "name"
    };
});

builder.Services.AddAuthorization(o =>
{
    o.AddPolicy(Policies.Staff, p => p.RequireClaim(ClaimNames.UserType, ((int)BuildMate.Domain.Enums.UserType.Staff).ToString()));
    o.AddPolicy(Policies.Partner, p => p.RequireClaim(ClaimNames.UserType, ((int)BuildMate.Domain.Enums.UserType.Partner).ToString()));
    o.AddPolicy(Policies.Shopper, p => p.RequireClaim(ClaimNames.UserType,
        ((int)BuildMate.Domain.Enums.UserType.Partner).ToString(), ((int)BuildMate.Domain.Enums.UserType.Customer).ToString()));
    foreach (var perm in Permissions.AllKeys)
        o.AddPolicy(perm, p => p.RequireAssertion(ctx =>
            ctx.User.HasClaim(ClaimNames.Permission, Permissions.All) || ctx.User.HasClaim(ClaimNames.Permission, perm)));
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>())
    .AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = async (context, ct) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(System.Globalization.CultureInfo.InvariantCulture);
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            status = 429,
            title = "Too many requests. Please wait before trying again.",
            type = "rate_limited"
        }, cancellationToken: ct);
    };
    // OTP endpoints: 10 requests / minute per IP on top of per-phone limits in AuthService.
    o.AddPolicy("otp", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(5) }));
    // Address lookups (location bar): 30 / minute per IP; results are cached server-side.
    o.AddPolicy("geo", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "BuildMate 24x7 API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", In = ParameterLocation.Header
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() }
    });
    c.CustomSchemaIds(t => t.FullName?.Replace("+", "."));
});

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
});

var app = builder.Build();

// Payment set-up problems are logged at start-up so they show in the server log before the first failed checkout.
{
    var cf = app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<BuildMate.Services.Payments.CashfreeOptions>>().Value;
    foreach (var problem in cf.Problems()) app.Logger.LogWarning("Cashfree set-up: {Problem}", problem);
}

// ---------------------------------------------------------------- Database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (app.Configuration.GetValue("Database:AutoMigrate", true))
    {
        if (db.Database.GetMigrations().Any()) await db.Database.MigrateAsync();
        else await db.Database.EnsureCreatedAsync(); // first run before migrations are generated
    }
    await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync();
}

// ---------------------------------------------------------------- Pipeline
app.UseForwardedHeaders();
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment()) app.UseHsts();

if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Swagger:Enabled"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Public uploaded files (product images, banners) when using local storage.
var storage = app.Configuration.GetSection("Storage").Get<StorageOptions>() ?? new StorageOptions();
if (storage.Provider != "S3")
{
    var publicRoot = Path.Combine(Path.GetFullPath(storage.LocalRoot), "public");
    Directory.CreateDirectory(publicRoot);
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(publicRoot),
        RequestPath = "/files",
        OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = "public,max-age=604800"
    });
}

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", async (AppDbContext db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503));

app.Run();

public static class Policies
{
    public const string Staff = "staff";
    public const string Partner = "partner";
    /// <summary>Anyone who can shop: partners and retail customers.</summary>
    public const string Shopper = "shopper";
}

public partial class Program { }
