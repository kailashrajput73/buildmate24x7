using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Inventory;
using Xunit;

namespace BuildMate.Tests;

/// <summary>
/// The movement rule (Inventory/ProductMovement.cs): India-time calendar days since the last successful dispatch,
/// 0–30 Fast, 31–120 Slow, 121+ Non-moving; never-dispatched products aged from the first stock receipt, else creation.
/// Pure tests — no database.
/// </summary>
public class ProductMovementTests
{
    /// <summary>"Today" for the tests: 28 Oct 2026 in India.</summary>
    private static readonly DateTime Today = new(2026, 10, 28);

    /// <summary>UTC instant for a wall-clock time in India.</summary>
    private static DateTime Ist(int y, int m, int d, int hh = 12, int mm = 0) =>
        TimeZoneInfo.ConvertTimeToUtc(new DateTime(y, m, d, hh, mm, 0, DateTimeKind.Unspecified), Clock.India);

    /// <summary>Noon IST, <paramref name="days"/> calendar days before Today.</summary>
    private static DateTime DaysAgo(int days, int hh = 12, int mm = 0)
    {
        var d = Today.AddDays(-days);
        return Ist(d.Year, d.Month, d.Day, hh, mm);
    }

    private static readonly DateTime Created = Ist(2025, 1, 1);

    // ------------------------------------------------------------------ 30 / 120 day boundaries

    [Theory]
    [InlineData(0, MovementCategory.Fast)]
    [InlineData(1, MovementCategory.Fast)]
    [InlineData(29, MovementCategory.Fast)]
    [InlineData(30, MovementCategory.Fast)]       // "within the last 30 days" includes day 30
    [InlineData(31, MovementCategory.Slow)]       // first slow day
    [InlineData(119, MovementCategory.Slow)]
    [InlineData(120, MovementCategory.Slow)]      // last slow day
    [InlineData(121, MovementCategory.NonMoving)] // "more than 120 days"
    [InlineData(400, MovementCategory.NonMoving)]
    public void Dispatched_product_is_classified_by_days_since_last_dispatch(int daysAgo, MovementCategory expected)
    {
        var m = ProductMovement.Classify(DaysAgo(daysAgo), agingFromAt: null, Created, Today);
        Assert.Equal(expected, m.Category);
        Assert.Equal(daysAgo, m.DaysSinceMovement);
        Assert.False(m.NeverDispatched);
    }

    [Fact]
    public void Day_boundaries_follow_India_midnight_not_UTC()
    {
        // 27 Oct 23:59 IST is yesterday in India even though it is 18:29 UTC on 27 Oct.
        Assert.Equal(1, ProductMovement.DaysSince(Ist(2026, 10, 27, 23, 59), Today));
        // 28 Oct 00:01 IST is still 27 Oct in UTC (18:31), but today in India.
        Assert.Equal(0, ProductMovement.DaysSince(Ist(2026, 10, 28, 0, 1), Today));
        // The 30/31 boundary flips exactly at India midnight.
        Assert.Equal(MovementCategory.Fast, ProductMovement.Classify(Ist(2026, 9, 28, 0, 0), null, Created, Today).Category);   // 30 days
        Assert.Equal(MovementCategory.Slow, ProductMovement.Classify(Ist(2026, 9, 27, 23, 59), null, Created, Today).Category); // 31 days
        // ...and the 120/121 boundary.
        Assert.Equal(MovementCategory.Slow, ProductMovement.Classify(Ist(2026, 6, 30, 0, 0), null, Created, Today).Category);      // 120 days
        Assert.Equal(MovementCategory.NonMoving, ProductMovement.Classify(Ist(2026, 6, 29, 23, 59), null, Created, Today).Category); // 121 days
    }

