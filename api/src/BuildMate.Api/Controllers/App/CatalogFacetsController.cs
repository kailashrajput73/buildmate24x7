using BuildMate.Api.Infrastructure;
using BuildMate.Data;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Api.Controllers.App;

[ApiController, AllowAnonymous, Route("api/catalog")]
public class CatalogFacetsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICatalogService _catalog;
    private readonly ICurrentUser _me;
    public CatalogFacetsController(AppDbContext db, ICatalogService catalog, ICurrentUser me) { _db = db; _catalog = catalog; _me = me; }

    [HttpGet("types")]
    public async Task<List<TypeDto>> Types([FromQuery] long? categoryId, CancellationToken ct) => (await CatalogStructure.InStoreOrder(_db.ProductTypes.AsNoTracking()
        .Where(t => t.IsActive && t.Category.IsActive && (categoryId == null || t.CategoryId == categoryId)))
        .Select(t => new { Type = t, Category = t.Category.Name, Subs = t.SubCategories.Where(s => s.SubCategory.IsActive).Select(s => s.SubCategoryId).ToList() }).ToListAsync(ct))
        .Select(t => CatalogStructure.ToDto(t.Type, t.Category, t.Subs, true)).ToList();

    [HttpGet("facets")]
    public async Task<CatalogFacets> Facets([FromQuery] long categoryId, [FromQuery] long? typeId, [FromQuery] long? subCategoryId, [FromQuery] long? brandId, CancellationToken ct)
    {
        var baseQuery = _catalog.Visible(HttpContext.GetViewer(_me)).Where(p => p.CategoryId == categoryId);
        var types = await baseQuery.Where(p => p.ProductTypeId != null && p.ProductType!.IsActive).GroupBy(p => new { Id = p.ProductTypeId!.Value, p.ProductType!.Name }).Select(g => new IdFacet(g.Key.Id, g.Key.Name, g.Count())).ToListAsync(ct);
        var q = typeId == null ? baseQuery : baseQuery.Where(p => p.ProductTypeId == typeId);
        var subs = await q.Where(p => p.SubCategoryId != null && p.SubCategory!.IsActive).GroupBy(p => new { Id = p.SubCategoryId!.Value, p.SubCategory!.Name }).Select(g => new IdFacet(g.Key.Id, g.Key.Name, g.Count())).ToListAsync(ct);
        if (subCategoryId != null) q = q.Where(p => p.SubCategoryId == subCategoryId);
        var brands = await q.GroupBy(p => new { p.BrandId, p.Brand.Name }).Select(g => new IdFacet(g.Key.BrandId, g.Key.Name, g.Count())).ToListAsync(ct);
        if (brandId != null) q = q.Where(p => p.BrandId == brandId);
        var classes = await q.Where(p => p.ProductClass != null).GroupBy(p => p.ProductClass!).Select(g => new Facet(g.Key, g.Count())).ToListAsync(ct);
        var sizes = await q.Where(p => p.Size != null).GroupBy(p => p.Size!).Select(g => new Facet(g.Key, g.Count())).ToListAsync(ct);
        var lengths = await q.Where(p => p.Length != null).GroupBy(p => p.Length!).Select(g => new Facet(g.Key, g.Count())).ToListAsync(ct);
        static List<Facet> Sort(List<Facet> items) => items.OrderBy(x => CatalogMeasure.Parse(x.Value)?.Dimension).ThenBy(x => CatalogMeasure.Parse(x.Value)?.NormalizedValue ?? decimal.MaxValue).ThenBy(x => x.Value).ToList();
        // Module / Color / Series / Current Rating: one list per attribute that at least one product has (others are left out,
        // so the shop shows no empty filter). Same value in other letter case = one entry.
        var combos = await q.Where(p => p.Module != null || p.Color != null || p.Series != null || p.CurrentRating != null)
            .GroupBy(p => new { p.Module, p.Color, p.Series, p.CurrentRating })
            .Select(g => new { g.Key.Module, g.Key.Color, g.Key.Series, g.Key.CurrentRating, Count = g.Count() }).ToListAsync(ct);
        var rows = combos.Select(c => (Product: new Domain.Entities.Product { Module = c.Module, Color = c.Color, Series = c.Series, CurrentRating = c.CurrentRating }, c.Count)).ToList();
        var attributes = ProductAttributes.All
            .Select(a => new AttributeFacet(a.Key, a.Name, rows.Select(r => (Value: a.Value(r.Product), r.Count)).Where(r => r.Value != null)
                .GroupBy(r => r.Value!.ToLowerInvariant()).Select(g => new Facet(g.Min(x => x.Value)!, g.Sum(x => x.Count)))
                .OrderBy(f => LeadingNumber(f.Value)).ThenBy(f => f.Value, StringComparer.OrdinalIgnoreCase).ToList()))
            .Where(a => a.Values.Count > 0).ToList();
        return new(types, subs, brands, classes.OrderBy(x => x.Value).ToList(), Sort(sizes), Sort(lengths), attributes);
    }

    /// <summary>"2M" before "12M"; values without a leading number after them, A–Z.</summary>
    private static decimal LeadingNumber(string value)
    {
        var digits = new string(value.TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());
        return decimal.TryParse(digits, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var n) ? n : decimal.MaxValue;
    }
}
