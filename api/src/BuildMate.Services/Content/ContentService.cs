using BuildMate.Data;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Catalog;
using BuildMate.Services.Common;
using Microsoft.EntityFrameworkCore;

namespace BuildMate.Services.Content;

public record BannerUpsert(string Title, string? Subtitle, string ImageUrl, string? MobileImageUrl, BannerLinkType LinkType,
    string? LinkValue, ContentPlacement Placement, int SortOrder, bool IsActive, DateTime? StartsAt, DateTime? EndsAt);

public record BannerDto(long Id, string Title, string? Subtitle, string ImageUrl, string? MobileImageUrl, BannerLinkType LinkType,
    string? LinkValue, ContentPlacement Placement, int SortOrder, bool IsActive, DateTime? StartsAt, DateTime? EndsAt);

public record HomeSectionUpsert(string Title, HomeSectionType Type, long? ReferenceId, int MaxItems, ContentPlacement Placement, int SortOrder, bool IsActive);

public record HomeSectionDto(long Id, string Title, HomeSectionType Type, long? ReferenceId, string? ReferenceName, int MaxItems,
    ContentPlacement Placement, int SortOrder, bool IsActive);

public record HomeFeedSection(long Id, string Title, HomeSectionType Type, long? ReferenceId, List<ProductCardDto> Products);

public record HomeFeedDto(List<BannerDto> Banners, List<CategoryTreeDto> Categories, List<BrandRefDto> Brands,
    List<HomeFeedSection> Sections, StorePublicInfo Store);

public record StorePublicInfo(string StoreName, string SupportPhone, string? WhatsAppNumber, string? SupportEmail, string Address,
    string OpeningHours, decimal MinOrderValue, decimal DeliveryFee, decimal FreeDeliveryAbove,
    bool HomeDeliveryEnabled, bool StorePickupEnabled, List<string> SupportedLanguages,
    string? AndroidAppUrl, string? IosAppUrl, string? MinAppVersion);

public interface IContentService
{
    Task<List<BannerDto>> BannersAsync(CancellationToken ct = default);
    Task<BannerDto> SaveBannerAsync(long? id, BannerUpsert dto, CancellationToken ct = default);
    Task DeleteBannerAsync(long id, CancellationToken ct = default);
    Task<List<HomeSectionDto>> SectionsAsync(CancellationToken ct = default);
    Task<HomeSectionDto> SaveSectionAsync(long? id, HomeSectionUpsert dto, CancellationToken ct = default);
    Task DeleteSectionAsync(long id, CancellationToken ct = default);
    Task<HomeFeedDto> HomeFeedAsync(Viewer v, CancellationToken ct = default);
    Task<StorePublicInfo> StoreInfoAsync(CancellationToken ct = default);
}

public class ContentService : IContentService
{
    private readonly AppDbContext _db;
    private readonly ICatalogService _catalog;
    private readonly ISettingsService _settings;
    private readonly ICurrentUser _me;

    public ContentService(AppDbContext db, ICatalogService catalog, ISettingsService settings, ICurrentUser me)
    {
        _db = db;
        _catalog = catalog;
        _settings = settings;
        _me = me;
    }

    private static BannerDto ToDto(Banner b) => new(b.Id, b.Title, b.Subtitle, b.ImageUrl, b.MobileImageUrl, b.LinkType, b.LinkValue,
        b.Placement, b.SortOrder, b.IsActive, b.StartsAt, b.EndsAt);

    public async Task<List<BannerDto>> BannersAsync(CancellationToken ct = default) =>
        (await _db.Banners.AsNoTracking().OrderBy(b => b.SortOrder).ThenByDescending(b => b.Id).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<BannerDto> SaveBannerAsync(long? id, BannerUpsert dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Title)) throw new AppException("Banner title is required.");
        if (string.IsNullOrWhiteSpace(dto.ImageUrl)) throw new AppException("Upload a banner image.");
        if (dto.LinkType != BannerLinkType.None && string.IsNullOrWhiteSpace(dto.LinkValue)) throw new AppException("Choose where the banner links to.");
        if (dto.StartsAt != null && dto.EndsAt != null && dto.EndsAt <= dto.StartsAt) throw new AppException("End date must be after the start date.");

