using BuildMate.Domain.Common;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Excel;
using BuildMate.Services.Files;
using BuildMate.Services.Inventory;
using BuildMate.Services.Orders;
using BuildMate.Services.Partners;
using BuildMate.Services.Reports;
using BuildMate.Services.ServiceRequests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Api.Controllers.Admin;

[Route("api/admin/racks")]
public class RacksController : AdminControllerBase
{
    private readonly IRackService _svc;
    public RacksController(IRackService svc) => _svc = svc;

    [HttpGet, Authorize(Policy = Permissions.StockView)]
    public Task<List<RackDto>> List(CancellationToken ct) => _svc.ListAsync(ct);

    [HttpGet("locations"), Authorize(Policy = Permissions.StockView)]
    public Task<List<RackLocationRef>> AllLocations(CancellationToken ct) => _svc.AllLocationsAsync(ct);

    [HttpGet("{id:long}/locations"), Authorize(Policy = Permissions.StockView)]
    public Task<List<RackLocationDto>> Locations(long id, CancellationToken ct) => _svc.LocationsAsync(id, ct);

    [HttpGet("find"), Authorize(Policy = Permissions.StockView)]
    public Task<List<RackLocationDto>> Find([FromQuery] string q, CancellationToken ct) => _svc.FindProductAsync(q, ct);

    [HttpPost, Authorize(Policy = Permissions.RacksManage)]
    public Task<RackDto> Create(RackUpsert dto, CancellationToken ct) => _svc.SaveAsync(null, dto, ct);

    [HttpPut("{id:long}"), Authorize(Policy = Permissions.RacksManage)]
    public Task<RackDto> Update(long id, RackUpsert dto, CancellationToken ct) => _svc.SaveAsync(id, dto, ct);
}

[Route("api/admin/purchases")]
public class PurchasesController : AdminControllerBase
{
    private readonly IPurchaseService _svc;
    private readonly IExcelService _excel;

    public PurchasesController(IPurchaseService svc, IExcelService excel)
    {
        _svc = svc;
        _excel = excel;
    }

    [HttpGet, Authorize(Policy = Permissions.PurchasesManage)]
    public Task<PagedResult<PurchaseListDto>> List([FromQuery] PurchaseQuery q, CancellationToken ct) => _svc.ListAsync(q, ct);

    [HttpGet("{id:long}"), Authorize(Policy = Permissions.PurchasesManage)]
    public Task<PurchaseDetailDto> Get(long id, CancellationToken ct) => _svc.GetAsync(id, ct);

    [HttpPost, Authorize(Policy = Permissions.PurchasesManage)]
    public Task<PurchaseDetailDto> Create(PurchaseCreate dto, CancellationToken ct) => _svc.CreateAsync(dto, ct);

    [HttpGet("template"), Authorize(Policy = Permissions.PurchasesManage)]
    public FileContentResult Template() => Xlsx(_excel.Template("purchases"), "purchase-template");

    /// <summary>Upload a purchase sheet. Header fields come as form fields; lines come from the Excel file.</summary>
    [HttpPost("upload"), Authorize(Policy = Permissions.PurchasesManage), RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<PurchaseDetailDto> Upload(IFormFile file, [FromForm] string? supplierName, [FromForm] string? supplierGstin,
        [FromForm] string? supplierInvoiceNo, [FromForm] DateOnly purchaseDate, [FromForm] string? notes, CancellationToken ct)
    {
        await using var s = file.OpenReadStream();
        var lines = _excel.ParsePurchaseLines(s);
        return await _svc.CreateAsync(new PurchaseCreate(supplierName, supplierGstin, supplierInvoiceNo, purchaseDate, notes, lines), ct);
    }
}

[Route("api/admin/stock")]
public class StockController : AdminControllerBase
{
    private readonly IStockService _stock;
    private readonly IReportService _reports;
    private readonly IExcelService _excel;

    public StockController(IStockService stock, IReportService reports, IExcelService excel)
    {
        _stock = stock;
        _reports = reports;
        _excel = excel;
    }

    [HttpGet, Authorize(Policy = Permissions.StockView)]
    public Task<List<StockRow>> Current([FromQuery] StockQuery q, CancellationToken ct) => _reports.StockAsync(q, ct);

    /// <summary>Fast / Slow / Non-moving summary cards (same filters as the list, apart from the movement filter).</summary>
    [HttpGet("movement-summary"), Authorize(Policy = Permissions.StockView)]
    public Task<MovementSummaryDto> MovementSummary([FromQuery] StockQuery q, CancellationToken ct) => _reports.MovementSummaryAsync(q, ct);

