using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Erp;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Inventory;

public record StockAdjustRequest(long ProductId, decimal Quantity, bool IsIncrease, string Reason, long? RackLocationId);

public record StockMovementDto(long Id, DateTime CreatedAt, long ProductId, string ProductCode, string ProductName,
    StockMovementType Type, decimal Quantity, decimal BalanceAfter, decimal UnitCost, string? ReferenceType, string? ReferenceNo, string? Note);

public record StockMovementQuery(long? ProductId, StockMovementType? Type, DateOnly? From, DateOnly? To, int Page = 1, int PageSize = 50);

public interface IStockService
{
    /// <summary>
    /// Applies a signed stock change to an already-locked, tracked product and writes the ledger row.
    /// Does not save — callers save inside their own transaction.
    /// </summary>
    void Apply(Product product, StockMovementType type, decimal signedQty, decimal unitCost,
        string? refType, long? refId, string? refNo, string? note);

    Task<StockMovementDto> AdjustAsync(StockAdjustRequest req, CancellationToken ct = default);
    /// <summary>Updates the per-rack quantity for a product. Does not save.</summary>
    Task PlaceAsync(long productId, long rackLocationId, decimal signedQty, CancellationToken ct);
    Task<PagedResult<StockMovementDto>> MovementsAsync(StockMovementQuery q, CancellationToken ct = default);
}

public class StockService : IStockService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;
    private readonly IOutbox _outbox;

    public StockService(AppDbContext db, ICurrentUser me, IOutbox outbox)
    {
        _db = db;
        _me = me;
        _outbox = outbox;
    }

    public void Apply(Product p, StockMovementType type, decimal signedQty, decimal unitCost,
        string? refType, long? refId, string? refNo, string? note)
    {
        if (signedQty == 0) return;
        var newQty = p.StockQty + signedQty;
        if (newQty < 0)
            throw new AppException($"Not enough stock for {p.Name} ({p.Code}). In stock: {p.StockQty:0.###}, needed: {-signedQty:0.###}.", 409, "insufficient_stock");

        // Weighted average cost on receipts that carry a cost.
        if (signedQty > 0 && unitCost > 0)
        {
            var existingValue = Math.Max(0, p.StockQty) * p.AverageCost;
            p.AverageCost = newQty == 0 ? unitCost : Math.Round((existingValue + signedQty * unitCost) / newQty, 4);
        }
        p.StockQty = newQty;
        // First receipt starts the aging clock for products that have never been dispatched.
        ProductMovement.RecordReceipt(p, type, signedQty, DateTime.UtcNow);

        _db.StockMovements.Add(new StockMovement
        {
            ProductId = p.Id,
            Type = type,
            Quantity = signedQty,
            BalanceAfter = newQty,
            UnitCost = unitCost > 0 ? unitCost : p.AverageCost,
            ReferenceType = refType,
            ReferenceId = refId,
            ReferenceNo = refNo,
            Note = note,
            UserId = _me.Id
        });
    }

    public async Task<StockMovementDto> AdjustAsync(StockAdjustRequest req, CancellationToken ct = default)
    {
        if (req.Quantity <= 0) throw new AppException("Quantity must be greater than zero.");
        if (string.IsNullOrWhiteSpace(req.Reason)) throw new AppException("Please give a reason for the adjustment.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var p = (await _db.LockProductsAsync(new[] { req.ProductId }, ct)).FirstOrDefault() ?? throw new NotFoundException("Product");
        if (!req.IsIncrease && req.Quantity > p.StockQty - p.ReservedQty)
            throw new AppException("Cannot reduce below stock already reserved for paid orders.", 409, "reserved_stock");

        var signed = req.IsIncrease ? req.Quantity : -req.Quantity;
        Apply(p, req.IsIncrease ? StockMovementType.AdjustmentIn : StockMovementType.AdjustmentOut, signed, 0,
            "Adjustment", null, null, req.Reason.Trim());

        if (req.RackLocationId != null) await PlaceAsync(p.Id, req.RackLocationId.Value, signed, ct);

        _outbox.Add(ErpEvents.StockAdjusted, new { ProductId = p.Id, p.Code, Quantity = signed, Reason = req.Reason, BalanceAfter = p.StockQty });
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var m = await _db.StockMovements.AsNoTracking().Where(x => x.ProductId == p.Id).OrderByDescending(x => x.Id).FirstAsync(ct);
        return new StockMovementDto(m.Id, m.CreatedAt, p.Id, p.Code, p.Name, m.Type, m.Quantity, m.BalanceAfter, m.UnitCost, m.ReferenceType, m.ReferenceNo, m.Note);
    }

    /// <summary>Tracks how much of a product sits at a rack location (informational; source of truth is StockQty).</summary>
    public async Task PlaceAsync(long productId, long rackLocationId, decimal signedQty, CancellationToken ct)
    {
        var loc = await _db.ProductLocations.FirstOrDefaultAsync(l => l.ProductId == productId && l.RackLocationId == rackLocationId, ct);
        if (loc == null)
        {
            if (!await _db.RackLocations.AnyAsync(r => r.Id == rackLocationId, ct)) throw new NotFoundException("Rack location");
            _db.ProductLocations.Add(new ProductLocation { ProductId = productId, RackLocationId = rackLocationId, Quantity = Math.Max(0, signedQty) });
        }
        else loc.Quantity = Math.Max(0, loc.Quantity + signedQty);
    }

    public async Task<PagedResult<StockMovementDto>> MovementsAsync(StockMovementQuery q, CancellationToken ct = default)
    {
        var query = _db.StockMovements.AsNoTracking();
        if (q.ProductId != null) query = query.Where(m => m.ProductId == q.ProductId);
        if (q.Type != null) query = query.Where(m => m.Type == q.Type);
        if (q.From != null) { var f = Clock.IstDateStartUtc(q.From.Value.ToDateTime(TimeOnly.MinValue)); query = query.Where(m => m.CreatedAt >= f); }
        if (q.To != null) { var t = Clock.IstDateStartUtc(q.To.Value.ToDateTime(TimeOnly.MinValue).AddDays(1)); query = query.Where(m => m.CreatedAt < t); }

        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(m => m.Id).Page(page)
            .Select(m => new StockMovementDto(m.Id, m.CreatedAt, m.ProductId, m.Product.Code, m.Product.Name, m.Type, m.Quantity,
                m.BalanceAfter, m.UnitCost, m.ReferenceType, m.ReferenceNo, m.Note))
            .ToListAsync(ct);
        return new PagedResult<StockMovementDto>(items, total, page.SafePage, page.SafeSize);
    }
}
