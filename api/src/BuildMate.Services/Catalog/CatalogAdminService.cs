using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Common;
using BuildMate.Services.Inventory;
using BuildMate.Services.Erp;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Catalog;

public interface ICatalogAdminService
{
    Task<PagedResult<CategoryDto>> ListCategoriesAsync(MasterQuery q, CancellationToken ct = default);
    Task<CategoryDto> SaveCategoryAsync(long? id, CategoryUpsert dto, CancellationToken ct = default);
    Task SetCategoryActiveAsync(long id, bool active, CancellationToken ct = default);

    Task<PagedResult<SubCategoryDto>> ListSubCategoriesAsync(MasterQuery q, CancellationToken ct = default);
    Task<SubCategoryDto> SaveSubCategoryAsync(long? id, SubCategoryUpsert dto, CancellationToken ct = default);
    Task DeleteSubCategoryAsync(long id, CancellationToken ct = default);

    Task<PagedResult<BrandDto>> ListBrandsAsync(MasterQuery q, CancellationToken ct = default);
    Task<BrandDto> SaveBrandAsync(long? id, BrandUpsert dto, CancellationToken ct = default);
    Task SetBrandActiveAsync(long id, bool active, CancellationToken ct = default);

    Task<PagedResult<ProductAdminDto>> ListProductsAsync(ProductAdminQuery q, CancellationToken ct = default);
    Task<ProductAdminDto> GetProductAsync(long id, CancellationToken ct = default);
    Task<ProductAdminDto> SaveProductAsync(long? id, ProductUpsert dto, CancellationToken ct = default);
    Task SetProductActiveAsync(long id, bool active, CancellationToken ct = default);
    Task<ProductLookupDto> LookupByScanAsync(string code, CancellationToken ct = default);
    Task<List<ProductLookupDto>> QuickSearchAsync(string q, int take, CancellationToken ct = default);
    Task<string> NextProductCodeAsync(CancellationToken ct = default);

    Task<List<ProductGroupDto>> ListGroupsAsync(string? search, CancellationToken ct = default);
    Task<ProductGroupDto> SaveGroupAsync(long? id, ProductGroupUpsert dto, CancellationToken ct = default);
    Task DeleteGroupAsync(long id, CancellationToken ct = default);
}

