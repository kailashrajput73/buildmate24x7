using BuildMate.Data;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Inventory;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Reports;

public record DateRange(DateOnly? From, DateOnly? To)
{
    public DateOnly FromOrDefault => From ?? DateOnly.FromDateTime(Clock.TodayIst.AddDays(-29));
    public DateOnly ToOrDefault => To ?? DateOnly.FromDateTime(Clock.TodayIst);
    public DateTime FromUtc => Clock.IstDateStartUtc(FromOrDefault.ToDateTime(TimeOnly.MinValue));
    public DateTime ToUtcExclusive => Clock.IstDateStartUtc(ToOrDefault.ToDateTime(TimeOnly.MinValue).AddDays(1));
}

public record KpiDto(decimal SalesToday, int OrdersToday, decimal SalesThisMonth, int OrdersThisMonth, decimal SalesLastMonth,
    int AwaitingDispatch, int AwaitingPayment, int PendingKyc, int LowStockCount, int ActivePartners, int OpenServiceRequests,
    decimal InventoryValue, decimal AverageOrderValue);

public record TrendPointDto(string Label, DateOnly Date, decimal App, decimal Web, decimal Store, int Orders);
public record NamedValueDto(long Id, string Name, decimal Quantity, decimal Amount, int Orders);
public record DashboardOverviewDto(int Products, int Categories, int Brands, int Customers, int Partners, int Orders, int Quotations);
public record DashboardDto(KpiDto Kpis, List<TrendPointDto> Trend, List<NamedValueDto> TopProducts, List<NamedValueDto> TopPartners,
    List<NamedValueDto> ByCategory, List<NamedValueDto> ByChannel)
{
    public DashboardOverviewDto? Overview { get; init; }
}

public enum PeriodGrouping { Day, Week, Month, Quarter, Year }

public record SalesPeriodDto(string Period, int Orders, decimal Gross, decimal Discount, decimal Tax, decimal Net, decimal PartnerSales, decimal RetailSales);
public record ProductPerformanceDto(long ProductId, string Code, string Name, string Category, string Brand, decimal QuantitySold, decimal Revenue,
    int Orders, decimal AveragePrice, decimal StockQty, decimal Margin);
public record PartnerPerformanceDto(long UserId, string Name, string? Phone, string? City, string? Manager, int Orders, decimal Revenue,
    decimal AverageOrderValue, decimal PointsEarned, DateTime? LastOrderAt);
public record PurchaseReportRow(string Group, int Purchases, decimal Quantity, decimal Amount);
public record DispatchReportRow(string InvoiceNo, string DispatchNo, DateTime DispatchedAt, string OrderNo, string Customer,
    CustomerKind Kind, FulfilmentType Fulfilment, decimal Amount, string? DispatchedBy);
public record StockRow(long ProductId, string Code, string Name, string Category, string Brand, string Unit, decimal StockQty,
    decimal ReservedQty, decimal AvailableQty, decimal ReorderLevel, decimal AverageCost, decimal Value, decimal ListPrice, List<string> Racks,
    // Movement classification (Inventory.ProductMovement), as of today in India time.
    MovementCategory Movement, int DaysSinceMovement, bool NeverDispatched, DateTime? LastDispatchedAt, DateTime MovementReferenceAt);

/// <summary>Filters for the stock list, its Excel export and the movement summary cards. Existing query names are unchanged.</summary>
public record StockQuery(bool LowOnly = false, long? CategoryId = null, long? BrandId = null, string? Search = null,
    MovementCategory? Movement = null, bool? NeverDispatched = null);

public record MovementBucketDto(int Products, int NeverDispatched, decimal StockQty, decimal StockValue);
/// <summary>Summary cards. Counts respect the stock filters except the movement filter itself.</summary>
public record MovementSummaryDto(DateOnly AsOf, int FastMaxDays, int SlowMaxDays, MovementBucketDto Fast, MovementBucketDto Slow, MovementBucketDto NonMoving);

public record ProductDispatchRow(DateTime DispatchedAt, string InvoiceNo, string DispatchNo, long OrderId, string OrderNo, string Customer,
    SalesChannel Channel, decimal Quantity);
