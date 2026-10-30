using BuildMate.Api.Infrastructure;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Orders;
using BuildMate.Services.Partners;
using BuildMate.Services.ServiceRequests;
using BuildMate.Services.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildMate.Api.Controllers.App;

[ApiController]
[Route("api/cart")]
[Authorize(Policy = Policies.Shopper)]
public class CartController : ControllerBase
{
    private readonly ICartService _cart;
    private readonly ICurrentUser _me;

    public CartController(ICartService cart, ICurrentUser me)
    {
        _cart = cart;
        _me = me;
    }

    [HttpGet]
    public Task<CartDto> Get([FromQuery] FulfilmentType? fulfilment, CancellationToken ct) =>
        _cart.GetAsync(_me.RequireId(), HttpContext.GetViewer(_me), fulfilment, ct);

    /// <summary>Adds quantity to a line (creates it if needed).</summary>
    [HttpPost("items")]
    public Task<CartDto> Add(CartUpdate u, CancellationToken ct) => _cart.SetQuantityAsync(_me.RequireId(), u, HttpContext.GetViewer(_me), add: true, ct);

    /// <summary>Sets the exact quantity of a line; 0 removes it.</summary>
    [HttpPut("items")]
    public Task<CartDto> Set(CartUpdate u, CancellationToken ct) => _cart.SetQuantityAsync(_me.RequireId(), u, HttpContext.GetViewer(_me), add: false, ct);

    [HttpDelete("items/{productId:long}")]
    public Task<CartDto> Remove(long productId, CancellationToken ct) => _cart.RemoveAsync(_me.RequireId(), productId, HttpContext.GetViewer(_me), ct);

