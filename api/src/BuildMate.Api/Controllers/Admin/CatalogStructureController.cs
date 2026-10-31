using BuildMate.Api.Infrastructure;
using BuildMate.Data;
using BuildMate.Domain.Common;
using BuildMate.Domain.Entities;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Api.Controllers.Admin;

[Route("api/admin/catalog-structure")]
public class CatalogStructureController : AdminControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;
    public CatalogStructureController(AppDbContext db, ICurrentUser me) { _db = db; _me = me; }

    [HttpGet("types"), Authorize(Policy = Permissions.CatalogView)]
    public async Task<List<TypeDto>> Types([FromQuery] long? categoryId, CancellationToken ct) => await _db.ProductTypes.AsNoTracking()
        .Where(t => categoryId == null || t.CategoryId == categoryId).OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
        .Select(t => new TypeDto(t.Id, t.CategoryId, t.Name, t.SortOrder, t.IsActive, t.SubCategories.Select(s => s.SubCategoryId).ToList())).ToListAsync(ct);

    [HttpPost("types"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<TypeDto> CreateType(TypeInput body, CancellationToken ct) => SaveType(null, body, ct);
    [HttpPut("types/{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<TypeDto> UpdateType(long id, TypeInput body, CancellationToken ct) => SaveType(id, body, ct);
    private async Task<TypeDto> SaveType(long? id, TypeInput body, CancellationToken ct)
    {
        var name = CatalogStructure.Clean(body.Name, 120, "Type") ?? throw new AppException("Type name is required.");
        var key = CatalogStructure.Key(name);
        if (!await _db.Categories.AnyAsync(c => c.Id == body.CategoryId, ct)) throw new NotFoundException("Category");
        var subIds = (body.SubCategoryIds ?? new()).Distinct().ToList();
        if (await _db.SubCategories.CountAsync(s => subIds.Contains(s.Id) && s.CategoryId == body.CategoryId && s.IsActive, ct) != subIds.Count)
            throw new AppException("All Sub-Categories must be active and belong to this category.");
        if (await _db.ProductTypes.AnyAsync(t => t.CategoryId == body.CategoryId && t.Key == key && t.Id != (id ?? 0), ct)) throw new AppException("This Type already exists.");
        var row = id == null ? new ProductType { CreatedById = _me.Id } : await _db.ProductTypes.Include(t => t.SubCategories).SingleOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Type");
        if (id != null && await _db.Products.AnyAsync(p => p.ProductTypeId == id && (p.CategoryId != body.CategoryId || (p.SubCategoryId != null && !subIds.Contains(p.SubCategoryId.Value))), ct))
            throw new AppException("Existing products use these relationships. Reassign those products before removing a relationship or changing category.");
        row.CategoryId = body.CategoryId; row.Name = name; row.Key = key; row.SortOrder = body.SortOrder; row.IsActive = body.IsActive; row.UpdatedById = _me.Id;
        foreach (var link in row.SubCategories.Where(s => !subIds.Contains(s.SubCategoryId)).ToList()) row.SubCategories.Remove(link);
        foreach (var sub in subIds.Where(sub => !row.SubCategories.Any(s => s.SubCategoryId == sub))) row.SubCategories.Add(new ProductTypeSubCategory { SubCategoryId = sub });
        if (id == null) _db.ProductTypes.Add(row);
        await _db.SaveChangesAsync(ct);
        return new(row.Id, row.CategoryId, row.Name, row.SortOrder, row.IsActive, subIds);
    }

    [HttpGet("families"), Authorize(Policy = Permissions.CatalogView)]
    public async Task<List<FamilyDto>> Families([FromQuery] long? categoryId, [FromQuery] long? brandId, CancellationToken ct) => await _db.CatalogFamilies.AsNoTracking()
        .Where(f => (categoryId == null || f.CategoryId == categoryId) && (brandId == null || f.BrandId == brandId))
        .OrderBy(f => f.Name).Select(f => new FamilyDto(f.Id, f.CategoryId, f.BrandId, f.Key, f.Name, f.ImageUrl)).ToListAsync(ct);

    [HttpPost("families"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<FamilyDto> CreateFamily(FamilyInput body, CancellationToken ct) => SaveFamily(null, body, ct);
    [HttpPut("families/{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<FamilyDto> UpdateFamily(long id, FamilyInput body, CancellationToken ct) => SaveFamily(id, body, ct);
    private async Task<FamilyDto> SaveFamily(long? id, FamilyInput body, CancellationToken ct)
    {
        var name = CatalogStructure.Clean(body.Name, 200, "Family") ?? throw new AppException("Family name is required.");
        if (!await _db.Categories.AnyAsync(c => c.Id == body.CategoryId, ct) || !await _db.Brands.AnyAsync(b => b.Id == body.BrandId, ct)) throw new AppException("Choose a valid category and brand.");
        var key = CatalogStructure.Key(name);
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        if (_db.Database.IsNpgsql()) await _db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(24071001)", ct);
        var row = id == null ? await _db.CatalogFamilies.SingleOrDefaultAsync(f => f.CategoryId == body.CategoryId && f.BrandId == body.BrandId && (f.Key == key || f.Name.ToUpper() == key), ct)
            : await _db.CatalogFamilies.SingleOrDefaultAsync(f => f.Id == id, ct) ?? throw new NotFoundException("Family");
        if (row == null) { row = new CatalogFamily { Key = key, CreatedById = _me.Id }; _db.CatalogFamilies.Add(row); }
        if (row.Id != 0 && (row.CategoryId != body.CategoryId || row.BrandId != body.BrandId)) throw new AppException("A family's brand and category cannot change. Create a separate family.");
        if (await _db.CatalogFamilies.AnyAsync(f => f.Id != row.Id && f.CategoryId == body.CategoryId && f.BrandId == body.BrandId && (f.Key == key || f.Name.ToUpper() == key), ct))
            throw new AppException("Another family already uses this name or key in the selected brand.");
        row.CategoryId = body.CategoryId; row.BrandId = body.BrandId; row.Name = name; row.ImageUrl = CatalogStructure.ImageUrl(body.ImageUrl); row.UpdatedById = _me.Id;
        await _db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(row.Id, row.CategoryId, row.BrandId, row.Key, row.Name, row.ImageUrl);
    }
}