/// <summary>Product-wise movement history: the classification plus every successful dispatch that included the product.</summary>
public record ProductMovementDto(long ProductId, string Code, string Name, string Unit, decimal StockQty,
    MovementCategory Movement, int DaysSinceMovement, bool NeverDispatched, DateTime? LastDispatchedAt, DateTime MovementReferenceAt,
    DateTime? FirstReceiptAt, DateTime CreatedAt, int DispatchCount, decimal QtyLast30Days, decimal QtyLast120Days, List<ProductDispatchRow> Dispatches);
public record StockStatementRow(long ProductId, string Code, string Name, decimal Opening, decimal In, decimal Out, decimal Closing);

public interface IReportService
{
    Task<DashboardDto> DashboardAsync(CancellationToken ct = default);
    Task<List<SalesPeriodDto>> SalesAsync(DateRange r, PeriodGrouping g, CustomerKind? kind, SalesChannel? channel, CancellationToken ct = default);
    Task<List<ProductPerformanceDto>> ProductsAsync(DateRange r, long? categoryId, long? brandId, CancellationToken ct = default);
    Task<List<PartnerPerformanceDto>> PartnersAsync(DateRange r, long? managerId, CancellationToken ct = default);
    Task<(List<NamedValueDto> Categories, List<NamedValueDto> Brands)> CategoryBrandAsync(DateRange r, CancellationToken ct = default);
    Task<List<PurchaseReportRow>> PurchasesAsync(DateRange r, string groupBy, CancellationToken ct = default);
    Task<List<DispatchReportRow>> DispatchesAsync(DateRange r, CancellationToken ct = default);
    Task<List<StockRow>> StockAsync(StockQuery q, CancellationToken ct = default);
    Task<MovementSummaryDto> MovementSummaryAsync(StockQuery q, CancellationToken ct = default);
    Task<ProductMovementDto> ProductMovementAsync(long productId, CancellationToken ct = default);
    Task<List<StockStatementRow>> StockStatementAsync(DateRange r, long? productId, CancellationToken ct = default);
}

public class ReportService : IReportService
{
    private static readonly OrderStatus[] Sold = { OrderStatus.Paid, OrderStatus.Processing, OrderStatus.ReadyForPickup, OrderStatus.OutForDelivery, OrderStatus.Completed };
    private const int IstOffsetMinutes = 330;
    private readonly AppDbContext _db;
    public ReportService(AppDbContext db) => _db = db;

    private IQueryable<Domain.Entities.Order> SoldOrders(DateTime from, DateTime to) =>
        _db.Orders.AsNoTracking().Where(o => Sold.Contains(o.Status) && o.PaidAt >= from && o.PaidAt < to);

