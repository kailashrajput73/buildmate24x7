using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Erp;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Inventory;

public record PurchaseLineInput(long? ProductId, string? ProductCode, decimal Quantity, decimal ListPrice,
    decimal PurchaseDiscountPercent, long? RackLocationId, string? RackLabel);

public record PurchaseCreate(string? SupplierName, string? SupplierGstin, string? SupplierInvoiceNo, DateOnly PurchaseDate,
    string? Notes, List<PurchaseLineInput> Items);

public record PurchaseListDto(long Id, string PurchaseNo, DateOnly PurchaseDate, string? SupplierName, string? SupplierInvoiceNo,
    int ItemCount, decimal TotalQuantity, decimal TotalAmount, DateTime CreatedAt);

public record PurchaseItemDto(long ProductId, string ProductCode, string ProductName, decimal Quantity, decimal ListPrice,
    decimal PurchaseDiscountPercent, decimal NetRate, decimal LineTotal, string? RackLabel);

public record PurchaseDetailDto(long Id, string PurchaseNo, DateOnly PurchaseDate, string? SupplierName, string? SupplierGstin,
    string? SupplierInvoiceNo, string? Notes, decimal TotalAmount, DateTime CreatedAt, List<PurchaseItemDto> Items);

public record PurchaseQuery(string? Search, DateOnly? From, DateOnly? To, long? ProductId, int Page = 1, int PageSize = 25);

/// <summary>Row-level problems found while validating an Excel upload; nothing is saved when any exist.</summary>
public record ImportError(int Row, string Message);

public class ImportValidationException : AppException
{
    public IReadOnlyList<ImportError> Errors { get; }
    public ImportValidationException(IReadOnlyList<ImportError> errors)
        : base($"{errors.Count} row(s) need fixing. Nothing was saved.", 422, "import_invalid") => Errors = errors;
}

public interface IPurchaseService
{
    Task<PurchaseDetailDto> CreateAsync(PurchaseCreate dto, CancellationToken ct = default);
    Task<PagedResult<PurchaseListDto>> ListAsync(PurchaseQuery q, CancellationToken ct = default);
    Task<PurchaseDetailDto> GetAsync(long id, CancellationToken ct = default);
}

public class PurchaseService : IPurchaseService
{
    private readonly AppDbContext _db;
    private readonly IStockService _stock;
    private readonly ICurrentUser _me;
    private readonly IOutbox _outbox;

    public PurchaseService(AppDbContext db, IStockService stock, ICurrentUser me, IOutbox outbox)
    {
        _db = db;
        _stock = stock;
        _me = me;
        _outbox = outbox;
    }