    [HttpPost("merge")]
    public Task<CartDto> Merge(List<CartUpdate> items, CancellationToken ct) => _cart.MergeAsync(_me.RequireId(), items, HttpContext.GetViewer(_me), ct);

    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        await _cart.ClearAsync(_me.RequireId(), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/orders")]
[Authorize(Policy = Policies.Shopper)]
public class MyOrdersController : ControllerBase
{
    private readonly IOrderService _orders;
    private readonly ICheckoutService _checkout;
    private readonly ICurrentUser _me;

    public MyOrdersController(IOrderService orders, ICheckoutService checkout, ICurrentUser me)
    {
        _orders = orders;
        _checkout = checkout;
        _me = me;
    }

    /// <summary>Creates an order from the cart and starts a Cashfree payment session.</summary>
    [HttpPost("checkout")]
    public Task<CheckoutResult> Checkout(CheckoutRequest req, CancellationToken ct) =>
        _checkout.CheckoutAsync(_me.RequireId(), req, HttpContext.GetViewer(_me), ct);

    [HttpPost("{id:long}/pay")]
    public Task<CheckoutResult> Pay(long id, [FromBody] RetryPayment? body, CancellationToken ct) =>
        _checkout.RetryPaymentAsync(_me.RequireId(), id, body?.ReturnUrl, ct);

    /// <summary>Call after returning from Cashfree. The server verifies the payment with Cashfree directly.</summary>
    [HttpPost("{id:long}/confirm-payment")]
    public Task<PaymentConfirmResult> Confirm(long id, CancellationToken ct) => _checkout.ConfirmAsync(_me.RequireId(), id, ct);

    [HttpGet]
    public Task<PagedResult<OrderListDto>> List([FromQuery] OrderStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        _orders.ListAsync(new OrderListQuery(null, status, null, null, _me.RequireId(), null, null, null, null, null, null, page, pageSize), ct);

    [HttpGet("{id:long}")]
    public Task<OrderDetailDto> Get(long id, CancellationToken ct) => _orders.GetAsync(id, _me.RequireId(), ct);

    [HttpGet("{id:long}/invoice")]
    public Task<InvoiceDto> Invoice(long id, CancellationToken ct) => _orders.InvoiceAsync(id, _me.RequireId(), ct);

    [HttpPost("{id:long}/cancel")]
    public Task<OrderDetailDto> Cancel(long id, CancellationToken ct) => _orders.CancelByCustomerAsync(id, _me.RequireId(), ct);

    public record RetryPayment(string? ReturnUrl);
}

/// <summary>Quotations: ask the store for its best price on the cart, then accept (and pay) or decline.</summary>
[ApiController]
[Route("api/quotations")]
[Authorize(Policy = Policies.Shopper)]
public class MyQuotationsController : ControllerBase
{
    private readonly IQuotationService _quotes;
    private readonly ICheckoutService _checkout;
    private readonly ICurrentUser _me;

    public MyQuotationsController(IQuotationService quotes, ICheckoutService checkout, ICurrentUser me)
    {
        _quotes = quotes;
        _checkout = checkout;
        _me = me;
    }

    /// <summary>Turns the cart into a quotation request (the cart is emptied).</summary>
    [HttpPost]
    public Task<QuotationDto> Request(QuoteRequest req, CancellationToken ct) => _quotes.RequestAsync(_me.RequireId(), req, HttpContext.GetViewer(_me), ct);

    [HttpGet]
    public Task<PagedResult<QuotationSummaryDto>> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        _quotes.ListMineAsync(_me.RequireId(), new PageRequest(page, pageSize), ct);

    [HttpGet("{id:long}")]
    public Task<QuotationDto> Get(long id, CancellationToken ct) => _quotes.GetMineAsync(_me.RequireId(), id, ct);

    /// <summary>Accepts the quoted price: creates the order and starts a Cashfree payment (same result as checkout).</summary>
    [HttpPost("{id:long}/accept")]
    public Task<CheckoutResult> Accept(long id, [FromBody] MyOrdersController.RetryPayment? body, CancellationToken ct) =>
        _checkout.AcceptQuotationAsync(_me.RequireId(), id, body?.ReturnUrl, ct);

    [HttpPost("{id:long}/decline")]
    public Task<QuotationDto> Decline(long id, CancellationToken ct) => _quotes.DeclineAsync(_me.RequireId(), id, ct);
}

[ApiController]
[Route("api/account")]
[Authorize(Policy = Policies.Shopper)]
public class AccountController : ControllerBase
{
    private readonly IAccountService _account;
    private readonly ICurrentUser _me;

    public AccountController(IAccountService account, ICurrentUser me)
    {
        _account = account;
        _me = me;
    }

    [HttpPut("profile")]
    public async Task<IActionResult> Profile(ProfileUpdate dto, CancellationToken ct)
    {
        await _account.UpdateProfileAsync(_me.RequireId(), dto, ct);
        return NoContent();
    }

    [HttpGet("addresses")]
    public Task<List<AddressDto>> Addresses(CancellationToken ct) => _account.AddressesAsync(_me.RequireId(), ct);

    [HttpPost("addresses")]
    public Task<AddressDto> AddAddress(AddressUpsert dto, CancellationToken ct) => _account.SaveAddressAsync(_me.RequireId(), null, dto, ct);

    [HttpPut("addresses/{id:long}")]
    public Task<AddressDto> UpdateAddress(long id, AddressUpsert dto, CancellationToken ct) => _account.SaveAddressAsync(_me.RequireId(), id, dto, ct);

    [HttpDelete("addresses/{id:long}")]
    public async Task<IActionResult> DeleteAddress(long id, CancellationToken ct)
    {
        await _account.DeleteAddressAsync(_me.RequireId(), id, ct);
        return NoContent();
    }

    [HttpGet("notifications")]
    public Task<PagedResult<NotificationDto>> Notifications([FromQuery] int page = 1, CancellationToken ct = default) =>
        _account.NotificationsAsync(_me.RequireId(), new PageRequest(page, 30), ct);

    [HttpGet("notifications/unread-count")]
    public async Task<object> Unread(CancellationToken ct) => new { count = await _account.UnreadCountAsync(_me.RequireId(), ct) };

    [HttpPost("notifications/read")]
    public async Task<IActionResult> MarkRead([FromQuery] long? id, CancellationToken ct)
    {
        await _account.MarkReadAsync(_me.RequireId(), id, ct);
        return NoContent();
    }

    [HttpPost("devices")]
    public async Task<IActionResult> RegisterDevice(DeviceRegistration dto, CancellationToken ct)
    {
        await _account.RegisterDeviceAsync(_me.RequireId(), dto, ct);
        return NoContent();
    }

    [HttpDelete("devices/{token}")]
    public async Task<IActionResult> UnregisterDevice(string token, CancellationToken ct)
    {
        await _account.UnregisterDeviceAsync(_me.RequireId(), token, ct);
        return NoContent();
    }

    /// <summary>Permanently anonymises the account (Play Store / App Store requirement).</summary>
    [HttpDelete]
    public async Task<IActionResult> Delete(CancellationToken ct)
    {
        await _account.DeleteAccountAsync(_me.RequireId(), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/service-requests")]
[Authorize(Policy = Policies.Shopper)]
public class MyServiceRequestsController : ControllerBase
{
    private readonly IServiceRequestService _svc;
    private readonly ICurrentUser _me;

    public MyServiceRequestsController(IServiceRequestService svc, ICurrentUser me)
    {
        _svc = svc;
        _me = me;
    }

    [HttpPost]
    public Task<ServiceRequestDto> Create(ServiceRequestCreate dto, CancellationToken ct) => _svc.CreateAsync(_me.RequireId(), dto, ct);

    [HttpGet]
    public Task<List<ServiceRequestDto>> Mine(CancellationToken ct) => _svc.MineAsync(_me.RequireId(), ct);

    [HttpPost("{id:long}/cancel")]
    public Task<ServiceRequestDto> Cancel(long id, CancellationToken ct) => _svc.CancelMineAsync(_me.RequireId(), id, ct);
}

/// <summary>KYC, reward points and Refer &amp; Earn for every signed-in shopper (customers and partners).</summary>
[ApiController]
[Route("api/account")]
[Authorize(Policy = Policies.Shopper)]
public class MemberController : ControllerBase
{
    private readonly IMemberService _members;
    private readonly ICurrentUser _me;

    public MemberController(IMemberService members, ICurrentUser me)
    {
        _members = members;
        _me = me;
    }

    [HttpGet("kyc")]
    public Task<MyKycDto> Kyc(CancellationToken ct) => _members.GetKycAsync(_me.RequireId(), ct);

    [HttpPost("kyc/documents"), RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<KycDocumentDto> UploadKyc([FromForm] KycDocumentType type, [FromForm] string? number, IFormFile file, CancellationToken ct)
    {
        await using var s = file.OpenReadStream();
        return await _members.UploadKycAsync(_me.RequireId(), type, number, s, file.FileName, file.Length, ct);
    }

    public record KycSubmit(string? Gstin);

    [HttpPost("kyc/submit")]
    public Task<MyKycDto> SubmitKyc(KycSubmit? body, CancellationToken ct) => _members.SubmitKycAsync(_me.RequireId(), body?.Gstin, ct);

    [HttpGet("rewards")]
    public Task<RewardSummaryDto> Rewards(CancellationToken ct) => _members.RewardsAsync(_me.RequireId(), ct);

    [HttpGet("rewards/history")]
    public Task<PagedResult<RewardTxnDto>> RewardHistory([FromQuery] int page = 1, CancellationToken ct = default) =>
        _members.RewardHistoryAsync(_me.RequireId(), new PageRequest(page, 30), ct);

    [HttpGet("referral")]
    public Task<ReferralDto> Referral(CancellationToken ct) => _members.GetReferralAsync(_me.RequireId(), ct);
}

/// <summary>Account wishlist (product ids), shared by the website and the app.</summary>
[ApiController]
[Route("api/account/wishlist")]
[Authorize(Policy = Policies.Shopper)]
public class WishlistController : ControllerBase
{
    private readonly IWishlistService _wishlist;
    private readonly ICurrentUser _me;

    public WishlistController(IWishlistService wishlist, ICurrentUser me)
    {
        _wishlist = wishlist;
        _me = me;
    }

    [HttpGet]
    public Task<List<long>> Get(CancellationToken ct) => _wishlist.IdsAsync(_me.RequireId(), ct);

    [HttpPost("{productId:long}")]
    public Task<List<long>> Add(long productId, CancellationToken ct) => _wishlist.AddAsync(_me.RequireId(), productId, ct);

    [HttpDelete("{productId:long}")]
    public Task<List<long>> Remove(long productId, CancellationToken ct) => _wishlist.RemoveAsync(_me.RequireId(), productId, ct);

    /// <summary>Adds what the user saved in the browser before logging in.</summary>
    [HttpPost("merge")]
    public Task<List<long>> Merge([FromBody] List<long> productIds, CancellationToken ct) => _wishlist.MergeAsync(_me.RequireId(), productIds ?? new(), ct);
}

/// <summary>Referral-partner self service: registration profile, KYC, rewards.</summary>
[ApiController]
[Route("api/partner")]
[Authorize(Policy = Policies.Partner)]
public class PartnerSelfController : ControllerBase
{
    private readonly IPartnerService _partners;
    private readonly ICurrentUser _me;

    public PartnerSelfController(IPartnerService partners, ICurrentUser me)
    {
        _partners = partners;
        _me = me;
    }

    [HttpGet("profile")]
    public Task<PartnerDetailDto> Profile(CancellationToken ct) => _partners.GetAsync(_me.RequireId(), ct);

    [HttpPut("profile")]
    public Task<PartnerDetailDto> UpdateProfile(PartnerProfileInput dto, CancellationToken ct) => _partners.SubmitProfileAsync(_me.RequireId(), dto, ct);

    [HttpPost("kyc/documents"), RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<KycDocumentDto> UploadKyc([FromForm] KycDocumentType type, [FromForm] string? number, IFormFile file, CancellationToken ct)
    {
        await using var s = file.OpenReadStream();
        return await _partners.AddKycDocumentAsync(_me.RequireId(), type, number, s, file.FileName, file.Length, ct);
    }

    [HttpPost("kyc/submit")]
    public Task<PartnerDetailDto> SubmitKyc(CancellationToken ct) => _partners.SubmitKycAsync(_me.RequireId(), ct);

    [HttpGet("rewards")]
    public Task<RewardSummaryDto> Rewards(CancellationToken ct) => _partners.RewardSummaryAsync(_me.RequireId(), ct);

    [HttpGet("rewards/history")]
    public Task<PagedResult<RewardTxnDto>> RewardHistory([FromQuery] int page = 1, CancellationToken ct = default) =>
        _partners.RewardHistoryAsync(_me.RequireId(), new PageRequest(page, 30), ct);
}