    [Fact]
    public void Category_moves_on_as_days_pass_without_a_new_dispatch()
    {
        var last = DaysAgo(0);
        Assert.Equal(MovementCategory.Fast, ProductMovement.Classify(last, null, Created, Today.AddDays(30)).Category);
        Assert.Equal(MovementCategory.Slow, ProductMovement.Classify(last, null, Created, Today.AddDays(31)).Category);
        Assert.Equal(MovementCategory.Slow, ProductMovement.Classify(last, null, Created, Today.AddDays(120)).Category);
        Assert.Equal(MovementCategory.NonMoving, ProductMovement.Classify(last, null, Created, Today.AddDays(121)).Category);
    }

    [Fact]
    public void A_dispatch_time_later_than_today_counts_as_today()
    {
        var m = ProductMovement.Classify(DaysAgo(-1), null, Created, Today);
        Assert.Equal(0, m.DaysSinceMovement);
        Assert.Equal(MovementCategory.Fast, m.Category);
    }

    // ------------------------------------------------------------------ never dispatched

    [Theory]
    [InlineData(10, MovementCategory.Fast)]
    [InlineData(30, MovementCategory.Fast)]
    [InlineData(31, MovementCategory.Slow)]
    [InlineData(120, MovementCategory.Slow)]
    [InlineData(121, MovementCategory.NonMoving)]
    public void Never_dispatched_product_is_aged_from_first_stock_receipt_and_flagged(int receivedDaysAgo, MovementCategory expected)
    {
        var received = DaysAgo(receivedDaysAgo);
        var m = ProductMovement.Classify(lastDispatchedAt: null, agingFromAt: received, createdAt: Created, Today);
        Assert.True(m.NeverDispatched);
        Assert.Equal(expected, m.Category);
        Assert.Equal(received, m.ReferenceAt);
        Assert.Null(m.LastDispatchedAt);
    }

    [Fact]
    public void Never_dispatched_without_any_receipt_falls_back_to_creation_date()
    {
        var created = DaysAgo(45);
        var m = ProductMovement.Classify(null, null, created, Today);
        Assert.True(m.NeverDispatched);
        Assert.Equal(created, m.ReferenceAt);
        Assert.Equal(45, m.DaysSinceMovement);
        Assert.Equal(MovementCategory.Slow, m.Category);
    }

    [Fact]
    public void Once_dispatched_the_receipt_date_is_ignored()
    {
        var m = ProductMovement.Classify(DaysAgo(200), agingFromAt: DaysAgo(5), Created, Today);
        Assert.False(m.NeverDispatched);
        Assert.Equal(MovementCategory.NonMoving, m.Category);
    }

    // ------------------------------------------------------------------ dispatch updates and duplicates

    [Fact]
    public void Dispatch_sets_last_movement_date_and_reclassifies()
    {
        var p = new Product { CreatedAt = Created, AgingFromAt = DaysAgo(300) };
        Assert.Equal(MovementCategory.NonMoving, ProductMovement.Classify(p, Today).Category);
        Assert.True(ProductMovement.Classify(p, Today).NeverDispatched);

        var at = DaysAgo(0, 10, 30);
        ProductMovement.RecordDispatch(p, at);

        Assert.Equal(at, p.LastDispatchedAt);
        var m = ProductMovement.Classify(p, Today);
        Assert.Equal(MovementCategory.Fast, m.Category);
        Assert.False(m.NeverDispatched);
        Assert.Equal(0, m.DaysSinceMovement);
    }

    [Fact]
    public void Replayed_or_out_of_order_dispatch_never_moves_the_date_back()
    {
        var p = new Product { CreatedAt = Created };
        var latest = DaysAgo(2);
        ProductMovement.RecordDispatch(p, latest);
        ProductMovement.RecordDispatch(p, DaysAgo(50)); // older event arriving late
        ProductMovement.RecordDispatch(p, latest);      // same event twice
        Assert.Equal(latest, p.LastDispatchedAt);
        ProductMovement.RecordDispatch(p, DaysAgo(1));  // genuinely newer
        Assert.Equal(DaysAgo(1), p.LastDispatchedAt);
    }

