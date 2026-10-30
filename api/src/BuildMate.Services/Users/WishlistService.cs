using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Users;

public interface IWishlistService
{
    /// <summary>Saved product ids, newest first (only products still on sale).</summary>
    Task<List<long>> IdsAsync(long userId, CancellationToken ct = default);
    Task<List<long>> AddAsync(long userId, long productId, CancellationToken ct = default);
    Task<List<long>> RemoveAsync(long userId, long productId, CancellationToken ct = default);
    /// <summary>Adds products saved in the browser before logging in (ignores unknown / duplicate ids).</summary>
    Task<List<long>> MergeAsync(long userId, IEnumerable<long> productIds, CancellationToken ct = default);
}

/// <summary>Account wishlist: follows the user across devices, the website and the app.</summary>
public class WishlistService : IWishlistService
{
    private const int MaxItems = 200;
    private readonly AppDbContext _db;
    public WishlistService(AppDbContext db) => _db = db;

    public Task<List<long>> IdsAsync(long userId, CancellationToken ct = default) =>
        _db.WishlistItems.AsNoTracking()
            .Where(w => w.UserId == userId && _db.Products.Any(p => p.Id == w.ProductId && p.IsActive))
            .OrderByDescending(w => w.CreatedAt).ThenByDescending(w => w.Id)
            .Select(w => w.ProductId).ToListAsync(ct);

    public async Task<List<long>> AddAsync(long userId, long productId, CancellationToken ct = default)
    {
        if (!await _db.Products.AnyAsync(p => p.Id == productId && p.IsActive, ct)) throw new NotFoundException("Product");
        await MergeAsync(userId, new[] { productId }, ct);
        return await IdsAsync(userId, ct);
    }

    public async Task<List<long>> RemoveAsync(long userId, long productId, CancellationToken ct = default)
    {
        var rows = await _db.WishlistItems.Where(w => w.UserId == userId && w.ProductId == productId).ToListAsync(ct);
        if (rows.Count > 0)
        {
            _db.WishlistItems.RemoveRange(rows);
            await _db.SaveChangesAsync(ct);
        }
        return await IdsAsync(userId, ct);
    }

    public async Task<List<long>> MergeAsync(long userId, IEnumerable<long> productIds, CancellationToken ct = default)
    {
        var ids = productIds.Distinct().Take(MaxItems).ToList();
        if (ids.Count == 0) return await IdsAsync(userId, ct);
        var have = await _db.WishlistItems.Where(w => w.UserId == userId).Select(w => w.ProductId).ToListAsync(ct);
        var valid = await _db.Products.Where(p => ids.Contains(p.Id) && p.IsActive).Select(p => p.Id).ToListAsync(ct);
        var room = Math.Max(0, MaxItems - have.Count);
        // Oldest first so the first id ends up newest (matches the browser list order).
        foreach (var id in ids.Where(i => valid.Contains(i) && !have.Contains(i)).Take(room).Reverse())
            _db.WishlistItems.Add(new WishlistItem { UserId = userId, ProductId = id });
        try { await _db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { /* a parallel request added the same product; the unique index keeps one */ }
        return await IdsAsync(userId, ct);
    }
}