    public async Task<DashboardDto> DashboardAsync(CancellationToken ct = default)
    {
        var today = Clock.TodayIst;
        var todayUtc = Clock.IstDateStartUtc(today);
        var monthUtc = Clock.IstDateStartUtc(new DateTime(today.Year, today.Month, 1));
        var lastMonthUtc = Clock.IstDateStartUtc(new DateTime(today.Year, today.Month, 1).AddMonths(-1));
        var now = DateTime.UtcNow.AddMinutes(1);

        var todayQ = SoldOrders(todayUtc, now);
        var monthQ = SoldOrders(monthUtc, now);
        var monthCount = await monthQ.CountAsync(ct);
        var monthSales = await monthQ.SumAsync(o => (decimal?)o.GrandTotal, ct) ?? 0;

        var kpis = new KpiDto(
            await todayQ.SumAsync(o => (decimal?)o.GrandTotal, ct) ?? 0,
            await todayQ.CountAsync(ct),
            monthSales, monthCount,
            await SoldOrders(lastMonthUtc, monthUtc).SumAsync(o => (decimal?)o.GrandTotal, ct) ?? 0,
            await _db.Orders.CountAsync(o => o.Dispatch == null && (o.Status == OrderStatus.Paid || o.Status == OrderStatus.Processing || o.Status == OrderStatus.ReadyForPickup), ct),
            await _db.Orders.CountAsync(o => o.Status == OrderStatus.PendingPayment && o.CreatedAt > DateTime.UtcNow.AddDays(-2), ct),
            await _db.PartnerProfiles.CountAsync(p => p.KycStatus == KycStatus.Pending, ct),
            await _db.Products.CountAsync(p => p.IsActive && p.StockQty <= p.ReorderLevel, ct),
            await _db.PartnerProfiles.CountAsync(p => p.KycStatus == KycStatus.Approved && p.User.IsActive, ct),
            await _db.ServiceRequests.CountAsync(s => s.Status == ServiceRequestStatus.Pending || s.Status == ServiceRequestStatus.InProgress, ct),
            await _db.Products.Where(p => p.StockQty > 0).SumAsync(p => (decimal?)(p.StockQty * p.AverageCost), ct) ?? 0,
            monthCount == 0 ? 0 : Pricing.Round(monthSales / monthCount));

        var range = new DateRange(DateOnly.FromDateTime(today.AddDays(-29)), DateOnly.FromDateTime(today));
        var daily = await DailyAsync(range, null, null, ct);
        var trend = Enumerable.Range(0, 30).Select(i => DateOnly.FromDateTime(today.AddDays(-29 + i))).Select(d =>
        {
            var rows = daily.Where(x => x.Day == d).ToList();
            return new TrendPointDto(d.ToString("dd MMM"), d,
                rows.Where(x => x.Channel == SalesChannel.App).Sum(x => x.Net),
                rows.Where(x => x.Channel == SalesChannel.Web).Sum(x => x.Net),
                rows.Where(x => x.Channel == SalesChannel.Store).Sum(x => x.Net),
                rows.Sum(x => x.Orders));
        }).ToList();

        var items = _db.OrderItems.AsNoTracking().Where(i => Sold.Contains(i.Order.Status) && i.Order.PaidAt >= range.FromUtc && i.Order.PaidAt < range.ToUtcExclusive);
        var topProducts = await items.GroupBy(i => new { i.ProductId, i.ProductName })
            .OrderByDescending(g => g.Sum(x => x.LineTotal)).Take(8)
            .Select(g => new NamedValueDto(g.Key.ProductId, g.Key.ProductName, g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal), g.Select(i => i.OrderId).Distinct().Count())).ToListAsync(ct);
        var byCategory = await items.GroupBy(i => new { i.Product.CategoryId, i.Product.Category.Name })
            .OrderByDescending(g => g.Sum(x => x.LineTotal)).Take(8)
            .Select(g => new NamedValueDto(g.Key.CategoryId, g.Key.Name, g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal), g.Select(i => i.OrderId).Distinct().Count())).ToListAsync(ct);

        var orders = SoldOrders(range.FromUtc, range.ToUtcExclusive);
        var topPartners = await orders.Where(o => o.CustomerKind == CustomerKind.Partner && o.UserId != null)
            .GroupBy(o => new { o.UserId, o.CustomerName })
            .OrderByDescending(g => g.Sum(x => x.GrandTotal)).Take(8)
            .Select(g => new NamedValueDto(g.Key.UserId!.Value, g.Key.CustomerName, 0, g.Sum(o => o.GrandTotal), g.Count())).ToListAsync(ct);
        var byChannel = (await orders.GroupBy(o => o.Channel)
            .Select(g => new { g.Key, Amount = g.Sum(o => o.GrandTotal), Count = g.Count() }).ToListAsync(ct))
            .Select(x => new NamedValueDto((long)x.Key, x.Key.ToString(), 0, x.Amount, x.Count)).ToList();

        var overview = new DashboardOverviewDto(
            await _db.Products.CountAsync(ct), await _db.Categories.CountAsync(ct), await _db.Brands.CountAsync(ct),
            await _db.Users.CountAsync(u => u.UserType == UserType.Customer, ct),
            await _db.Users.CountAsync(u => u.UserType == UserType.Partner, ct),
            await _db.Orders.CountAsync(ct), await _db.Quotations.CountAsync(ct));
        return new DashboardDto(kpis, trend, topProducts, topPartners, byCategory, byChannel) { Overview = overview };
    }

    private record DailyRow(DateOnly Day, SalesChannel Channel, CustomerKind Kind, int Orders, decimal Gross, decimal Discount, decimal Tax, decimal Net);

    private async Task<List<DailyRow>> DailyAsync(DateRange r, CustomerKind? kind, SalesChannel? channel, CancellationToken ct)
    {
        var q = SoldOrders(r.FromUtc, r.ToUtcExclusive);
        if (kind != null) q = q.Where(o => o.CustomerKind == kind);
        if (channel != null) q = q.Where(o => o.Channel == channel);
        var rows = await q.GroupBy(o => new { Day = o.PaidAt!.Value.AddMinutes(IstOffsetMinutes).Date, o.Channel, o.CustomerKind })
            .Select(g => new
            {
                g.Key.Day, g.Key.Channel, g.Key.CustomerKind, Orders = g.Count(),
                Gross = g.Sum(o => o.SubTotal), Discount = g.Sum(o => o.DiscountTotal), Tax = g.Sum(o => o.TaxTotal), Net = g.Sum(o => o.GrandTotal)
            }).ToListAsync(ct);
        return rows.Select(x => new DailyRow(DateOnly.FromDateTime(x.Day), x.Channel, x.CustomerKind, x.Orders, x.Gross, x.Discount, x.Tax, x.Net)).ToList();
    }

    public async Task<List<SalesPeriodDto>> SalesAsync(DateRange r, PeriodGrouping g, CustomerKind? kind, SalesChannel? channel, CancellationToken ct = default)
    {
        var daily = await DailyAsync(r, kind, channel, ct);
        string Key(DateOnly d) => g switch
        {
            PeriodGrouping.Day => d.ToString("yyyy-MM-dd"),
            PeriodGrouping.Week => $"{d.AddDays(-(((int)d.DayOfWeek + 6) % 7)):yyyy-MM-dd} (week)",
            PeriodGrouping.Month => d.ToString("MMM yyyy"),
            PeriodGrouping.Quarter => FiscalQuarter(d),
            _ => $"FY {Clock.FinancialYear(d.ToDateTime(TimeOnly.MinValue)).Insert(2, "-")}"
        };
        return daily.GroupBy(x => Key(x.Day)).Select(grp => new SalesPeriodDto(grp.Key, grp.Sum(x => x.Orders), grp.Sum(x => x.Gross),
                grp.Sum(x => x.Discount), grp.Sum(x => x.Tax), grp.Sum(x => x.Net),
                grp.Where(x => x.Kind == CustomerKind.Partner).Sum(x => x.Net), grp.Where(x => x.Kind != CustomerKind.Partner).Sum(x => x.Net)))
            .OrderBy(x => daily.Where(d => Key(d.Day) == x.Period).Min(d => d.Day)).ToList();
    }

    /// <summary>Indian fiscal quarters: Q1 = Apr–Jun.</summary>
    private static string FiscalQuarter(DateOnly d)
    {
        var q = d.Month switch { >= 4 and <= 6 => 1, >= 7 and <= 9 => 2, >= 10 and <= 12 => 3, _ => 4 };
        return $"Q{q} FY {Clock.FinancialYear(d.ToDateTime(TimeOnly.MinValue)).Insert(2, "-")}";
    }

    public async Task<List<ProductPerformanceDto>> ProductsAsync(DateRange r, long? categoryId, long? brandId, CancellationToken ct = default)
    {
        var items = _db.OrderItems.AsNoTracking().Where(i => Sold.Contains(i.Order.Status) && i.Order.PaidAt >= r.FromUtc && i.Order.PaidAt < r.ToUtcExclusive);
        if (categoryId != null) items = items.Where(i => i.Product.CategoryId == categoryId);
        if (brandId != null) items = items.Where(i => i.Product.BrandId == brandId);
        var rows = await items.GroupBy(i => new { i.ProductId, i.Product.Code, i.Product.Name, Cat = i.Product.Category.Name, Brand = i.Product.Brand.Name, i.Product.StockQty, i.Product.AverageCost })
            .Select(g => new
            {
                g.Key, Qty = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.LineTotal), Tax = g.Sum(i => i.TaxAmount),
                Orders = g.Select(i => i.OrderId).Distinct().Count()
            }).OrderByDescending(x => x.Revenue).ToListAsync(ct);
        return rows.Select(x => new ProductPerformanceDto(x.Key.ProductId, x.Key.Code, x.Key.Name, x.Key.Cat, x.Key.Brand, x.Qty, x.Revenue, x.Orders,
            x.Qty == 0 ? 0 : Pricing.Round(x.Revenue / x.Qty), x.Key.StockQty,
            Pricing.Round(x.Revenue - x.Tax - x.Qty * x.Key.AverageCost))).ToList();
    }

    public async Task<List<PartnerPerformanceDto>> PartnersAsync(DateRange r, long? managerId, CancellationToken ct = default)
    {
        var partners = _db.PartnerProfiles.AsNoTracking().Where(p => p.KycStatus == KycStatus.Approved);
        if (managerId != null) partners = partners.Where(p => p.ManagerId == managerId);
        var from = r.FromUtc; var to = r.ToUtcExclusive;
        var rows = await partners.Select(p => new
        {
            p.UserId, p.User.Name, p.User.Phone, p.City, Manager = p.Manager != null ? p.Manager.Name : null,
            Count = _db.Orders.Count(o => o.UserId == p.UserId && Sold.Contains(o.Status) && o.PaidAt >= from && o.PaidAt < to),
            Revenue = _db.Orders.Where(o => o.UserId == p.UserId && Sold.Contains(o.Status) && o.PaidAt >= from && o.PaidAt < to).Sum(o => (decimal?)o.GrandTotal) ?? 0,
            Points = _db.Orders.Where(o => o.UserId == p.UserId && Sold.Contains(o.Status) && o.PaidAt >= from && o.PaidAt < to).Sum(o => (decimal?)o.RewardPointsEarned) ?? 0,
            Last = _db.Orders.Where(o => o.UserId == p.UserId && Sold.Contains(o.Status) && o.PaidAt >= from && o.PaidAt < to).Max(o => (DateTime?)o.PaidAt)
        }).OrderByDescending(x => x.Revenue).ToListAsync(ct);
        return rows.Select(x => new PartnerPerformanceDto(x.UserId, x.Name, x.Phone, x.City, x.Manager, x.Count, x.Revenue,
            x.Count == 0 ? 0 : Pricing.Round(x.Revenue / x.Count), x.Points, x.Last)).ToList();
    }

    public async Task<(List<NamedValueDto> Categories, List<NamedValueDto> Brands)> CategoryBrandAsync(DateRange r, CancellationToken ct = default)
    {
        var items = _db.OrderItems.AsNoTracking().Where(i => Sold.Contains(i.Order.Status) && i.Order.PaidAt >= r.FromUtc && i.Order.PaidAt < r.ToUtcExclusive);
        var cats = await items.GroupBy(i => new { i.Product.CategoryId, i.Product.Category.Name })
            .OrderByDescending(g => g.Sum(x => x.LineTotal))
            .Select(g => new NamedValueDto(g.Key.CategoryId, g.Key.Name, g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal), g.Select(i => i.OrderId).Distinct().Count())).ToListAsync(ct);
        var brands = await items.GroupBy(i => new { i.Product.BrandId, i.Product.Brand.Name })
            .OrderByDescending(g => g.Sum(x => x.LineTotal))
            .Select(g => new NamedValueDto(g.Key.BrandId, g.Key.Name, g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal), g.Select(i => i.OrderId).Distinct().Count())).ToListAsync(ct);
        return (cats, brands);
    }

    public async Task<List<PurchaseReportRow>> PurchasesAsync(DateRange r, string groupBy, CancellationToken ct = default)
    {
        var items = _db.PurchaseItems.AsNoTracking().Where(i => i.Purchase.PurchaseDate >= r.FromOrDefault && i.Purchase.PurchaseDate <= r.ToOrDefault);
        if (groupBy == "product")
            return await items.GroupBy(i => i.Product.Code + " · " + i.Product.Name)
                .Select(g => new PurchaseReportRow(g.Key, g.Select(i => i.PurchaseId).Distinct().Count(), g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal)))
                .OrderByDescending(x => x.Amount).ToListAsync(ct);
        if (groupBy == "month")
        {
            var rows = await items.GroupBy(i => new { i.Purchase.PurchaseDate.Year, i.Purchase.PurchaseDate.Month })
                .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Select(i => i.PurchaseId).Distinct().Count(), Qty = g.Sum(i => i.Quantity), Amt = g.Sum(i => i.LineTotal) })
                .OrderBy(x => x.Year).ThenBy(x => x.Month).ToListAsync(ct);
            return rows.Select(x => new PurchaseReportRow(new DateTime(x.Year, x.Month, 1).ToString("MMM yyyy"), x.Count, x.Qty, x.Amt)).ToList();
        }
        return await items.GroupBy(i => i.Purchase.SupplierName ?? "(no supplier)")
            .Select(g => new PurchaseReportRow(g.Key, g.Select(i => i.PurchaseId).Distinct().Count(), g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal)))
            .OrderByDescending(x => x.Amount).ToListAsync(ct);
    }

    public Task<List<DispatchReportRow>> DispatchesAsync(DateRange r, CancellationToken ct = default) =>
        _db.Dispatches.AsNoTracking().Where(d => d.DispatchedAt >= r.FromUtc && d.DispatchedAt < r.ToUtcExclusive)
            .OrderByDescending(d => d.DispatchedAt)
            .Select(d => new DispatchReportRow(d.InvoiceNo, d.DispatchNo, d.DispatchedAt, d.Order.OrderNo, d.Order.CustomerName,
                d.Order.CustomerKind, d.Order.FulfilmentType, d.Order.GrandTotal, d.DispatchedByName))
            .ToListAsync(ct);

    /// <summary>Active products matching the stock filters (all except the movement filters).</summary>
    private IQueryable<Domain.Entities.Product> StockBase(StockQuery q)
    {
        var query = _db.Products.AsNoTracking().Where(p => p.IsActive);
        if (q.LowOnly) query = query.Where(p => p.StockQty <= p.ReorderLevel);
        if (q.CategoryId != null) query = query.Where(p => p.CategoryId == q.CategoryId);
        if (q.BrandId != null) query = query.Where(p => p.BrandId == q.BrandId);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            var s = $"%{term}%";
            query = query.Where(p => EF.Functions.ILike(p.Name, s) || EF.Functions.ILike(p.Code, s) || p.Barcode == term
                                     || p.Aliases.Any(a => EF.Functions.ILike(a.Alias, s)));
        }
        return query;
    }

    public async Task<List<StockRow>> StockAsync(StockQuery q, CancellationToken ct = default)
    {
        var today = Clock.TodayIst;
        var query = StockBase(q);
        if (q.Movement != null) query = query.WhereMovement(q.Movement.Value, today);
        if (q.NeverDispatched != null) query = query.Where(p => (p.LastDispatchedAt == null) == q.NeverDispatched);
        var rows = await query.OrderBy(p => p.Category.Name).ThenBy(p => p.Name)
            .Select(p => new
            {
                p.Id, p.Code, p.Name, Category = p.Category.Name, Brand = p.Brand.Name, p.Unit, p.StockQty, p.ReservedQty, p.ReorderLevel,
                p.AverageCost, p.ListPrice, p.LastDispatchedAt, p.AgingFromAt, p.CreatedAt,
                Racks = p.Locations.Where(l => l.Quantity > 0).Select(l => l.RackLocation.Label).ToList()
            })
            .ToListAsync(ct);
        return rows.Select(p =>
        {
            var m = ProductMovement.Classify(p.LastDispatchedAt, p.AgingFromAt, p.CreatedAt, today);
            return new StockRow(p.Id, p.Code, p.Name, p.Category, p.Brand, p.Unit, p.StockQty, p.ReservedQty, p.StockQty - p.ReservedQty,
                p.ReorderLevel, p.AverageCost, Math.Round(p.StockQty * p.AverageCost, 2), p.ListPrice, p.Racks,
                m.Category, m.DaysSinceMovement, m.NeverDispatched, m.LastDispatchedAt, m.ReferenceAt);
        }).ToList();
    }

    public async Task<MovementSummaryDto> MovementSummaryAsync(StockQuery q, CancellationToken ct = default)
    {
        var today = Clock.TodayIst;
        var rows = await StockBase(q)
            .Select(p => new { p.LastDispatchedAt, p.AgingFromAt, p.CreatedAt, p.StockQty, p.AverageCost })
            .ToListAsync(ct);
        var classified = rows.Select(r => (Info: ProductMovement.Classify(r.LastDispatchedAt, r.AgingFromAt, r.CreatedAt, today), r.StockQty, r.AverageCost)).ToList();
        MovementBucketDto Bucket(MovementCategory c)
        {
            var b = classified.Where(x => x.Info.Category == c).ToList();
            return new MovementBucketDto(b.Count, b.Count(x => x.Info.NeverDispatched), b.Sum(x => x.StockQty),
                Math.Round(b.Sum(x => Math.Max(0, x.StockQty) * x.AverageCost), 2));
        }
        return new MovementSummaryDto(DateOnly.FromDateTime(today), ProductMovement.FastMaxDays, ProductMovement.SlowMaxDays,
            Bucket(MovementCategory.Fast), Bucket(MovementCategory.Slow), Bucket(MovementCategory.NonMoving));
    }

    public async Task<ProductMovementDto> ProductMovementAsync(long productId, CancellationToken ct = default)
    {
        var today = Clock.TodayIst;
        var p = await _db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == productId, ct) ?? throw new NotFoundException("Product");
        // Every successful dispatch that included this product (an order has at most one dispatch; lines are summed per order).
        var lines = await _db.OrderItems.AsNoTracking()
            .Where(i => i.ProductId == productId && i.Order.Dispatch != null)
            .Select(i => new
            {
                i.Order.Dispatch!.DispatchedAt, i.Order.Dispatch.InvoiceNo, i.Order.Dispatch.DispatchNo, i.OrderId, i.Order.OrderNo,
                i.Order.CustomerName, i.Order.Channel, i.Quantity
            })
            .ToListAsync(ct);
        var dispatches = lines.GroupBy(l => l.OrderId)
            .Select(g => { var f = g.First(); return new ProductDispatchRow(f.DispatchedAt, f.InvoiceNo, f.DispatchNo, f.OrderId, f.OrderNo, f.CustomerName, f.Channel, g.Sum(x => x.Quantity)); })
            .OrderByDescending(d => d.DispatchedAt).ToList();
        var m = ProductMovement.Classify(p, today);
        decimal QtyWithin(int days) => dispatches.Where(d => ProductMovement.DaysSince(d.DispatchedAt, today) <= days).Sum(d => d.Quantity);
        return new ProductMovementDto(p.Id, p.Code, p.Name, p.Unit, p.StockQty, m.Category, m.DaysSinceMovement, m.NeverDispatched,
            m.LastDispatchedAt, m.ReferenceAt, p.AgingFromAt, p.CreatedAt, dispatches.Count,
            QtyWithin(ProductMovement.FastMaxDays), QtyWithin(ProductMovement.SlowMaxDays), dispatches.Take(200).ToList());
    }

    /// <summary>Opening / in / out / closing per product for the period, from the stock ledger.</summary>
    public async Task<List<StockStatementRow>> StockStatementAsync(DateRange r, long? productId, CancellationToken ct = default)
    {
        var from = r.FromUtc; var to = r.ToUtcExclusive;
        var products = _db.Products.AsNoTracking().Where(p => p.IsActive || p.StockQty != 0);
        if (productId != null) products = products.Where(p => p.Id == productId);

        var rows = await products.Select(p => new
        {
            p.Id, p.Code, p.Name,
            Opening = _db.StockMovements.Where(m => m.ProductId == p.Id && m.CreatedAt < from).Sum(m => (decimal?)m.Quantity) ?? 0,
            In = _db.StockMovements.Where(m => m.ProductId == p.Id && m.CreatedAt >= from && m.CreatedAt < to && m.Quantity > 0).Sum(m => (decimal?)m.Quantity) ?? 0,
            Out = _db.StockMovements.Where(m => m.ProductId == p.Id && m.CreatedAt >= from && m.CreatedAt < to && m.Quantity < 0).Sum(m => (decimal?)-m.Quantity) ?? 0
        }).OrderBy(x => x.Name).ToListAsync(ct);

        return rows.Where(x => productId != null || x.Opening != 0 || x.In != 0 || x.Out != 0)
            .Select(x => new StockStatementRow(x.Id, x.Code, x.Name, x.Opening, x.In, x.Out, x.Opening + x.In - x.Out)).ToList();
    }
}