        var b = id == null ? new Banner { CreatedById = _me.Id } : await _db.Banners.FindAsync(new object[] { id.Value }, ct) ?? throw new NotFoundException("Banner");
        b.Title = dto.Title.Trim();
        b.Subtitle = dto.Subtitle?.Trim();
        b.ImageUrl = dto.ImageUrl;
        b.MobileImageUrl = dto.MobileImageUrl;
        b.LinkType = dto.LinkType;
        b.LinkValue = dto.LinkValue?.Trim();
        b.Placement = dto.Placement;
        b.SortOrder = dto.SortOrder;
        b.IsActive = dto.IsActive;
        b.StartsAt = dto.StartsAt;
        b.EndsAt = dto.EndsAt;
        b.UpdatedById = _me.Id;
        if (id == null) _db.Banners.Add(b);
        await _db.SaveChangesAsync(ct);
        return ToDto(b);
    }

    public async Task DeleteBannerAsync(long id, CancellationToken ct = default)
    {
        var b = await _db.Banners.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Banner");
        _db.Banners.Remove(b);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<HomeSectionDto>> SectionsAsync(CancellationToken ct = default)
    {
        var rows = await _db.HomeSections.AsNoTracking().OrderBy(s => s.SortOrder).ToListAsync(ct);
        var groupNames = await _db.ProductGroups.AsNoTracking().ToDictionaryAsync(g => g.Id, g => g.Name, ct);
        var catNames = await _db.Categories.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var brandNames = await _db.Brands.AsNoTracking().ToDictionaryAsync(b => b.Id, b => b.Name, ct);
        return rows.Select(s => new HomeSectionDto(s.Id, s.Title, s.Type, s.ReferenceId,
            s.ReferenceId == null ? null : s.Type switch
            {
                HomeSectionType.ProductGroup => groupNames.GetValueOrDefault(s.ReferenceId.Value),
                HomeSectionType.Category => catNames.GetValueOrDefault(s.ReferenceId.Value),
                HomeSectionType.Brand => brandNames.GetValueOrDefault(s.ReferenceId.Value),
                _ => null
            }, s.MaxItems, s.Placement, s.SortOrder, s.IsActive)).ToList();
    }

    public async Task<HomeSectionDto> SaveSectionAsync(long? id, HomeSectionUpsert dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Title)) throw new AppException("Section title is required.");
        var needsRef = dto.Type is HomeSectionType.ProductGroup or HomeSectionType.Category or HomeSectionType.Brand;
        if (needsRef && dto.ReferenceId == null) throw new AppException("Choose which group, category or brand to show.");
        var s = id == null ? new HomeSection { CreatedById = _me.Id } : await _db.HomeSections.FindAsync(new object[] { id.Value }, ct) ?? throw new NotFoundException("Section");
        s.Title = dto.Title.Trim();
        s.Type = dto.Type;
        s.ReferenceId = needsRef ? dto.ReferenceId : null;
        s.MaxItems = Math.Clamp(dto.MaxItems, 4, 24);
        s.Placement = dto.Placement;
        s.SortOrder = dto.SortOrder;
        s.IsActive = dto.IsActive;
        s.UpdatedById = _me.Id;
        if (id == null) _db.HomeSections.Add(s);
        await _db.SaveChangesAsync(ct);
        return (await SectionsAsync(ct)).First(x => x.Id == s.Id);
    }

    public async Task DeleteSectionAsync(long id, CancellationToken ct = default)
    {
        var s = await _db.HomeSections.FindAsync(new object[] { id }, ct) ?? throw new NotFoundException("Section");
        _db.HomeSections.Remove(s);
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Everything a home screen needs in one call — same feed for web and app, filtered by placement.</summary>
    public async Task<HomeFeedDto> HomeFeedAsync(Viewer v, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var placement = v.Channel == ClientChannel.Web ? ContentPlacement.Web : ContentPlacement.App;

        var banners = await _db.Banners.AsNoTracking()
            .Where(b => b.IsActive && (b.Placement == placement || b.Placement == ContentPlacement.Both)
                        && (b.StartsAt == null || b.StartsAt <= now) && (b.EndsAt == null || b.EndsAt > now))
            .OrderBy(b => b.SortOrder).ToListAsync(ct);

        var sections = await _db.HomeSections.AsNoTracking()
            .Where(s => s.IsActive && (s.Placement == placement || s.Placement == ContentPlacement.Both))
            .OrderBy(s => s.SortOrder).ToListAsync(ct);

        var feed = new List<HomeFeedSection>();
        foreach (var s in sections)
        {
            var q = new CatalogQuery(null, null, null, null, null, null, null, null, 1, s.MaxItems, Collapse: true);
            q = s.Type switch
            {
                HomeSectionType.ProductGroup => q with { GroupId = s.ReferenceId },
                HomeSectionType.Category => q with { CategoryId = s.ReferenceId },
                HomeSectionType.Brand => q with { BrandId = s.ReferenceId },
                HomeSectionType.NewArrivals => q with { Sort = "newest" },
                HomeSectionType.Discounted => q with { Discounted = true },
                _ => q
            };
            var products = await _catalog.SearchAsync(q, v, ct);
            if (products.Items.Count > 0)
                feed.Add(new HomeFeedSection(s.Id, s.Title, s.Type, s.ReferenceId, products.Items.ToList()));
        }

        return new HomeFeedDto(banners.Select(ToDto).ToList(), await _catalog.CategoriesAsync(v, ct), await _catalog.BrandsAsync(ct),
            feed, await StoreInfoAsync(ct));
    }

    public async Task<StorePublicInfo> StoreInfoAsync(CancellationToken ct = default)
    {
        var s = await _settings.GetAsync(ct);
        return new StorePublicInfo(s.StoreName, s.SupportPhone, s.WhatsAppNumber, s.SupportEmail,
            string.Join(", ", new[] { s.AddressLine, s.City, s.State, s.Pincode }.Where(x => !string.IsNullOrWhiteSpace(x))),
            s.OpeningHours, s.MinOrderValue, s.DeliveryFee, s.FreeDeliveryAbove, s.HomeDeliveryEnabled, s.StorePickupEnabled,
            s.SupportedLanguages, s.AndroidAppUrl, s.IosAppUrl, s.MinAppVersion);
    }
}
