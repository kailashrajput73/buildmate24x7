using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;

namespace BuildMate.Services.Inventory;

/// <summary>Movement class of one product as of a given India-time day.</summary>
/// <param name="ReferenceAt">The instant the days are counted from: the last dispatch, or for never-dispatched products the first stock receipt (else creation).</param>
public record MovementInfo(MovementCategory Category, int DaysSinceMovement, bool NeverDispatched, DateTime ReferenceAt, DateTime? LastDispatchedAt);

/// <summary>
/// Fast / Slow / Non-moving classification — the single rule used by the stock dashboard, product list, filters,
/// summary cards, movement history and Excel export.
///
/// <list type="bullet">
/// <item>Movement = a successful dispatch/handover (<see cref="Dispatch.DispatchedAt"/>). Order creation, payment,
/// delivery confirmation, cancellations and returns do not count.</item>
/// <item>Days are India-time calendar days: days = (today in IST) − (IST date of the reference instant). A dispatch at
/// 23:50 IST is 1 day old at 00:00 IST.</item>
/// <item>0–30 days → Fast, 31–120 → Slow, 121+ → Non-moving.</item>
/// <item>Never dispatched: counted from the first stock receipt (<see cref="Product.AgingFromAt"/>), else the product's
/// CreatedAt, and flagged <see cref="MovementInfo.NeverDispatched"/> so new stock isn't mistaken for a fast seller.</item>
/// </list>
/// The class is computed when data is read (never stored), so it moves on as days pass without a background job.
/// </summary>
public static class ProductMovement
{
    public const int FastMaxDays = 30;
    public const int SlowMaxDays = 120;

    public static DateTime ReferenceAt(DateTime? lastDispatchedAt, DateTime? agingFromAt, DateTime createdAt) =>
        lastDispatchedAt ?? agingFromAt ?? createdAt;

    /// <summary>Whole IST calendar days from the reference instant to <paramref name="todayIst"/> (never negative).</summary>
    public static int DaysSince(DateTime referenceUtc, DateTime todayIst) =>
        Math.Max(0, (todayIst.Date - Clock.ToIst(referenceUtc).Date).Days);

    public static MovementCategory CategoryFor(int days) =>
        days <= FastMaxDays ? MovementCategory.Fast : days <= SlowMaxDays ? MovementCategory.Slow : MovementCategory.NonMoving;

    public static MovementInfo Classify(DateTime? lastDispatchedAt, DateTime? agingFromAt, DateTime createdAt, DateTime todayIst)
    {
        var reference = ReferenceAt(lastDispatchedAt, agingFromAt, createdAt);
        var days = DaysSince(reference, todayIst);
        return new MovementInfo(CategoryFor(days), days, lastDispatchedAt == null, reference, lastDispatchedAt);
    }

    public static MovementInfo Classify(Product p, DateTime todayIst) => Classify(p.LastDispatchedAt, p.AgingFromAt, p.CreatedAt, todayIst);

    /// <summary>
    /// UTC instants equivalent to the day rule, for database filters:
    /// reference ≥ FastFromUtc → Fast; FastFromUtc &gt; reference ≥ SlowFromUtc → Slow; reference &lt; SlowFromUtc → Non-moving.
    /// </summary>
    public record Cutoffs(DateTime FastFromUtc, DateTime SlowFromUtc);

    public static Cutoffs CutoffsFor(DateTime todayIst) =>
        new(Clock.IstDateStartUtc(todayIst.Date.AddDays(-FastMaxDays)), Clock.IstDateStartUtc(todayIst.Date.AddDays(-SlowMaxDays)));

    /// <summary>Filters products to one movement class, evaluated in the database with the same day rule as <see cref="Classify(Product, DateTime)"/>.</summary>
    public static IQueryable<Product> WhereMovement(this IQueryable<Product> q, MovementCategory category, DateTime todayIst)
    {
        var k = CutoffsFor(todayIst);
        var fast = k.FastFromUtc;
        var slow = k.SlowFromUtc;
        return category switch
        {
            MovementCategory.Fast => q.Where(p => (p.LastDispatchedAt ?? p.AgingFromAt ?? p.CreatedAt) >= fast),
            MovementCategory.Slow => q.Where(p => (p.LastDispatchedAt ?? p.AgingFromAt ?? p.CreatedAt) < fast
                                                 && (p.LastDispatchedAt ?? p.AgingFromAt ?? p.CreatedAt) >= slow),
            _ => q.Where(p => (p.LastDispatchedAt ?? p.AgingFromAt ?? p.CreatedAt) < slow),
        };
    }

    /// <summary>
    /// Called by the dispatch workflow inside its transaction (product row locked). Only moves the date forward, so a
    /// replayed or out-of-order dispatch can never make a product look older than it is.
    /// </summary>
    public static void RecordDispatch(Product p, DateTime dispatchedAtUtc)
    {
        if (p.LastDispatchedAt == null || dispatchedAtUtc > p.LastDispatchedAt) p.LastDispatchedAt = dispatchedAtUtc;
    }

    /// <summary>Stock receipts that start a never-dispatched product's aging clock. Returns (ReturnIn) are excluded.</summary>
    public static bool IsReceipt(StockMovementType type, decimal signedQty) =>
        signedQty > 0 && type is StockMovementType.PurchaseIn or StockMovementType.OpeningStock or StockMovementType.AdjustmentIn;

    /// <summary>Remembers the first stock receipt; later receipts don't reset it.</summary>
    public static void RecordReceipt(Product p, StockMovementType type, decimal signedQty, DateTime atUtc)
    {
        if (p.AgingFromAt == null && IsReceipt(type, signedQty)) p.AgingFromAt = atUtc;
    }
}
