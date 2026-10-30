using BuildMate.Api.Infrastructure;
using BuildMate.Services.Auth;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using BuildMate.Services.Notifications;
using BuildMate.Services.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace BuildMate.Api.Controllers.App;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly ICurrentUser _me;

    public AuthController(IAuthService auth, ICurrentUser me)
    {
        _auth = auth;
        _me = me;
    }

    /// <summary>Sends a login OTP. Audience = Partner (partner app) or Customer (storefront).</summary>
    [HttpPost("otp/request"), EnableRateLimiting("otp")]
    public async Task<IActionResult> RequestOtp(OtpRequest req, CancellationToken ct)
    {
        await _auth.RequestOtpAsync(req, ct);
        return Ok(new { message = "OTP sent." });
    }

    [HttpPost("otp/verify"), EnableRateLimiting("otp")]
    public Task<AuthResult> VerifyOtp(OtpVerifyRequest req, CancellationToken ct) => _auth.VerifyOtpAsync(req, ct);

    /// <summary>Website / app sign-in after Firebase phone OTP. Returns 409 "signup_required" for a new number without an audience.</summary>
    [HttpPost("firebase"), EnableRateLimiting("otp")]
    public Task<AuthResult> Firebase(FirebaseLoginRequest req, CancellationToken ct) => _auth.FirebaseLoginAsync(req, ct);

    /// <summary>
    /// Which phone-login methods this server accepts (no secrets): the Firebase project ids it trusts and whether the
    /// API's own SMS OTP really sends SMS. For set-up checks — see FIREBASE_SETUP.md.
    /// </summary>
    [HttpGet("config")]
    public object Config([FromServices] IOptions<FirebaseOptions> firebase, [FromServices] ISmsSender sms) => new
    {
        firebaseProjects = firebase.Value.ProjectIds,
        firebaseEnabled = firebase.Value.ProjectIds.Count > 0,
        smsOtpSendsSms = sms is not LogSmsSender,
    };

    [HttpPost("staff/login"), EnableRateLimiting("login")]
    public Task<AuthResult> StaffLogin(StaffLoginRequest req, CancellationToken ct) => _auth.StaffLoginAsync(req, ct);

    [HttpPost("refresh")]
    public Task<AuthResult> Refresh(RefreshRequest req, CancellationToken ct) => _auth.RefreshAsync(req.RefreshToken, ct);

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequest req, CancellationToken ct)
    {
        await _auth.LogoutAsync(req.RefreshToken, ct);
        return NoContent();
    }

    [Authorize, HttpGet("me")]
    public Task<AuthUserDto> Me(CancellationToken ct) => _auth.MeAsync(_me.RequireId(), ct);
}

/// <summary>Public catalogue for the storefront and partner app. Prices adapt to the logged-in user.</summary>
[ApiController]
[Route("api/catalog")]
[AllowAnonymous]
public class CatalogController : ControllerBase
{
    private readonly ICatalogService _catalog;
    private readonly IContentService _content;
    private readonly ICurrentUser _me;

    public CatalogController(ICatalogService catalog, IContentService content, ICurrentUser me)
    {
        _catalog = catalog;
        _content = content;
        _me = me;
    }

    private Viewer V => HttpContext.GetViewer(_me);

    [HttpGet("home")]
    public Task<HomeFeedDto> Home(CancellationToken ct) => _content.HomeFeedAsync(V, ct);

    [HttpGet("store")]
    public Task<StorePublicInfo> Store(CancellationToken ct) => _content.StoreInfoAsync(ct);

    [HttpGet("categories")]
    public Task<List<CategoryTreeDto>> Categories(CancellationToken ct) => _catalog.CategoriesAsync(V, ct);

    /// <summary>Every visible product of a category, one row per size, with specifications — for on-device grouping and filters.</summary>
    [HttpGet("categories/{id:long}/items")]
    public Task<List<CatalogItemDto>> CategoryItems(long id, [FromQuery] long? subCategoryId, CancellationToken ct) => _catalog.CategoryItemsAsync(id, subCategoryId, V, ct);

    [HttpGet("brands")]
    public Task<List<BrandRefDto>> Brands(CancellationToken ct) => _catalog.BrandsAsync(ct);

    [HttpGet("groups")]
    public Task<List<GroupRefDto>> Groups(CancellationToken ct) => _catalog.GroupsAsync(ct);

    [HttpGet("products")]
    public Task<PagedResult<ProductCardDto>> Products([FromQuery] CatalogQuery q, CancellationToken ct) => _catalog.SearchAsync(q, V, ct);

    [HttpGet("products/{id:long}")]
    public Task<ProductDetailDto> Product(long id, CancellationToken ct) => _catalog.GetAsync(id, V, ct);

    /// <summary>Looks up a product from a scanned QR code or barcode.</summary>
    [HttpGet("scan/{code}")]
    public Task<ProductDetailDto> Scan(string code, CancellationToken ct) => _catalog.GetByScanAsync(code, V, ct);

    /// <summary>Fresh prices for a guest cart kept in the browser.</summary>
    [HttpPost("products/batch")]
    public Task<List<ProductCardDto>> Batch([FromBody] List<long> ids, CancellationToken ct) => _catalog.GetCardsAsync(ids.Take(100), V, ct);
}

/// <summary>Address for the customer's current position (location bar). Looked up and cached by the server.</summary>
[ApiController]
[Route("api/geo")]
[AllowAnonymous]
public class GeoController : ControllerBase
{
    private readonly IGeocodingService _geo;
    public GeoController(IGeocodingService geo) => _geo = geo;

    [HttpGet("reverse"), EnableRateLimiting("geo")]
    public Task<GeocodedPlace> Reverse([FromQuery] double lat, [FromQuery] double lng, CancellationToken ct) => _geo.ReverseAsync(lat, lng, ct);
}

[ApiController]
[Route("api/payments")]
[AllowAnonymous]
public class PaymentsWebhookController : ControllerBase
{
    private readonly ICheckoutService _checkout;
    public PaymentsWebhookController(ICheckoutService checkout) => _checkout = checkout;

    /// <summary>Cashfree payment webhook (configure this URL in the Cashfree dashboard).</summary>
    [HttpPost("cashfree/webhook")]
    public async Task<IActionResult> Cashfree(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var raw = await reader.ReadToEndAsync(ct);
        await _checkout.HandleWebhookAsync(raw, Request.Headers["x-webhook-signature"], Request.Headers["x-webhook-timestamp"], ct);
        return Ok();
    }
}