public class CatalogAdminService : ICatalogAdminService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;
    private readonly IOutbox _outbox;

    public CatalogAdminService(AppDbContext db, ICurrentUser me, IOutbox outbox)
    {
        _db = db;
        _me = me;
        _outbox = outbox;
    }

    // ------------------------------------------------------------------ Categories

    public async Task<PagedResult<CategoryDto>> ListCategoriesAsync(MasterQuery q, CancellationToken ct = default)
    {
        var query = _db.Categories.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(c => EF.Functions.ILike(c.Name, $"%{q.Search.Trim()}%"));
        if (q.IsActive != null) query = query.Where(c => c.IsActive == q.IsActive);
        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(c => c.SortOrder).ThenBy(c => c.Name).Page(page)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Description, c.ImageUrl, c.SortOrder, c.IsActive,
                c.Products.Count, c.SubCategories.Count))
            .ToListAsync(ct);
        return new PagedResult<CategoryDto>(items, total, page.SafePage, page.SafeSize);
    }

    public async Task<CategoryDto> SaveCategoryAsync(long? id, CategoryUpsert dto, CancellationToken ct = default)
    {
        var name = Required(dto.Name, "Category name");
        if (await _db.Categories.AnyAsync(c => c.Name.ToLower() == name.ToLower() && c.Id != (id ?? 0), ct))
            throw new AppException($"A category named \"{name}\" already exists.", 409, "duplicate");

        var c = id == null ? new Category { CreatedById = _me.Id } : await _db.Categories.FindAsync(new object[] { id.Value }, ct) ?? throw new NotFoundException("Category");
        c.Name = name;
        c.Description = dto.Description?.Trim();
        c.ImageUrl = dto.ImageUrl;
        c.SortOrder = dto.SortOrder;
        c.IsActive = dto.IsActive;
        c.UpdatedById = _me.Id;
        if (id == null) _db.Categories.Add(c);
        await _db.SaveChangesAsync(ct);
        return await _db.Categories.AsNoTracking().Where(x => x.Id == c.Id)
            .Select(x => new CategoryDto(x.Id, x.Name, x.Description, x.ImageUrl, x.SortOrder, x.IsActive, x.Products.Count, x.SubCategories.Count))
            .FirstAsync(ct);
    }

    public async Task SetCategoryActiveAsync(long id, bool active, CancellationToken ct = default)
    {
        var c = await _db.Categories.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Category");
        c.IsActive = active;
        c.UpdatedById = _me.Id;
        await _db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------------ Sub categories

    public async Task<PagedResult<SubCategoryDto>> ListSubCategoriesAsync(MasterQuery q, CancellationToken ct = default)
    {
        var query = _db.SubCategories.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(s => EF.Functions.ILike(s.Name, $"%{q.Search.Trim()}%"));
        if (q.CategoryId != null) query = query.Where(s => s.CategoryId == q.CategoryId);
        if (q.IsActive != null) query = query.Where(s => s.IsActive == q.IsActive);
        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(s => s.Category.Name).ThenBy(s => s.SortOrder).ThenBy(s => s.Name).Page(page)
            .Select(s => new SubCategoryDto(s.Id, s.CategoryId, s.Category.Name, s.Name, s.SortOrder, s.IsActive, s.Products.Count))
            .ToListAsync(ct);
        return new PagedResult<SubCategoryDto>(items, total, page.SafePage, page.SafeSize);
    }

    public async Task<SubCategoryDto> SaveSubCategoryAsync(long? id, SubCategoryUpsert dto, CancellationToken ct = default)
    {
        var name = Required(dto.Name, "Sub category name");
        if (!await _db.Categories.AnyAsync(c => c.Id == dto.CategoryId, ct)) throw new NotFoundException("Category");
        if (await _db.SubCategories.AnyAsync(s => s.CategoryId == dto.CategoryId && s.Name.ToLower() == name.ToLower() && s.Id != (id ?? 0), ct))
            throw new AppException($"\"{name}\" already exists in this category.", 409, "duplicate");

        var s = id == null ? new SubCategory { CreatedById = _me.Id } : await _db.SubCategories.FindAsync(new object[] { id.Value }, ct) ?? throw new NotFoundException("Sub category");
        s.CategoryId = dto.CategoryId;
        s.Name = name;
        s.SortOrder = dto.SortOrder;
        s.IsActive = dto.IsActive;
        s.UpdatedById = _me.Id;
        if (id == null) _db.SubCategories.Add(s);
        await _db.SaveChangesAsync(ct);
        return await _db.SubCategories.AsNoTracking().Where(x => x.Id == s.Id)
            .Select(x => new SubCategoryDto(x.Id, x.CategoryId, x.Category.Name, x.Name, x.SortOrder, x.IsActive, x.Products.Count))
            .FirstAsync(ct);
    }

    public async Task DeleteSubCategoryAsync(long id, CancellationToken ct = default)
    {
        var s = await _db.SubCategories.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Sub category");
        if (await _db.Products.AnyAsync(p => p.SubCategoryId == id, ct))
            throw new AppException("This sub category has products. Deactivate it instead, or move the products first.", 409, "in_use");
        _db.SubCategories.Remove(s);
        await _db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------------ Brands

    public async Task<PagedResult<BrandDto>> ListBrandsAsync(MasterQuery q, CancellationToken ct = default)
    {
        var query = _db.Brands.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(b => EF.Functions.ILike(b.Name, $"%{q.Search.Trim()}%"));
        if (q.IsActive != null) query = query.Where(b => b.IsActive == q.IsActive);
        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(b => b.SortOrder).ThenBy(b => b.Name).Page(page)
            .Select(b => new BrandDto(b.Id, b.Name, b.LogoUrl, b.SortOrder, b.IsActive, b.Products.Count))
            .ToListAsync(ct);
        return new PagedResult<BrandDto>(items, total, page.SafePage, page.SafeSize);
    }

    public async Task<BrandDto> SaveBrandAsync(long? id, BrandUpsert dto, CancellationToken ct = default)
    {
        var name = Required(dto.Name, "Brand name");
        if (await _db.Brands.AnyAsync(b => b.Name.ToLower() == name.ToLower() && b.Id != (id ?? 0), ct))
            throw new AppException($"A brand named \"{name}\" already exists.", 409, "duplicate");
        var b = id == null ? new Brand { CreatedById = _me.Id } : await _db.Brands.FindAsync(new object[] { id.Value }, ct) ?? throw new NotFoundException("Brand");
        b.Name = name;
        b.LogoUrl = dto.LogoUrl;
        b.SortOrder = dto.SortOrder;
        b.IsActive = dto.IsActive;
        b.UpdatedById = _me.Id;
        if (id == null) _db.Brands.Add(b);
        await _db.SaveChangesAsync(ct);
        return new BrandDto(b.Id, b.Name, b.LogoUrl, b.SortOrder, b.IsActive, await _db.Products.CountAsync(p => p.BrandId == b.Id, ct));
    }

    public async Task SetBrandActiveAsync(long id, bool active, CancellationToken ct = default)
    {
        var b = await _db.Brands.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Brand");
        b.IsActive = active;
        b.UpdatedById = _me.Id;
        await _db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------------ Products

    private IQueryable<Product> ProductQuery() => _db.Products.AsNoTracking()
        .Include(p => p.Category).Include(p => p.SubCategory).Include(p => p.Brand).Include(p => p.ProductType).Include(p => p.CatalogFamily)
        .Include(p => p.Aliases).Include(p => p.Translations).Include(p => p.GroupItems)
        .Include(p => p.Locations).ThenInclude(l => l.RackLocation)
        .AsSplitQuery();

    public async Task<PagedResult<ProductAdminDto>> ListProductsAsync(ProductAdminQuery q, CancellationToken ct = default)
    {
        var query = CatalogStructure.Filter(ProductQuery(), q.TypeId, q.Class, q.FamilyId, q.Size, q.Length);
        if (q.Ids != null)
        {
            var parts = q.Ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length == 0 || parts.Length > 5000 || parts.Any(s => !long.TryParse(s, out var id) || id <= 0)) throw new AppException("Select between 1 and 5000 valid product identifiers.");
            var ids = parts.Select(long.Parse).Distinct().ToList();
            query = query.Where(p => ids.Contains(p.Id));
        }
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = $"%{q.Search.Trim()}%";
            query = query.Where(p => EF.Functions.ILike(p.Name, s) || EF.Functions.ILike(p.Code, s) || p.Barcode == q.Search.Trim()
                                     || p.Aliases.Any(a => EF.Functions.ILike(a.Alias, s))
                                     || p.Translations.Any(t => EF.Functions.ILike(t.Name, s)));
        }
        if (q.CategoryId != null) query = query.Where(p => p.CategoryId == q.CategoryId);
        if (q.SubCategoryId != null) query = query.Where(p => p.SubCategoryId == q.SubCategoryId);
        if (q.BrandId != null) query = query.Where(p => p.BrandId == q.BrandId);
        if (q.GroupId != null) query = query.Where(p => p.GroupItems.Any(g => g.ProductGroupId == q.GroupId));
        if (q.IsActive != null) query = query.Where(p => p.IsActive == q.IsActive);
        if (q.LowStockOnly == true) query = query.Where(p => p.StockQty <= p.ReorderLevel);
        if (q.Movement != null) query = query.WhereMovement(q.Movement.Value, Clock.TodayIst);
        if (q.NeverDispatched != null) query = query.Where(p => (p.LastDispatchedAt == null) == q.NeverDispatched);

        query = q.Sort switch
        {
            "name" => query.OrderBy(p => p.Name),
            "code" => query.OrderBy(p => p.Code),
            "stock" => query.OrderBy(p => p.StockQty),
            "price" => query.OrderBy(p => p.ListPrice),
            "newest" => query.OrderByDescending(p => p.Id),
            _ => query.OrderBy(p => p.Sequence).ThenBy(p => p.Name)
        };

        var page = new PageRequest(q.Page, q.PageSize);
        var total = await query.CountAsync(ct);
        var rows = await query.Page(page).ToListAsync(ct);
        return new PagedResult<ProductAdminDto>(rows.Select(ToAdminDto).ToList(), total, page.SafePage, page.SafeSize);
    }

    public async Task<ProductAdminDto> GetProductAsync(long id, CancellationToken ct = default) =>
        ToAdminDto(await ProductQuery().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Product"));

    public async Task<string> NextProductCodeAsync(CancellationToken ct = default) =>
        $"BM{await _db.NextSequenceValueAsync(Sequences.ProductCode, ct):D6}";

    public async Task<ProductAdminDto> SaveProductAsync(long? id, ProductUpsert dto, CancellationToken ct = default)
    {
        Validate(dto);
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        // Serialize catalogue family upserts across concurrent imports/admin edits.
        if (_db.Database.IsNpgsql()) await _db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(24071001)", ct);
        if (!await _db.Categories.AnyAsync(c => c.Id == dto.CategoryId, ct)) throw new NotFoundException("Category");
        if (!await _db.Brands.AnyAsync(b => b.Id == dto.BrandId, ct)) throw new NotFoundException("Brand");
        if (dto.SubCategoryId != null && !await _db.SubCategories.AnyAsync(s => s.Id == dto.SubCategoryId && s.CategoryId == dto.CategoryId, ct))
            throw new AppException("Sub category does not belong to the selected category.");
        var barcode = string.IsNullOrWhiteSpace(dto.Barcode) ? null : dto.Barcode.Trim();
        if (barcode != null && await _db.Products.AnyAsync(p => p.Barcode == barcode && p.Id != (id ?? 0), ct))
            throw new AppException($"Barcode {barcode} is already used by another product.", 409, "duplicate");

        Product p;
        if (id == null)
        {
            p = new Product { Code = await NextProductCodeAsync(ct), CreatedById = _me.Id };
            _db.Products.Add(p);
        }
        else
        {
            p = await _db.Products.Include(x => x.Aliases).Include(x => x.Translations).Include(x => x.GroupItems)
                .FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Product");
        }

        p.Name = dto.Name.Trim();
        p.Description = dto.Description?.Trim();
        p.CategoryId = dto.CategoryId;
        p.SubCategoryId = dto.SubCategoryId;
        p.BrandId = dto.BrandId;
        p.Barcode = barcode;
        p.Unit = string.IsNullOrWhiteSpace(dto.Unit) ? "pcs" : dto.Unit.Trim();
        p.HsnCode = dto.HsnCode?.Trim();
        p.GstRate = dto.GstRate;
        p.Mrp = dto.Mrp;
        p.ListPrice = dto.ListPrice;
        p.PartnerDiscountPercent = dto.PartnerDiscountPercent;
        p.RetailDiscountPercent = dto.RetailDiscountPercent;
        p.RewardPointsPerUnit = dto.RewardPointsPerUnit;
        p.ReorderLevel = dto.ReorderLevel;
        p.Sequence = dto.Sequence;
        p.ImageUrls = dto.ImageUrls?.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct().ToList() ?? new();
        p.VariantFamily = string.IsNullOrWhiteSpace(dto.VariantFamily) ? null : dto.VariantFamily.Trim();
        p.VariantLabel = string.IsNullOrWhiteSpace(dto.VariantLabel) ? null : dto.VariantLabel.Trim();
        p.Specs = dto.Specs?.Select(x => x.Trim()).Where(x => x.Contains(':')).ToList() ?? new();
        if (dto.Catalog != null) await CatalogStructure.ApplyAsync(_db, p, dto.Catalog, ct);
        else if (p.CatalogFamilyId != null && await _db.CatalogFamilies.AnyAsync(f => f.Id == p.CatalogFamilyId && (f.BrandId != p.BrandId || f.CategoryId != p.CategoryId), ct))
            throw new AppException("Choose a family belonging to the new brand/category.");
        if (p.ProductTypeId != null && !await _db.ProductTypes.AnyAsync(t => t.Id == p.ProductTypeId && t.CategoryId == p.CategoryId && (p.SubCategoryId == null || t.SubCategories.Any(s => s.SubCategoryId == p.SubCategoryId)), ct))
            throw new AppException("The existing Type does not support this category/sub-category. Update the structured catalog fields.");
        Packaging.Validate(p);
        p.ImageUrls = p.ImageUrls.Select(u => CatalogStructure.ImageUrl(u)!).ToList();
        p.IsActive = dto.IsActive;
        p.ShowOnWeb = dto.ShowOnWeb;
        p.ShowOnApp = dto.ShowOnApp;
        p.UpdatedById = _me.Id;

        SyncAliases(p, dto.Aliases);
        SyncTranslations(p, dto.Translations);
        await SyncGroupsAsync(p, dto.GroupIds, ct);

        await _db.SaveChangesAsync(ct);
        _outbox.Add(ErpEvents.ProductUpserted, new { p.Id, p.Code, p.Name, p.HsnCode, p.GstRate, p.Mrp, p.ListPrice, p.Unit, p.Barcode, p.IsActive });
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetProductAsync(p.Id, ct);
    }

    public async Task SetProductActiveAsync(long id, bool active, CancellationToken ct = default)
    {
        var p = await _db.Products.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Product");
        p.IsActive = active;
        p.UpdatedById = _me.Id;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Resolves a scanned QR (our product code) or manufacturer barcode.</summary>
    public async Task<ProductLookupDto> LookupByScanAsync(string code, CancellationToken ct = default)
    {
        var c = (code ?? "").Trim();
        var p = await LookupQuery().FirstOrDefaultAsync(x => x.Code == c.ToUpper() || x.Barcode == c, ct)
                ?? throw new NotFoundException($"Product for code {c}");
        return ToLookup(p);
    }

    public async Task<List<ProductLookupDto>> QuickSearchAsync(string q, int take, CancellationToken ct = default)
    {
        var s = $"%{(q ?? "").Trim()}%";
        var rows = await LookupQuery()
            .Where(p => p.IsActive && (EF.Functions.ILike(p.Name, s) || EF.Functions.ILike(p.Code, s) || p.Barcode == q
                        || p.Aliases.Any(a => EF.Functions.ILike(a.Alias, s))))
            .OrderBy(p => p.Name).Take(Math.Clamp(take, 1, 50)).ToListAsync(ct);
        return rows.Select(ToLookup).ToList();
    }

    private IQueryable<Product> LookupQuery() => _db.Products.AsNoTracking()
        .Include(p => p.Brand).Include(p => p.CatalogFamily).Include(p => p.Locations).ThenInclude(l => l.RackLocation);

    private static ProductLookupDto ToLookup(Product p) => new(
        p.Id, p.Code, p.Name, p.Brand.Name, p.Unit, p.ListPrice, p.PartnerDiscountPercent, p.RetailDiscountPercent,
        p.GstRate, p.AvailableQty, p.StockQty, CatalogStructure.Image(p),
        p.Locations.Select(l => l.RackLocation.Label).OrderBy(x => x).ToList());

    // ------------------------------------------------------------------ Groups

    public async Task<List<ProductGroupDto>> ListGroupsAsync(string? search, CancellationToken ct = default)
    {
        var q = _db.ProductGroups.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(g => EF.Functions.ILike(g.Name, $"%{search.Trim()}%"));
        return await q.OrderBy(g => g.SortOrder).ThenBy(g => g.Name)
            .Select(g => new ProductGroupDto(g.Id, g.Name, g.Description, g.ImageUrl, g.SortOrder, g.IsActive, g.Items.Count,
                g.Items.OrderBy(i => i.SortOrder).Select(i => i.ProductId).ToList()))
            .ToListAsync(ct);
    }

    public async Task<ProductGroupDto> SaveGroupAsync(long? id, ProductGroupUpsert dto, CancellationToken ct = default)
    {
        var name = Required(dto.Name, "Group name");
        var ids = (dto.ProductIds ?? new()).Distinct().ToList();
        if (ids.Count < 2) throw new AppException("A product group needs at least two products.");
        if (await _db.ProductGroups.AnyAsync(g => g.Name.ToLower() == name.ToLower() && g.Id != (id ?? 0), ct))
            throw new AppException($"A group named \"{name}\" already exists.", 409, "duplicate");
        var existing = await _db.Products.Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync(ct);
        if (existing.Count != ids.Count) throw new AppException("Some selected products no longer exist.");

        var g = id == null ? new ProductGroup { CreatedById = _me.Id }
            : await _db.ProductGroups.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Product group");
        g.Name = name;
        g.Description = dto.Description?.Trim();
        g.ImageUrl = dto.ImageUrl;
        g.SortOrder = dto.SortOrder;
        g.IsActive = dto.IsActive;
        g.UpdatedById = _me.Id;
        g.Items.Clear();
        for (var i = 0; i < ids.Count; i++) g.Items.Add(new ProductGroupItem { ProductId = ids[i], SortOrder = i });
        if (id == null) _db.ProductGroups.Add(g);
        await _db.SaveChangesAsync(ct);
        return (await ListGroupsAsync(null, ct)).First(x => x.Id == g.Id);
    }

    public async Task DeleteGroupAsync(long id, CancellationToken ct = default)
    {
        var g = await _db.ProductGroups.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Product group");
        _db.ProductGroups.Remove(g);
        await _db.SaveChangesAsync(ct);
    }

    // ------------------------------------------------------------------ helpers

    private static string Required(string? v, string label) =>
        string.IsNullOrWhiteSpace(v) ? throw new AppException($"{label} is required.") : v.Trim();

    private static void Validate(ProductUpsert d)
    {
        Required(d.Name, "Product name");
        if (d.ListPrice <= 0) throw new AppException("List price must be greater than zero.");
        if (d.Mrp > 0 && d.ListPrice > d.Mrp) throw new AppException("List price cannot be higher than MRP.");
        foreach (var (v, label) in new[] { (d.PartnerDiscountPercent, "Partner discount"), (d.RetailDiscountPercent, "Retail discount") })
            if (v is < 0 or > 90) throw new AppException($"{label} must be between 0 and 90%.");
        if (d.GstRate is not (0 or 0.25m or 3 or 5 or 12 or 18 or 28)) throw new AppException("GST rate must be a valid Indian GST slab.");
        if (d.ReorderLevel < 0 || d.RewardPointsPerUnit < 0) throw new AppException("Reorder level and reward points cannot be negative.");
    }

    private static void SyncAliases(Product p, List<string>? aliases)
    {
        var wanted = (aliases ?? new()).Select(a => a.Trim()).Where(a => a.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        foreach (var a in p.Aliases.Where(a => !wanted.Contains(a.Alias, StringComparer.OrdinalIgnoreCase)).ToList()) p.Aliases.Remove(a);
        foreach (var a in wanted.Where(w => !p.Aliases.Any(x => x.Alias.Equals(w, StringComparison.OrdinalIgnoreCase))))
            p.Aliases.Add(new ProductAlias { Alias = a });
    }

    private static void SyncTranslations(Product p, Dictionary<string, string>? tr)
    {
        var wanted = (tr ?? new()).Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
            .ToDictionary(kv => kv.Key.Trim().ToLowerInvariant(), kv => kv.Value.Trim());
        foreach (var t in p.Translations.Where(t => !wanted.ContainsKey(t.LanguageCode)).ToList()) p.Translations.Remove(t);
        foreach (var (lang, name) in wanted)
        {
            var existing = p.Translations.FirstOrDefault(t => t.LanguageCode == lang);
            if (existing == null) p.Translations.Add(new ProductTranslation { LanguageCode = lang, Name = name });
            else existing.Name = name;
        }
    }

    private async Task SyncGroupsAsync(Product p, List<long>? groupIds, CancellationToken ct)
    {
        if (groupIds == null) return;
        var wanted = groupIds.Distinct().ToList();
        var valid = await _db.ProductGroups.Where(g => wanted.Contains(g.Id)).Select(g => g.Id).ToListAsync(ct);
        foreach (var gi in p.GroupItems.Where(gi => !valid.Contains(gi.ProductGroupId)).ToList()) p.GroupItems.Remove(gi);
        foreach (var gid in valid.Where(v => p.GroupItems.All(gi => gi.ProductGroupId != v)))
            p.GroupItems.Add(new ProductGroupItem { ProductGroupId = gid, SortOrder = 999 });
    }

    internal static ProductAdminDto ToAdminDto(Product p) => new(
        p.Id, p.Code, p.Name, p.Description,
        p.CategoryId, p.Category.Name, p.SubCategoryId, p.SubCategory?.Name, p.BrandId, p.Brand.Name,
        p.Barcode, p.Unit, p.HsnCode, p.GstRate,
        p.Mrp, p.ListPrice, p.PartnerDiscountPercent, p.RetailDiscountPercent,
        Pricing.UnitPrice(p, CustomerKind.Partner), Pricing.UnitPrice(p, CustomerKind.Retail), p.RewardPointsPerUnit,
        p.ReorderLevel, p.Sequence, p.StockQty, p.ReservedQty, p.AvailableQty, p.AverageCost,
        p.StockQty <= p.ReorderLevel, p.ImageUrls, p.IsActive, p.ShowOnWeb, p.ShowOnApp,
        p.Aliases.Select(a => a.Alias).OrderBy(a => a).ToList(),
        p.Translations.ToDictionary(t => t.LanguageCode, t => t.Name),
        p.GroupItems.Select(g => g.ProductGroupId).ToList(),
        p.Locations.Select(l => l.RackLocation.Label).OrderBy(x => x).ToList(),
        p.CreatedAt, p.UpdatedAt,
        p.CatalogFamily?.Name ?? p.VariantFamily, p.VariantLabel, p.Specs,
        Movement(p).Category, Movement(p).DaysSinceMovement, p.LastDispatchedAt == null, p.LastDispatchedAt, CatalogStructure.Fields(p));

    private static MovementInfo Movement(Product p) => ProductMovement.Classify(p, Clock.TodayIst);
}
