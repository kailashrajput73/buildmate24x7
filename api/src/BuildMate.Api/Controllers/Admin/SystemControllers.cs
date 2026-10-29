using BuildMate.Services.Orders;
using BuildMate.Data;
using BuildMate.Domain.Common;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Content;
using BuildMate.Services.Erp;
using BuildMate.Services.Excel;
using BuildMate.Services.Reports;
using BuildMate.Services.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Api.Controllers.Admin;

[Route("api/admin/dashboard")]
public class DashboardController : AdminControllerBase
{
    private readonly IReportService _reports;
    public DashboardController(IReportService reports) => _reports = reports;

    [HttpGet, Authorize(Policy = Permissions.DashboardView)]
    public Task<DashboardDto> Get(CancellationToken ct) => _reports.DashboardAsync(ct);
}

[Route("api/admin/reports")]
[Authorize(Policy = Permissions.ReportsView)]
public class ReportsController : AdminControllerBase
{
    private readonly IReportService _r;
    private readonly IExcelService _excel;

    public ReportsController(IReportService r, IExcelService excel)
    {
        _r = r;
        _excel = excel;
    }

    [HttpGet("sales")]
    public async Task<IActionResult> Sales([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] PeriodGrouping groupBy = PeriodGrouping.Month,
        [FromQuery] CustomerKind? kind = null, [FromQuery] SalesChannel? channel = null, [FromQuery] bool export = false, CancellationToken ct = default)
    {
        var rows = await _r.SalesAsync(new DateRange(from, to), groupBy, kind, channel, ct);
        if (!export) return Ok(rows);
        return Xlsx(_excel.Export("Sales", rows,
            new ExcelColumn<SalesPeriodDto>("Period", x => x.Period),
            new ExcelColumn<SalesPeriodDto>("Orders", x => x.Orders),
            new ExcelColumn<SalesPeriodDto>("Gross (list)", x => x.Gross, "#,##0.00"),
            new ExcelColumn<SalesPeriodDto>("Discount", x => x.Discount, "#,##0.00"),
            new ExcelColumn<SalesPeriodDto>("GST", x => x.Tax, "#,##0.00"),
            new ExcelColumn<SalesPeriodDto>("Net sales", x => x.Net, "#,##0.00"),
            new ExcelColumn<SalesPeriodDto>("Partner sales", x => x.PartnerSales, "#,##0.00"),
            new ExcelColumn<SalesPeriodDto>("Retail sales", x => x.RetailSales, "#,##0.00")), "sales-report");
    }

    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] long? categoryId, [FromQuery] long? brandId,
        [FromQuery] bool export = false, CancellationToken ct = default)
    {
        var rows = await _r.ProductsAsync(new DateRange(from, to), categoryId, brandId, ct);
        if (!export) return Ok(rows);
        return Xlsx(_excel.Export("Products", rows,
            new ExcelColumn<ProductPerformanceDto>("Code", x => x.Code),
            new ExcelColumn<ProductPerformanceDto>("Product", x => x.Name),
            new ExcelColumn<ProductPerformanceDto>("Category", x => x.Category),
            new ExcelColumn<ProductPerformanceDto>("Brand", x => x.Brand),
            new ExcelColumn<ProductPerformanceDto>("Qty sold", x => x.QuantitySold),
            new ExcelColumn<ProductPerformanceDto>("Revenue", x => x.Revenue, "#,##0.00"),
            new ExcelColumn<ProductPerformanceDto>("Orders", x => x.Orders),
            new ExcelColumn<ProductPerformanceDto>("Avg price", x => x.AveragePrice, "#,##0.00"),
            new ExcelColumn<ProductPerformanceDto>("Est. margin", x => x.Margin, "#,##0.00"),
            new ExcelColumn<ProductPerformanceDto>("Stock now", x => x.StockQty)), "product-performance");
    }

    [HttpGet("partners")]
    public async Task<IActionResult> Partners([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] long? managerId,
        [FromQuery] bool export = false, CancellationToken ct = default)
    {
        var rows = await _r.PartnersAsync(new DateRange(from, to), managerId, ct);
        if (!export) return Ok(rows);
        return Xlsx(_excel.Export("Partners", rows,
            new ExcelColumn<PartnerPerformanceDto>("Partner", x => x.Name),
            new ExcelColumn<PartnerPerformanceDto>("Mobile", x => x.Phone),
            new ExcelColumn<PartnerPerformanceDto>("City", x => x.City),
            new ExcelColumn<PartnerPerformanceDto>("Manager", x => x.Manager),
            new ExcelColumn<PartnerPerformanceDto>("Orders", x => x.Orders),
            new ExcelColumn<PartnerPerformanceDto>("Revenue", x => x.Revenue, "#,##0.00"),
            new ExcelColumn<PartnerPerformanceDto>("Avg order", x => x.AverageOrderValue, "#,##0.00"),
            new ExcelColumn<PartnerPerformanceDto>("Points earned", x => x.PointsEarned),
            new ExcelColumn<PartnerPerformanceDto>("Last order", x => x.LastOrderAt, "dd-mmm-yyyy")), "partner-performance");
    }

    [HttpGet("category-brand")]
    public async Task<object> CategoryBrand([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        var (cats, brands) = await _r.CategoryBrandAsync(new DateRange(from, to), ct);
        return new { categories = cats, brands };
    }

    [HttpGet("purchases")]
    public Task<List<PurchaseReportRow>> Purchases([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string groupBy = "supplier", CancellationToken ct = default) =>
        _r.PurchasesAsync(new DateRange(from, to), groupBy, ct);

    [HttpGet("dispatches")]
    public async Task<IActionResult> Dispatches([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] bool export = false, CancellationToken ct = default)
    {
        var rows = await _r.DispatchesAsync(new DateRange(from, to), ct);
        if (!export) return Ok(rows);
        return Xlsx(_excel.Export("Dispatches", rows,
            new ExcelColumn<DispatchReportRow>("Invoice", x => x.InvoiceNo),
            new ExcelColumn<DispatchReportRow>("Dispatch", x => x.DispatchNo),
            new ExcelColumn<DispatchReportRow>("Date", x => x.DispatchedAt, "dd-mmm-yyyy hh:mm"),
            new ExcelColumn<DispatchReportRow>("Order", x => x.OrderNo),
            new ExcelColumn<DispatchReportRow>("Customer", x => x.Customer),
            new ExcelColumn<DispatchReportRow>("Type", x => x.Kind),
            new ExcelColumn<DispatchReportRow>("Fulfilment", x => x.Fulfilment),
            new ExcelColumn<DispatchReportRow>("Amount", x => x.Amount, "#,##0.00"),
            new ExcelColumn<DispatchReportRow>("By", x => x.DispatchedBy)), "dispatch-report");
    }
}

[Route("api/admin/content")]
[Authorize(Policy = Permissions.ContentManage)]
public class ContentAdminController : AdminControllerBase
{
    private readonly IContentService _svc;
    public ContentAdminController(IContentService svc) => _svc = svc;

    [HttpGet("banners")]
    public Task<List<BannerDto>> Banners(CancellationToken ct) => _svc.BannersAsync(ct);

    [HttpPost("banners")]
    public Task<BannerDto> CreateBanner(BannerUpsert dto, CancellationToken ct) => _svc.SaveBannerAsync(null, dto, ct);

    [HttpPut("banners/{id:long}")]
    public Task<BannerDto> UpdateBanner(long id, BannerUpsert dto, CancellationToken ct) => _svc.SaveBannerAsync(id, dto, ct);

    [HttpDelete("banners/{id:long}")]
    public async Task<IActionResult> DeleteBanner(long id, CancellationToken ct)
    {
        await _svc.DeleteBannerAsync(id, ct);
        return NoContent();
    }

    [HttpGet("sections")]
    public Task<List<HomeSectionDto>> Sections(CancellationToken ct) => _svc.SectionsAsync(ct);

    [HttpPost("sections")]
    public Task<HomeSectionDto> CreateSection(HomeSectionUpsert dto, CancellationToken ct) => _svc.SaveSectionAsync(null, dto, ct);

    [HttpPut("sections/{id:long}")]
    public Task<HomeSectionDto> UpdateSection(long id, HomeSectionUpsert dto, CancellationToken ct) => _svc.SaveSectionAsync(id, dto, ct);

    [HttpDelete("sections/{id:long}")]
    public async Task<IActionResult> DeleteSection(long id, CancellationToken ct)
    {
        await _svc.DeleteSectionAsync(id, ct);
        return NoContent();
    }
}

[Route("api/admin/team")]
public class TeamController : AdminControllerBase
{
    private readonly IStaffService _svc;
    public TeamController(IStaffService svc) => _svc = svc;

    /// <summary>Minimal list of staff for "assign manager" dropdowns.</summary>
    [HttpGet("managers"), Authorize(Policy = Permissions.PartnersView)]
    public async Task<object> Managers(CancellationToken ct) =>
        (await _svc.ListAsync(null, ct)).Where(s => s.IsActive).Select(s => new { s.Id, s.Name });

    [HttpGet("users"), Authorize(Policy = Permissions.UsersManage)]
    public Task<List<StaffDto>> Users([FromQuery] string? search, CancellationToken ct) => _svc.ListAsync(search, ct);

    [HttpPost("users"), Authorize(Policy = Permissions.UsersManage)]
    public Task<StaffDto> CreateUser(StaffUpsert dto, CancellationToken ct) => _svc.SaveAsync(null, dto, ct);

    [HttpPut("users/{id:long}"), Authorize(Policy = Permissions.UsersManage)]
    public Task<StaffDto> UpdateUser(long id, StaffUpsert dto, CancellationToken ct) => _svc.SaveAsync(id, dto, ct);

    [HttpGet("roles"), Authorize(Policy = Permissions.UsersManage)]
    public Task<List<RoleDto>> Roles(CancellationToken ct) => _svc.RolesAsync(ct);

    [HttpGet("permissions"), Authorize(Policy = Permissions.UsersManage)]
    public IReadOnlyList<PermissionDto> AllPermissions() => _svc.Permissions();

    [HttpPost("roles"), Authorize(Policy = Permissions.UsersManage)]
    public Task<RoleDto> CreateRole(RoleUpsert dto, CancellationToken ct) => _svc.SaveRoleAsync(null, dto, ct);

    [HttpPut("roles/{id:long}"), Authorize(Policy = Permissions.UsersManage)]
    public Task<RoleDto> UpdateRole(long id, RoleUpsert dto, CancellationToken ct) => _svc.SaveRoleAsync(id, dto, ct);

    [HttpDelete("roles/{id:long}"), Authorize(Policy = Permissions.UsersManage)]
    public async Task<IActionResult> DeleteRole(long id, CancellationToken ct)
    {
        await _svc.DeleteRoleAsync(id, ct);
        return NoContent();
    }
}

[Route("api/admin/settings")]
public class SettingsController : AdminControllerBase
{
    private readonly ISettingsService _svc;
    private readonly IInvoiceNumbers _numbers;
    public SettingsController(ISettingsService svc, IInvoiceNumbers numbers)
    {
        _svc = svc;
        _numbers = numbers;
    }

    /// <summary>Current financial year's invoice series and the number the next dispatch will get.</summary>
    [HttpGet("invoice-numbering"), Authorize(Policy = Permissions.SettingsManage)]
    public Task<InvoiceNumberingDto> InvoiceNumbering(CancellationToken ct) => _numbers.PeekAsync(ct);

    public record SetNextInvoiceNumber(long NextNumber);

    [HttpPut("invoice-numbering"), Authorize(Policy = Permissions.SettingsManage)]
    public Task<InvoiceNumberingDto> SetInvoiceNumbering(SetNextInvoiceNumber body, CancellationToken ct) => _numbers.SetNextAsync(body.NextNumber, ct);

    [HttpGet, Authorize(Policy = Permissions.SettingsManage)]
    public Task<StoreSettings> Get(CancellationToken ct) => _svc.GetAsync(ct);

    [HttpPut, Authorize(Policy = Permissions.SettingsManage)]
    public Task<StoreSettings> Save(StoreSettings s, CancellationToken ct) => _svc.SaveAsync(s, ct);
}

/// <summary>ERP sync monitor: see what was sent, what failed, and retry.</summary>
[Route("api/admin/integrations")]
[Authorize(Policy = Permissions.SettingsManage)]
public class IntegrationsController : AdminControllerBase
{
    private readonly AppDbContext _db;
    private readonly IErpConnector _erp;

    public IntegrationsController(AppDbContext db, IErpConnector erp)
    {
        _db = db;
        _erp = erp;
    }

    [HttpGet("erp")]
    public async Task<object> Erp([FromQuery] OutboxStatus? status, [FromQuery] int page = 1, CancellationToken ct = default)
    {
        var q = _db.OutboxMessages.AsNoTracking();
        if (status != null) q = q.Where(m => m.Status == status);
        var p = new PageRequest(page, 50);
        var counts = await _db.OutboxMessages.GroupBy(m => m.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToListAsync(ct);
        var items = await q.OrderByDescending(m => m.Id).Page(p)
            .Select(m => new { m.Id, m.CreatedAt, m.EventType, m.Status, m.Attempts, m.LastError, m.ProcessedAt, m.Payload }).ToListAsync(ct);
        return new { connector = _erp.Name, counts, items, total = await q.CountAsync(ct) };
    }

    [HttpPost("erp/{id:long}/retry")]
    public async Task<IActionResult> Retry(long id, CancellationToken ct)
    {
        var m = await _db.OutboxMessages.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Message");
        m.Status = OutboxStatus.Pending;
        m.NextAttemptAt = DateTime.UtcNow;
        m.Attempts = 0;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