    // ------------------------------------------------------------------ receipts and returns

    [Theory]
    [InlineData(StockMovementType.PurchaseIn, 10, true)]
    [InlineData(StockMovementType.OpeningStock, 10, true)]
    [InlineData(StockMovementType.AdjustmentIn, 10, true)]
    [InlineData(StockMovementType.ReturnIn, 10, false)]      // returns never count as a receipt
    [InlineData(StockMovementType.SaleOut, -10, false)]
    [InlineData(StockMovementType.AdjustmentOut, -10, false)]
    [InlineData(StockMovementType.PurchaseIn, 0, false)]
    public void Only_positive_receipts_start_the_aging_clock(StockMovementType type, int qty, bool expected) =>
        Assert.Equal(expected, ProductMovement.IsReceipt(type, qty));

    [Fact]
    public void First_receipt_is_kept_and_later_receipts_do_not_reset_it()
    {
        var p = new Product { CreatedAt = Created };
        var first = DaysAgo(90);
        ProductMovement.RecordReceipt(p, StockMovementType.PurchaseIn, 5, first);
        ProductMovement.RecordReceipt(p, StockMovementType.PurchaseIn, 5, DaysAgo(3));
        Assert.Equal(first, p.AgingFromAt);
    }

    [Fact]
    public void Returns_and_adjustments_do_not_change_the_last_dispatch_date()
    {
        var dispatched = DaysAgo(40);
        var p = new Product { CreatedAt = Created, AgingFromAt = DaysAgo(100) };
        ProductMovement.RecordDispatch(p, dispatched);

        // Goods coming back are recorded as stock adjustments; the dispatch date stays.
        ProductMovement.RecordReceipt(p, StockMovementType.AdjustmentIn, 3, DaysAgo(1));
        ProductMovement.RecordReceipt(p, StockMovementType.ReturnIn, 3, DaysAgo(1));

        Assert.Equal(dispatched, p.LastDispatchedAt);
        Assert.Equal(DaysAgo(100), p.AgingFromAt);
        Assert.Equal(MovementCategory.Slow, ProductMovement.Classify(p, Today).Category);
    }

    // ------------------------------------------------------------------ database filter = in-memory rule

    [Fact]
    public void Database_filter_cutoffs_agree_with_the_day_rule_at_every_boundary()
    {
        var products = new List<Product>();
        long id = 1;
        // Every 30 minutes across 130 days, dispatched and never-dispatched, around both boundaries.
        for (var t = Ist(2026, 6, 20, 0, 0); t <= Ist(2026, 10, 29, 0, 0); t = t.AddMinutes(30))
        {
            products.Add(new Product { Id = id++, CreatedAt = Created, LastDispatchedAt = t });
            products.Add(new Product { Id = id++, CreatedAt = Created, AgingFromAt = t });
        }
        products.Add(new Product { Id = id++, CreatedAt = DaysAgo(31) }); // no receipt: creation date

        var q = products.AsQueryable();
        foreach (var c in Enum.GetValues<MovementCategory>())
        {
            var viaFilter = q.WhereMovement(c, Today).Select(p => p.Id).ToHashSet();
            var viaRule = products.Where(p => ProductMovement.Classify(p, Today).Category == c).Select(p => p.Id).ToHashSet();
            Assert.Equal(viaRule.Count, viaFilter.Count);
            Assert.True(viaRule.SetEquals(viaFilter), $"{c}: filter and rule disagree");
        }
    }

    [Fact]
    public void Cutoffs_are_India_midnights()
    {
        var k = ProductMovement.CutoffsFor(Today);
        Assert.Equal(Ist(2026, 9, 28, 0, 0), k.FastFromUtc);  // Today − 30 days, 00:00 IST
        Assert.Equal(Ist(2026, 6, 30, 0, 0), k.SlowFromUtc);  // Today − 120 days, 00:00 IST
    }
}
