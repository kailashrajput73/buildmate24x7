using BuildMate.Api.Infrastructure;
using BuildMate.Domain.Common;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using BuildMate.Services.Excel;
using BuildMate.Services.Files;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildMate.Api.Controllers.Admin;

[ApiController]
[Authorize(Policy = Policies.Staff)]
public abstract class AdminControllerBase : ControllerBase
{
    protected FileContentResult Xlsx(byte[] bytes, string name) => File(bytes, FileResults.Xlsx, FileResults.Stamp(name));
}

[Route("api/admin/categories")]
public class CategoriesController : AdminControllerBase
{
    private readonly ICatalogAdminService _svc;
    public CategoriesController(ICatalogAdminService svc) => _svc = svc;

    [HttpGet, Authorize(Policy = Permissions.CatalogView)]
    public Task<PagedResult<CategoryDto>> List([FromQuery] MasterQuery q, CancellationToken ct) => _svc.ListCategoriesAsync(q, ct);

    [HttpPost, Authorize(Policy = Permissions.CatalogManage)]
    public Task<CategoryDto> Create(CategoryUpsert dto, CancellationToken ct) => _svc.SaveCategoryAsync(null, dto, ct);

    [HttpPut("{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<CategoryDto> Update(long id, CategoryUpsert dto, CancellationToken ct) => _svc.SaveCategoryAsync(id, dto, ct);

    [HttpPost("{id:long}/active"), Authorize(Policy = Permissions.CatalogManage)]
    public async Task<IActionResult> Active(long id, [FromQuery] bool value, CancellationToken ct)
    {
        await _svc.SetCategoryActiveAsync(id, value, ct);
        return NoContent();
    }
}

[Route("api/admin/subcategories")]
public class SubCategoriesController : AdminControllerBase
{
    private readonly ICatalogAdminService _svc;
    private readonly IExcelService _excel;

    public SubCategoriesController(ICatalogAdminService svc, IExcelService excel)
    {
        _svc = svc;
        _excel = excel;
    }

    [HttpGet, Authorize(Policy = Permissions.CatalogView)]
    public Task<PagedResult<SubCategoryDto>> List([FromQuery] MasterQuery q, CancellationToken ct) => _svc.ListSubCategoriesAsync(q, ct);

    [HttpPost, Authorize(Policy = Permissions.CatalogManage)]
    public Task<SubCategoryDto> Create(SubCategoryUpsert dto, CancellationToken ct) => _svc.SaveSubCategoryAsync(null, dto, ct);

    [HttpPut("{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<SubCategoryDto> Update(long id, SubCategoryUpsert dto, CancellationToken ct) => _svc.SaveSubCategoryAsync(id, dto, ct);

    [HttpDelete("{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await _svc.DeleteSubCategoryAsync(id, ct);
        return NoContent();
    }

    [HttpGet("export"), Authorize(Policy = Permissions.CatalogView)]
    public async Task<FileContentResult> Export(CancellationToken ct)
    {
        var all = new List<SubCategoryDto>();
        for (var page = 1; ; page++)
        {
            var res = await _svc.ListSubCategoriesAsync(new MasterQuery(null, null, null, page, 200), ct);
            all.AddRange(res.Items);
            if (all.Count >= res.Total || res.Items.Count == 0) break;
        }
        return Xlsx(_excel.Export("SubCategories", all,
            new ExcelColumn<SubCategoryDto>("Category", r => r.CategoryName),
            new ExcelColumn<SubCategoryDto>("SubCategory", r => r.Name),
            new ExcelColumn<SubCategoryDto>("Sort Order", r => r.SortOrder),
            new ExcelColumn<SubCategoryDto>("Active", r => r.IsActive),
            new ExcelColumn<SubCategoryDto>("Products", r => r.ProductCount)), "subcategories");
    }

    [HttpGet("template"), Authorize(Policy = Permissions.CatalogView)]
    public FileContentResult Template() => Xlsx(_excel.Template("subcategories"), "subcategory-template");

    [HttpPost("import"), Authorize(Policy = Permissions.CatalogManage), RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ImportSummary> Import(IFormFile file, CancellationToken ct)
    {
        await using var s = file.OpenReadStream();
        return await _excel.ImportSubCategoriesAsync(s, ct);
    }
}

[Route("api/admin/brands")]
public class BrandsController : AdminControllerBase
{
    private readonly ICatalogAdminService _svc;
    public BrandsController(ICatalogAdminService svc) => _svc = svc;

    [HttpGet, Authorize(Policy = Permissions.CatalogView)]
    public Task<PagedResult<BrandDto>> List([FromQuery] MasterQuery q, CancellationToken ct) => _svc.ListBrandsAsync(q, ct);

    [HttpPost, Authorize(Policy = Permissions.CatalogManage)]
    public Task<BrandDto> Create(BrandUpsert dto, CancellationToken ct) => _svc.SaveBrandAsync(null, dto, ct);

    [HttpPut("{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<BrandDto> Update(long id, BrandUpsert dto, CancellationToken ct) => _svc.SaveBrandAsync(id, dto, ct);

    [HttpPost("{id:long}/active"), Authorize(Policy = Permissions.CatalogManage)]
    public async Task<IActionResult> Active(long id, [FromQuery] bool value, CancellationToken ct)
    {
        await _svc.SetBrandActiveAsync(id, value, ct);
        return NoContent();
    }
}

[Route("api/admin/products")]
public class ProductsController : AdminControllerBase
{
    private readonly ICatalogAdminService _svc;
    private readonly IExcelService _excel;
    private readonly IQrService _qr;

    public ProductsController(ICatalogAdminService svc, IExcelService excel, IQrService qr)
    {
        _svc = svc;
        _excel = excel;
        _qr = qr;
    }

    [HttpGet, Authorize(Policy = Permissions.CatalogView)]
    public Task<PagedResult<ProductAdminDto>> List([FromQuery] ProductAdminQuery q, CancellationToken ct) => _svc.ListProductsAsync(q, ct);

    [HttpGet("{id:long}"), Authorize(Policy = Permissions.CatalogView)]
    public Task<ProductAdminDto> Get(long id, CancellationToken ct) => _svc.GetProductAsync(id, ct);

    [HttpPost, Authorize(Policy = Permissions.CatalogManage)]
    public Task<ProductAdminDto> Create(ProductUpsert dto, CancellationToken ct) => _svc.SaveProductAsync(null, dto, ct);

    [HttpPut("{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<ProductAdminDto> Update(long id, ProductUpsert dto, CancellationToken ct) => _svc.SaveProductAsync(id, dto, ct);

    [HttpPost("{id:long}/active"), Authorize(Policy = Permissions.CatalogManage)]
    public async Task<IActionResult> Active(long id, [FromQuery] bool value, CancellationToken ct)
    {
        await _svc.SetProductActiveAsync(id, value, ct);
        return NoContent();
    }

    /// <summary>Resolves a scanned QR / barcode — used by dispatch and counter billing.</summary>
    [HttpGet("scan/{code}"), Authorize(Policy = Permissions.CatalogView)]
    public Task<ProductLookupDto> Scan(string code, CancellationToken ct) => _svc.LookupByScanAsync(code, ct);

    [HttpGet("lookup"), Authorize(Policy = Permissions.CatalogView)]
    public Task<List<ProductLookupDto>> Lookup([FromQuery] string q, [FromQuery] int take = 15, CancellationToken ct = default) => _svc.QuickSearchAsync(q, take, ct);

    [HttpGet("{id:long}/qr.png"), Authorize(Policy = Permissions.CatalogView)]
    public async Task<FileContentResult> Qr(long id, [FromQuery] int size = 10, CancellationToken ct = default)
    {
        var p = await _svc.GetProductAsync(id, ct);
        return File(_qr.Png(p.Code, size), "image/png", $"{p.Code}.png");
    }

    [HttpGet("export"), Authorize(Policy = Permissions.CatalogView)]
    public async Task<FileContentResult> Export([FromQuery] ProductAdminQuery q, CancellationToken ct)
    {
        var all = new List<ProductAdminDto>();
        for (var page = 1; ; page++)
        {
            var res = await _svc.ListProductsAsync(q with { Page = page, PageSize = 200 }, ct);
            all.AddRange(res.Items);
            if (all.Count >= res.Total || res.Items.Count == 0) break;
        }
        return Xlsx(_excel.Export("Products", all, ExcelService.ProductExportColumns()), "products");
    }

    [HttpGet("template"), Authorize(Policy = Permissions.CatalogView)]
    public FileContentResult Template() => Xlsx(_excel.Template("products"), "product-template");

    /// <summary>Bulk create/update. A Code already in the system updates that product; a new Code creates it under that code; blank Code gets an auto code.</summary>
    [HttpPost("import"), Authorize(Policy = Permissions.CatalogManage), RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<ImportSummary> Import(IFormFile file, [FromQuery] bool createMissingMasters = false, CancellationToken ct = default)
    {
        await using var s = file.OpenReadStream();
        return await _excel.ImportProductsAsync(s, createMissingMasters, ct);
    }
}

[Route("api/admin/product-groups")]
public class ProductGroupsController : AdminControllerBase
{
    private readonly ICatalogAdminService _svc;
    public ProductGroupsController(ICatalogAdminService svc) => _svc = svc;

    [HttpGet, Authorize(Policy = Permissions.CatalogView)]
    public Task<List<ProductGroupDto>> List([FromQuery] string? search, CancellationToken ct) => _svc.ListGroupsAsync(search, ct);

    [HttpPost, Authorize(Policy = Permissions.CatalogManage)]
    public Task<ProductGroupDto> Create(ProductGroupUpsert dto, CancellationToken ct) => _svc.SaveGroupAsync(null, dto, ct);

    [HttpPut("{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public Task<ProductGroupDto> Update(long id, ProductGroupUpsert dto, CancellationToken ct) => _svc.SaveGroupAsync(id, dto, ct);

    [HttpDelete("{id:long}"), Authorize(Policy = Permissions.CatalogManage)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await _svc.DeleteGroupAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Image uploads for products, categories, brands and banners.</summary>
[Route("api/admin/uploads")]
public class UploadsController : AdminControllerBase
{
    private readonly IFileStorage _files;
    public UploadsController(IFileStorage files) => _files = files;

    [HttpPost("image"), RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<object> Image(IFormFile file, [FromQuery] string folder = "images", CancellationToken ct = default)
    {
        var safeFolder = new string(folder.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray());
        var type = UploadRules.Validate(file.FileName, file.Length, 8 * 1024 * 1024);
        if (!type.StartsWith("image/")) throw new AppException("Upload an image (JPG, PNG or WEBP).");
        await using var s = file.OpenReadStream();
        var key = await _files.SaveAsync(s, file.FileName, type, string.IsNullOrEmpty(safeFolder) ? "images" : safeFolder, isPrivate: false, ct);
        return new { key, url = _files.PublicUrl(key) };
    }
}