    /// <summary>Product-wise movement history: classification plus every successful dispatch of the product.</summary>
    [HttpGet("{productId:long}/movement"), Authorize(Policy = Permissions.StockView)]
    public Task<ProductMovementDto> MovementHistory(long productId, CancellationToken ct) => _reports.ProductMovementAsync(productId, ct);

    [HttpGet("export"), Authorize(Policy = Permissions.StockView)]
    public async Task<FileContentResult> Export([FromQuery] StockQuery q, CancellationToken ct)
    {
        var rows = await _reports.StockAsync(q, ct);
        var lowOnly = q.LowOnly;
        return Xlsx(_excel.Export(lowOnly ? "Low stock" : "Stock", rows,
            new ExcelColumn<StockRow>("Code", r => r.Code),
            new ExcelColumn<StockRow>("Product", r => r.Name),
            new ExcelColumn<StockRow>("Category", r => r.Category),
            new ExcelColumn<StockRow>("Brand", r => r.Brand),
            new ExcelColumn<StockRow>("Unit", r => r.Unit),
            new ExcelColumn<StockRow>("In stock", r => r.StockQty),
            new ExcelColumn<StockRow>("Reserved", r => r.ReservedQty),
            new ExcelColumn<StockRow>("Available", r => r.AvailableQty),
            new ExcelColumn<StockRow>("Reorder level", r => r.ReorderLevel),
            new ExcelColumn<StockRow>("Avg cost", r => r.AverageCost, "#,##0.00"),
            new ExcelColumn<StockRow>("Value", r => r.Value, "#,##0.00"),
            new ExcelColumn<StockRow>("Rack", r => string.Join(", ", r.Racks)),
            new ExcelColumn<StockRow>("Movement", r => MovementLabel(r.Movement, r.NeverDispatched)),
            // dates are written in IST by the Excel exporter
            new ExcelColumn<StockRow>("Last dispatch", r => r.LastDispatchedAt, "dd-mmm-yyyy hh:mm"),
            new ExcelColumn<StockRow>("Days since movement", r => r.DaysSinceMovement),
            new ExcelColumn<StockRow>("Aging from", r => r.MovementReferenceAt, "dd-mmm-yyyy")), lowOnly ? "low-stock" : "stock");
    }

    private static string MovementLabel(MovementCategory c, bool never) =>
        (c switch { MovementCategory.Fast => "Fast moving", MovementCategory.Slow => "Slow moving", _ => "Non-moving" }) + (never ? " (Never dispatched)" : "");

    [HttpGet("movements"), Authorize(Policy = Permissions.StockView)]
    public Task<PagedResult<StockMovementDto>> Movements([FromQuery] StockMovementQuery q, CancellationToken ct) => _stock.MovementsAsync(q, ct);

    [HttpGet("statement"), Authorize(Policy = Permissions.StockView)]
    public Task<List<StockStatementRow>> Statement([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] long? productId, CancellationToken ct) =>
        _reports.StockStatementAsync(new DateRange(from, to), productId, ct);

    [HttpPost("adjust"), Authorize(Policy = Permissions.StockAdjust)]
    public Task<StockMovementDto> Adjust(StockAdjustRequest req, CancellationToken ct) => _stock.AdjustAsync(req, ct);
}

/// <summary>Retail customers: KYC review, reward points and referrals (partners stay on /api/admin/partners).</summary>
[Route("api/admin/customers")]
public class CustomersController : AdminControllerBase
{
    private readonly IMemberService _members;
    public CustomersController(IMemberService members) => _members = members;

    [HttpGet, Authorize(Policy = Permissions.PartnersView)]
    public Task<PagedResult<CustomerKycListDto>> List([FromQuery] CustomerKycQuery q, CancellationToken ct) => _members.ListCustomersAsync(q, ct);

    [HttpGet("{userId:long}"), Authorize(Policy = Permissions.PartnersView)]
    public Task<CustomerKycDetailDto> Get(long userId, CancellationToken ct) => _members.GetCustomerAsync(userId, ct);

    [HttpPost("{userId:long}/kyc"), Authorize(Policy = Permissions.KycApprove)]
    public Task<CustomerKycDetailDto> Kyc(long userId, KycDecision d, CancellationToken ct) => _members.DecideCustomerKycAsync(userId, d, ct);

