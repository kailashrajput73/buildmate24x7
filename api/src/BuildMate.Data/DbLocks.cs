using BuildMate.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Data;

/// <summary>
/// Pessimistic row locks (SELECT ... FOR UPDATE). Call inside a transaction so concurrent
/// checkouts, dispatches and payment callbacks on the same rows serialize instead of racing.
/// </summary>
public static class DbLocks
{
    public static Task<List<Product>> LockProductsAsync(this AppDbContext db, IEnumerable<long> ids, CancellationToken ct = default)
    {
        var arr = ids.Distinct().OrderBy(x => x).ToArray(); // stable order avoids deadlocks
        return db.Products
            .FromSqlRaw("SELECT * FROM products WHERE id = ANY({0}) ORDER BY id FOR UPDATE", arr)
            .ToListAsync(ct);
    }

    // Materialize without composing so EF doesn't wrap the FOR UPDATE in a subquery.
    public static async Task<Order?> LockOrderAsync(this AppDbContext db, long orderId, CancellationToken ct = default) =>
        (await db.Orders.FromSqlRaw("SELECT * FROM orders WHERE id = {0} FOR UPDATE", orderId).ToListAsync(ct)).FirstOrDefault();

    /// <summary>Serialises checkouts by the same user (double-clicks, two tabs, app + web at once).</summary>
    public static async Task LockUserAsync(this AppDbContext db, long userId, CancellationToken ct = default) =>
        await db.Users.FromSqlRaw("SELECT * FROM users WHERE id = {0} FOR UPDATE", userId).ToListAsync(ct);

    public static async Task<PartnerProfile?> LockPartnerAsync(this AppDbContext db, long userId, CancellationToken ct = default) =>
        (await db.PartnerProfiles.FromSqlRaw("SELECT * FROM partner_profiles WHERE user_id = {0} FOR UPDATE", userId).ToListAsync(ct)).FirstOrDefault();

    public static async Task<CustomerProfile?> LockCustomerProfileAsync(this AppDbContext db, long userId, CancellationToken ct = default) =>
        (await db.CustomerProfiles.FromSqlRaw("SELECT * FROM customer_profiles WHERE user_id = {0} FOR UPDATE", userId).ToListAsync(ct)).FirstOrDefault();

    /// <summary>Locks a quotation and loads its lines (pricing by staff vs. acceptance by the customer).</summary>
    public static async Task<Quotation?> LockQuotationAsync(this AppDbContext db, long id, CancellationToken ct = default)
    {
        var q = (await db.Quotations.FromSqlRaw("SELECT * FROM quotations WHERE id = {0} FOR UPDATE", id).ToListAsync(ct)).FirstOrDefault();
        if (q != null) await db.Entry(q).Collection(x => x.Items).LoadAsync(ct);
        return q;
    }
}