    public async Task<PurchaseDetailDto> CreateAsync(PurchaseCreate dto, CancellationToken ct = default)
    {
        if (dto.Items == null || dto.Items.Count == 0) throw new AppException("Add at least one item.");

        // Resolve product codes and rack labels up front so we can report every bad row at once.
        var codes = dto.Items.Where(i => i.ProductId == null && !string.IsNullOrWhiteSpace(i.ProductCode))
            .Select(i => i.ProductCode!.Trim().ToUpperInvariant()).Distinct().ToList();
        var byCode = await _db.Products.AsNoTracking().Where(p => codes.Contains(p.Code)).ToDictionaryAsync(p => p.Code, p => p.Id, ct);
        var labels = dto.Items.Where(i => i.RackLocationId == null && !string.IsNullOrWhiteSpace(i.RackLabel))
            .Select(i => i.RackLabel!.Trim().ToUpperInvariant()).Distinct().ToList();
        var byLabel = await _db.RackLocations.AsNoTracking().Where(l => labels.Contains(l.Label)).ToDictionaryAsync(l => l.Label, l => l.Id, ct);

        var errors = new List<ImportError>();
        var lines = new List<(long ProductId, PurchaseLineInput In, long? RackId)>();
        for (var i = 0; i < dto.Items.Count; i++)
        {
            var it = dto.Items[i];
            var row = i + 1;
            long? pid = it.ProductId;
            if (pid == null)
            {
                var code = it.ProductCode?.Trim().ToUpperInvariant();
                if (string.IsNullOrEmpty(code)) { errors.Add(new(row, "Product code is missing.")); continue; }
                if (!byCode.TryGetValue(code, out var found)) { errors.Add(new(row, $"Unknown product code {code}.")); continue; }
                pid = found;
            }
            if (it.Quantity <= 0) errors.Add(new(row, "Quantity must be more than zero."));
            if (it.ListPrice < 0) errors.Add(new(row, "List price cannot be negative."));
            if (it.PurchaseDiscountPercent is < 0 or > 100) errors.Add(new(row, "Purchase discount must be 0–100%."));
            long? rack = it.RackLocationId;
            if (rack == null && !string.IsNullOrWhiteSpace(it.RackLabel))
            {
                if (byLabel.TryGetValue(it.RackLabel.Trim().ToUpperInvariant(), out var lid)) rack = lid;
                else errors.Add(new(row, $"Unknown rack location {it.RackLabel}."));
            }
            lines.Add((pid.Value, it, rack));
        }
        if (errors.Count > 0) throw new ImportValidationException(errors);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var products = (await _db.LockProductsAsync(lines.Select(l => l.ProductId), ct)).ToDictionary(p => p.Id);
        var missing = lines.Where(l => !products.ContainsKey(l.ProductId)).Select(l => l.ProductId).ToList();
        if (missing.Count > 0) throw new AppException($"Products not found: {string.Join(", ", missing)}");

        var purchase = new Purchase
        {
            PurchaseNo = $"PU{Clock.FinancialYear(Clock.TodayIst)}{await _db.NextSequenceValueAsync(Sequences.PurchaseNo, ct):D5}",
            SupplierName = dto.SupplierName?.Trim(),
            SupplierGstin = dto.SupplierGstin?.Trim().ToUpperInvariant(),
            SupplierInvoiceNo = dto.SupplierInvoiceNo?.Trim(),
            PurchaseDate = dto.PurchaseDate,
            Notes = dto.Notes?.Trim(),
            CreatedById = _me.Id
        };
        foreach (var (pid, it, rack) in lines)
        {
            var net = Math.Round(it.ListPrice * (1 - it.PurchaseDiscountPercent / 100m), 4);
            purchase.Items.Add(new PurchaseItem
            {
                ProductId = pid,
                Quantity = it.Quantity,
                ListPrice = it.ListPrice,
                PurchaseDiscountPercent = it.PurchaseDiscountPercent,
                NetRate = net,
                LineTotal = Pricing.Round(net * it.Quantity),
                RackLocationId = rack
            });
        }
        purchase.TotalAmount = purchase.Items.Sum(i => i.LineTotal);
        _db.Purchases.Add(purchase);
        await _db.SaveChangesAsync(ct); // need purchase id for ledger references

        foreach (var item in purchase.Items)
        {
            _stock.Apply(products[item.ProductId], StockMovementType.PurchaseIn, item.Quantity, item.NetRate,
                "Purchase", purchase.Id, purchase.PurchaseNo, purchase.SupplierName);
            if (item.RackLocationId != null) await _stock.PlaceAsync(item.ProductId, item.RackLocationId.Value, item.Quantity, ct);
        }

        _outbox.Add(ErpEvents.PurchaseCreated, new
        {
            purchase.Id, purchase.PurchaseNo, purchase.SupplierName, purchase.SupplierGstin, purchase.SupplierInvoiceNo,
            PurchaseDate = purchase.PurchaseDate.ToString("yyyy-MM-dd"), purchase.TotalAmount,
            Items = purchase.Items.Select(i => new { ProductCode = products[i.ProductId].Code, i.Quantity, i.ListPrice, i.PurchaseDiscountPercent, i.NetRate, i.LineTotal })
        });
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(purchase.Id, ct);
    }

    public async Task<PagedResult<PurchaseListDto>> ListAsync(PurchaseQuery q, CancellationToken ct = default)
    {
        var query = _db.Purchases.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = $"%{q.Search.Trim()}%";
            query = query.Where(p => EF.Functions.ILike(p.PurchaseNo, s) || EF.Functions.ILike(p.SupplierName ?? "", s) || EF.Functions.ILike(p.SupplierInvoiceNo ?? "", s));
        }
        if (q.From != null) query = query.Where(p => p.PurchaseDate >= q.From);
        if (q.To != null) query = query.Where(p => p.PurchaseDate <= q.To);
        if (q.ProductId != null) query = query.Where(p => p.Items.Any(i => i.ProductId == q.ProductId));

        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(p => p.PurchaseDate).ThenByDescending(p => p.Id).Page(page)
            .Select(p => new PurchaseListDto(p.Id, p.PurchaseNo, p.PurchaseDate, p.SupplierName, p.SupplierInvoiceNo,
                p.Items.Count, p.Items.Sum(i => i.Quantity), p.TotalAmount, p.CreatedAt))
            .ToListAsync(ct);
        return new PagedResult<PurchaseListDto>(items, total, page.SafePage, page.SafeSize);
    }

    public async Task<PurchaseDetailDto> GetAsync(long id, CancellationToken ct = default)
    {
        var p = await _db.Purchases.AsNoTracking()
            .Include(x => x.Items).ThenInclude(i => i.Product)
            .Include(x => x.Items).ThenInclude(i => i.RackLocation)
            .FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Purchase");
        return new PurchaseDetailDto(p.Id, p.PurchaseNo, p.PurchaseDate, p.SupplierName, p.SupplierGstin, p.SupplierInvoiceNo,
            p.Notes, p.TotalAmount, p.CreatedAt,
            p.Items.OrderBy(i => i.Id).Select(i => new PurchaseItemDto(i.ProductId, i.Product.Code, i.Product.Name, i.Quantity, i.ListPrice,
                i.PurchaseDiscountPercent, i.NetRate, i.LineTotal, i.RackLocation?.Label)).ToList());
    }
}