    [HttpGet("{userId:long}/kyc/documents/{docId:long}"), Authorize(Policy = Permissions.KycApprove)]
    public async Task<IActionResult> KycDocument(long userId, long docId, CancellationToken ct)
    {
        var (stream, type, _) = await _members.OpenCustomerDocumentAsync(userId, docId, ct);
        Response.Headers.CacheControl = "no-store";
        return File(stream, type);
    }

    [HttpPost("{userId:long}/rewards"), Authorize(Policy = Permissions.RewardsAdjust)]
    public Task<RewardTxnDto> AdjustRewards(long userId, RewardAdjust dto, CancellationToken ct) => _members.AdjustCustomerRewardsAsync(userId, dto, ct);

    [HttpGet("{userId:long}/rewards"), Authorize(Policy = Permissions.PartnersView)]
    public Task<PagedResult<RewardTxnDto>> Rewards(long userId, [FromQuery] int page = 1, CancellationToken ct = default) =>
        _members.RewardHistoryAsync(userId, new PageRequest(page, 30), ct);
}

[Route("api/admin/partners")]
public class PartnersController : AdminControllerBase
{
    private readonly IPartnerService _svc;
    private readonly IExcelService _excel;
    private readonly IFileStorage _files;
    private readonly BuildMate.Data.AppDbContext _db;

    public PartnersController(IPartnerService svc, IExcelService excel, IFileStorage files, BuildMate.Data.AppDbContext db)
    {
        _svc = svc;
        _excel = excel;
        _files = files;
        _db = db;
    }

    [HttpGet, Authorize(Policy = Permissions.PartnersView)]
    public Task<PagedResult<PartnerListDto>> List([FromQuery] PartnerQuery q, CancellationToken ct) => _svc.ListAsync(q, ct);

    [HttpGet("export"), Authorize(Policy = Permissions.PartnersView)]
    public async Task<FileContentResult> Export([FromQuery] PartnerQuery q, CancellationToken ct)
    {
        var all = new List<PartnerListDto>();
        for (var page = 1; ; page++)
        {
            var res = await _svc.ListAsync(q with { Page = page, PageSize = 200 }, ct);
            all.AddRange(res.Items);
            if (all.Count >= res.Total || res.Items.Count == 0) break;
        }
        return Xlsx(_excel.Export("Partners", all,
            new ExcelColumn<PartnerListDto>("Name", r => r.Name),
            new ExcelColumn<PartnerListDto>("Mobile", r => r.Phone),
            new ExcelColumn<PartnerListDto>("Business", r => r.BusinessName),
            new ExcelColumn<PartnerListDto>("Type", r => r.PartnerType),
            new ExcelColumn<PartnerListDto>("Area", r => r.Area),
            new ExcelColumn<PartnerListDto>("City", r => r.City),
            new ExcelColumn<PartnerListDto>("Pincode", r => r.Pincode),
            new ExcelColumn<PartnerListDto>("KYC", r => r.KycStatus),
            new ExcelColumn<PartnerListDto>("Manager", r => r.ManagerName),
            new ExcelColumn<PartnerListDto>("Orders", r => r.OrderCount),
            new ExcelColumn<PartnerListDto>("Total purchase", r => r.TotalPurchase, "#,##0.00"),
            new ExcelColumn<PartnerListDto>("Reward points", r => r.RewardBalance),
            new ExcelColumn<PartnerListDto>("Last order", r => r.LastOrderAt, "dd-mmm-yyyy"),
            new ExcelColumn<PartnerListDto>("Active", r => r.IsActive),
            new ExcelColumn<PartnerListDto>("Joined", r => r.CreatedAt, "dd-mmm-yyyy")), "partners");
    }

    [HttpGet("{userId:long}"), Authorize(Policy = Permissions.PartnersView)]
    public Task<PartnerDetailDto> Get(long userId, CancellationToken ct) => _svc.GetAsync(userId, ct);

    [HttpPost, Authorize(Policy = Permissions.PartnersManage)]
    public Task<PartnerDetailDto> Create(AdminPartnerCreate dto, CancellationToken ct) => _svc.CreateByAdminAsync(dto, ct);

    [HttpPut("{userId:long}"), Authorize(Policy = Permissions.PartnersManage)]
    public Task<PartnerDetailDto> Update(long userId, PartnerAdminUpdate dto, CancellationToken ct) =>
        _svc.UpdateByAdminAsync(userId, dto.Profile, dto.ManagerId, dto.IsActive, ct);

    [HttpPost("{userId:long}/kyc"), Authorize(Policy = Permissions.KycApprove)]
    public Task<PartnerDetailDto> Kyc(long userId, KycDecision d, CancellationToken ct) => _svc.DecideKycAsync(userId, d, ct);

    /// <summary>Streams a private KYC document to authorised staff only.</summary>
    [HttpGet("{userId:long}/kyc/documents/{docId:long}"), Authorize(Policy = Permissions.KycApprove)]
    public async Task<IActionResult> KycDocument(long userId, long docId, CancellationToken ct)
    {
        var doc = await _db.KycDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == docId && d.PartnerProfile != null && d.PartnerProfile.UserId == userId, ct)
                  ?? throw new NotFoundException("Document");
        var (stream, type) = await _files.OpenAsync(doc.FileKey, ct);
        Response.Headers.CacheControl = "no-store";
        return File(stream, type);
    }

    [HttpPost("{userId:long}/rewards"), Authorize(Policy = Permissions.RewardsAdjust)]
    public Task<RewardTxnDto> AdjustRewards(long userId, RewardAdjust dto, CancellationToken ct) => _svc.AdjustRewardsAsync(userId, dto, ct);

    [HttpGet("{userId:long}/rewards"), Authorize(Policy = Permissions.PartnersView)]
    public Task<PagedResult<RewardTxnDto>> Rewards(long userId, [FromQuery] int page = 1, CancellationToken ct = default) =>
        _svc.RewardHistoryAsync(userId, new PageRequest(page, 50), ct);

    public record PartnerAdminUpdate(PartnerProfileInput Profile, long? ManagerId, bool IsActive);
}

[Route("api/admin/quotations")]
public class QuotationsAdminController : AdminControllerBase
{
    private readonly IQuotationService _quotes;

    public QuotationsAdminController(IQuotationService quotes) => _quotes = quotes;

    [HttpGet, Authorize(Policy = Permissions.OrdersView)]
    public Task<PagedResult<QuotationSummaryDto>> List([FromQuery] QuotationQuery q, CancellationToken ct) => _quotes.ListAsync(q, ct);

    [HttpGet("{id:long}"), Authorize(Policy = Permissions.OrdersView)]
    public Task<QuotationDto> Get(long id, CancellationToken ct) => _quotes.GetAsync(id, ct);

    /// <summary>Sends (or revises) the price. Extra discounts need the special-discount permission.</summary>
    [HttpPost("{id:long}/price"), Authorize(Policy = Permissions.OrdersSpecialDiscount)]
    public Task<QuotationDto> Price(long id, QuotePriceInput input, CancellationToken ct) => _quotes.PriceAsync(id, input, ct);

    [HttpPost("{id:long}/cancel"), Authorize(Policy = Permissions.OrdersManage)]
    public Task<QuotationDto> Cancel(long id, QuoteCancel input, CancellationToken ct) => _quotes.CancelAsync(id, input, ct);
}

[Route("api/admin/orders")]
public class OrdersAdminController : AdminControllerBase
{
    private readonly IOrderService _orders;
    private readonly IOrderAdminService _admin;
    private readonly IExcelService _excel;

    public OrdersAdminController(IOrderService orders, IOrderAdminService admin, IExcelService excel)
    {
        _orders = orders;
        _admin = admin;
        _excel = excel;
    }

    [HttpGet, Authorize(Policy = Permissions.OrdersView)]
    public Task<PagedResult<OrderListDto>> List([FromQuery] OrderListQuery q, CancellationToken ct) => _orders.ListAsync(q, ct);

    [HttpGet("export"), Authorize(Policy = Permissions.OrdersView)]
    public async Task<FileContentResult> Export([FromQuery] OrderListQuery q, CancellationToken ct)
    {
        var all = new List<OrderListDto>();
        for (var page = 1; ; page++)
        {
            var res = await _orders.ListAsync(q with { Page = page, PageSize = 200 }, ct);
            all.AddRange(res.Items);
            if (all.Count >= res.Total || res.Items.Count == 0) break;
        }
        return Xlsx(_excel.Export("Orders", all,
            new ExcelColumn<OrderListDto>("Order No", r => r.OrderNo),
            new ExcelColumn<OrderListDto>("Date", r => r.CreatedAt, "dd-mmm-yyyy hh:mm"),
            new ExcelColumn<OrderListDto>("Channel", r => r.Channel),
            new ExcelColumn<OrderListDto>("Customer type", r => r.CustomerKind),
            new ExcelColumn<OrderListDto>("Customer", r => r.CustomerName),
            new ExcelColumn<OrderListDto>("Mobile", r => r.CustomerPhone),
            new ExcelColumn<OrderListDto>("Status", r => r.Status),
            new ExcelColumn<OrderListDto>("Payment", r => r.PaymentStatus),
            new ExcelColumn<OrderListDto>("Fulfilment", r => r.FulfilmentType),
            new ExcelColumn<OrderListDto>("Items", r => r.ItemCount),
            new ExcelColumn<OrderListDto>("Total", r => r.GrandTotal, "#,##0.00"),
            new ExcelColumn<OrderListDto>("Reward points", r => r.RewardPointsEarned),
            new ExcelColumn<OrderListDto>("Invoice", r => r.InvoiceNo)), "orders");
    }

    [HttpGet("{id:long}"), Authorize(Policy = Permissions.OrdersView)]
    public Task<OrderDetailDto> Get(long id, CancellationToken ct) => _orders.GetAsync(id, null, ct);

    [HttpGet("{id:long}/invoice"), Authorize(Policy = Permissions.OrdersView)]
    public Task<InvoiceDto> Invoice(long id, CancellationToken ct) => _orders.InvoiceAsync(id, null, ct);

    [HttpPost("{id:long}/schedule"), Authorize(Policy = Permissions.OrdersManage)]
    public Task<OrderDetailDto> Schedule(long id, OrderScheduleUpdate dto, CancellationToken ct) => _admin.ScheduleAsync(id, dto, ct);

    [HttpPost("{id:long}/status"), Authorize(Policy = Permissions.OrdersManage)]
    public Task<OrderDetailDto> Status(long id, OrderStatusUpdate dto, CancellationToken ct) => _admin.SetStatusAsync(id, dto, ct);

    /// <summary>Replace the order lines before dispatch (add, remove, change quantity, special discount).</summary>
    [HttpPut("{id:long}/items"), Authorize(Policy = Permissions.DispatchManage)]
    public Task<OrderDetailDto> EditItems(long id, OrderEditRequest dto, CancellationToken ct) => _admin.EditItemsAsync(id, dto, ct);

    [HttpPost("{id:long}/notes"), Authorize(Policy = Permissions.OrdersView)]
    public Task<OrderDetailDto> Note(long id, NoteBody body, CancellationToken ct) => _admin.AddNoteAsync(id, body.Note, ct);

    [HttpPost("{id:long}/cancel"), Authorize(Policy = Permissions.OrdersManage)]
    public Task<OrderDetailDto> Cancel(long id, CancelRequest dto, CancellationToken ct) => _admin.CancelAsync(id, dto, ct);

    [HttpPost("{id:long}/dispatch"), Authorize(Policy = Permissions.DispatchManage)]
    public Task<OrderDetailDto> Dispatch(long id, DispatchRequest dto, CancellationToken ct) => _admin.DispatchAsync(id, dto, ct);

    [HttpPost("{id:long}/delivered"), Authorize(Policy = Permissions.DispatchManage)]
    public Task<OrderDetailDto> Delivered(long id, CancellationToken ct) => _admin.MarkDeliveredAsync(id, ct);

    /// <summary>Walk-in billing at the counter: scan, take payment, hand over — one step.</summary>
    [HttpPost("counter-sale"), Authorize(Policy = Permissions.CounterBilling)]
    public Task<OrderDetailDto> CounterSale(CounterSaleRequest dto, CancellationToken ct) => _admin.CounterSaleAsync(dto, ct);

    public record NoteBody(string Note);
}

[Route("api/admin/service-requests")]
public class ServiceRequestsAdminController : AdminControllerBase
{
    private readonly IServiceRequestService _svc;
    public ServiceRequestsAdminController(IServiceRequestService svc) => _svc = svc;

    [HttpGet, Authorize(Policy = Permissions.ServiceRequestsManage)]
    public Task<PagedResult<ServiceRequestDto>> List([FromQuery] ServiceRequestQuery q, CancellationToken ct) => _svc.ListAsync(q, ct);

    [HttpGet("{id:long}"), Authorize(Policy = Permissions.ServiceRequestsManage)]
    public Task<ServiceRequestDto> Get(long id, CancellationToken ct) => _svc.GetAsync(id, ct);

    [HttpPut("{id:long}"), Authorize(Policy = Permissions.ServiceRequestsManage)]
    public Task<ServiceRequestDto> Update(long id, ServiceRequestUpdate dto, CancellationToken ct) => _svc.UpdateAsync(id, dto, ct);
}
