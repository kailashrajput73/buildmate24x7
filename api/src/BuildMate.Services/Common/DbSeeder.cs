using BuildMate.Data;
using BuildMate.Domain.Common;
using BuildMate.Domain.Entities;
using BuildMate.Domain.Enums;
using BuildMate.Services.Content;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BuildMate.Services.Common;

public class SeedOptions
{
    public string AdminEmail { get; set; } = "admin@buildmate24x7.in";
    /// <summary>Initial admin password. Required on first run; change it after logging in.</summary>
    public string? AdminPassword { get; set; }
    /// <summary>Loads a demo catalogue (categories, brands, ~40 products, opening stock, banners).</summary>
    public bool DemoData { get; set; }
}

/// <summary>Idempotent first-run setup: roles, the first admin, default settings and optional demo data.</summary>
public class DbSeeder
{
    private readonly AppDbContext _db;
    private readonly ISettingsService _settings;
    private readonly SeedOptions _opt;
    private readonly ILogger<DbSeeder> _log;

    public DbSeeder(AppDbContext db, ISettingsService settings, IOptions<SeedOptions> opt, ILogger<DbSeeder> log)
    {
        _db = db;
        _settings = settings;
        _opt = opt.Value;
        _log = log;
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        await SeedRolesAsync(ct);
        await SeedAdminAsync(ct);
        if (!await _db.Settings.AnyAsync(ct)) await _settings.SaveAsync(new StoreSettings(), ct);
        if (_opt.DemoData && !await _db.Products.AnyAsync(ct)) await SeedDemoAsync(ct);
    }

    private async Task SeedRolesAsync(CancellationToken ct)
    {
        var roles = new (string Name, string Desc, string[] Perms, bool System)[]
        {
            ("Administrator", "Full access", new[] { Permissions.All }, true),
            ("Store Manager", "Runs the store: orders, dispatch, counter billing, stock, partners",
                new[] { Permissions.DashboardView, Permissions.CatalogView, Permissions.CatalogManage, Permissions.PurchasesManage, Permissions.StockView,
                    Permissions.StockAdjust, Permissions.RacksManage, Permissions.PartnersView, Permissions.PartnersManage, Permissions.KycApprove,
                    Permissions.OrdersView, Permissions.OrdersManage, Permissions.OrdersSpecialDiscount, Permissions.DispatchManage,
                    Permissions.CounterBilling, Permissions.ServiceRequestsManage, Permissions.ReportsView, Permissions.RewardsAdjust }, false),
            ("Sales Manager", "Manages assigned referral partners",
                new[] { Permissions.DashboardView, Permissions.CatalogView, Permissions.PartnersView, Permissions.PartnersManage,
                    Permissions.OrdersView, Permissions.ServiceRequestsManage, Permissions.ReportsView }, false),
            ("Warehouse", "Purchases, racks, stock and dispatch",
                new[] { Permissions.CatalogView, Permissions.PurchasesManage, Permissions.StockView, Permissions.RacksManage,
                    Permissions.OrdersView, Permissions.DispatchManage }, false),
            ("Counter Staff", "Walk-in billing and pickups",
                new[] { Permissions.CatalogView, Permissions.StockView, Permissions.OrdersView, Permissions.DispatchManage, Permissions.CounterBilling }, false),
        };
        foreach (var r in roles)
            if (!await _db.Roles.AnyAsync(x => x.Name == r.Name, ct))
                _db.Roles.Add(new Role { Name = r.Name, Description = r.Desc, Permissions = r.Perms.ToList(), IsSystem = r.System });
        await _db.SaveChangesAsync(ct);
    }

    private async Task SeedAdminAsync(CancellationToken ct)
    {
        if (await _db.Users.AnyAsync(u => u.UserType == UserType.Staff, ct)) return;
        if (string.IsNullOrWhiteSpace(_opt.AdminPassword))
        {
            _log.LogWarning("No staff users exist and Seed:AdminPassword is not set — skipping admin creation.");
            return;
        }
        var role = await _db.Roles.FirstAsync(r => r.Name == "Administrator", ct);
        var admin = new AppUser { UserType = UserType.Staff, Name = "Administrator", Email = _opt.AdminEmail.ToLowerInvariant(), RoleId = role.Id };
        admin.PasswordHash = new PasswordHasher<AppUser>().HashPassword(admin, _opt.AdminPassword);
        _db.Users.Add(admin);
        await _db.SaveChangesAsync(ct);
        _log.LogWarning("Created initial admin {Email}. Change the password after first login.", admin.Email);
    }

    private async Task SeedDemoAsync(CancellationToken ct)
    {
        _log.LogInformation("Seeding demo catalogue…");
        var catalog = new Dictionary<string, string[]>
        {
            ["Plumbing"] = new[] { "CPVC Pipes", "CPVC Fittings", "UPVC Pipes", "Water Tanks", "Valves" },
            ["Sanitary"] = new[] { "Taps & Faucets", "Showers", "Wash Basins", "Water Closets", "Bath Accessories" },
            ["Electrical"] = new[] { "Wires & Cables", "Switches & Sockets", "MCB & DB", "LED Lighting", "Fans" },
            ["Hardware"] = new[] { "Hand Tools", "Adhesives & Sealants", "Fasteners", "Door Fittings" },
            ["Building Materials"] = new[] { "Cement", "Waterproofing", "Tile Adhesives", "Wall Putty" },
        };
        var cats = new Dictionary<string, Category>();
        var subs = new Dictionary<string, SubCategory>();
        var i = 0;
        foreach (var (cat, subNames) in catalog)
        {
            var c = new Category { Name = cat, SortOrder = ++i };
            cats[cat] = c;
            _db.Categories.Add(c);
            var j = 0;
            foreach (var s in subNames)
            {
                var sc = new SubCategory { Category = c, Name = s, SortOrder = ++j };
                subs[s] = sc;
                _db.SubCategories.Add(sc);
            }
        }
        var brandNames = new[] { "Astral", "Supreme", "Ashirvad", "Sintex", "Jaquar", "Hindware", "Cera", "Havells", "Polycab", "Anchor",
            "Finolex", "Crompton", "Taparia", "Pidilite", "UltraTech", "Dr. Fixit", "Birla White" };
        var brands = brandNames.Select((b, idx) => new Brand { Name = b, SortOrder = idx }).ToDictionary(b => b.Name);
        _db.Brands.AddRange(brands.Values);

        // (name, sub, brand, unit, hsn, gst, mrp, list, partnerDisc, retailDisc, points, rol, stock, aliases, hindi)
        var items = new (string N, string S, string B, string U, string H, decimal G, decimal Mrp, decimal L, decimal Pd, decimal Rd, decimal Pts, decimal Rol, decimal Stock, string A, string Hi)[]
        {
            ("Astral CPVC Pro Pipe 1/2\" SDR 11 (3 m)", "CPVC Pipes", "Astral", "pcs", "3917", 18, 465, 420, 14, 6, 3, 60, 240, "cpvc pipe,garam pani pipe", "एस्ट्रल सीपीवीसी पाइप 1/2\""),
            ("Astral CPVC Pro Pipe 3/4\" SDR 11 (3 m)", "CPVC Pipes", "Astral", "pcs", "3917", 18, 720, 650, 14, 6, 4, 50, 180, "cpvc pipe", "एस्ट्रल सीपीवीसी पाइप 3/4\""),
            ("Ashirvad CPVC Pipe 1\" SDR 11 (3 m)", "CPVC Pipes", "Ashirvad", "pcs", "3917", 18, 1120, 1010, 15, 6, 6, 30, 90, "cpvc pipe", ""),
            ("Astral CPVC Elbow 90° 1/2\"", "CPVC Fittings", "Astral", "pcs", "3917", 18, 22, 19, 18, 8, 0.2m, 300, 1500, "elbow,bend,kohni", "एल्बो 1/2\""),
            ("Astral CPVC Tee 1/2\"", "CPVC Fittings", "Astral", "pcs", "3917", 18, 28, 25, 18, 8, 0.2m, 300, 1200, "tee,T joint", "टी 1/2\""),
            ("Ashirvad CPVC Ball Valve 3/4\"", "Valves", "Ashirvad", "pcs", "8481", 18, 380, 340, 16, 7, 2, 40, 120, "ball valve,stop cock", "बॉल वाल्व 3/4\""),
            ("Supreme UPVC Pipe 1\" SCH 40 (6 m)", "UPVC Pipes", "Supreme", "pcs", "3917", 18, 980, 890, 15, 6, 5, 40, 110, "upvc pipe", ""),
            ("Sintex Triple Layer Water Tank 1000 L", "Water Tanks", "Sintex", "pcs", "3925", 18, 9800, 8450, 10, 4, 60, 4, 14, "tanki,water tank", "पानी की टंकी 1000 लीटर"),
            ("Jaquar Continental Pillar Cock", "Taps & Faucets", "Jaquar", "pcs", "8481", 18, 2650, 2350, 12, 5, 15, 10, 36, "tap,nal,tonti", "जगुआर नल"),
            ("Jaquar Florentine Wall Mixer", "Taps & Faucets", "Jaquar", "pcs", "8481", 18, 5890, 5200, 12, 5, 30, 6, 18, "mixer,diverter", ""),
            ("Hindware Overhead Shower 6\"", "Showers", "Hindware", "pcs", "8481", 18, 1450, 1250, 14, 6, 8, 10, 40, "shower,fauvara", "शावर"),
            ("Cera Wall Hung Wash Basin", "Wash Basins", "Cera", "pcs", "6910", 18, 3200, 2780, 12, 5, 18, 5, 22, "basin,wash basin", ""),
            ("Hindware EWC Floor Mounted (S-Trap)", "Water Closets", "Hindware", "pcs", "6910", 18, 7800, 6900, 10, 4, 40, 4, 12, "toilet,commode,western seat", "कमोड"),
            ("Jaquar Towel Rail 24\"", "Bath Accessories", "Jaquar", "pcs", "7324", 18, 2150, 1890, 12, 5, 10, 6, 24, "towel rod", ""),
            ("Polycab 1.5 sq mm FR PVC Wire (90 m)", "Wires & Cables", "Polycab", "coil", "8544", 18, 2250, 1850, 16, 8, 15, 20, 85, "wire,taar,1.5 wire", "पॉलीकैब तार 1.5"),
            ("Polycab 2.5 sq mm FR PVC Wire (90 m)", "Wires & Cables", "Polycab", "coil", "8544", 18, 3450, 2890, 16, 8, 22, 20, 70, "wire,taar,2.5 wire", "पॉलीकैब तार 2.5"),
            ("Havells Lifeline 4 sq mm Wire (90 m)", "Wires & Cables", "Havells", "coil", "8544", 18, 5600, 4790, 15, 7, 35, 10, 28, "wire,ac wire", ""),
            ("Finolex 1 sq mm FR Wire (90 m)", "Wires & Cables", "Finolex", "coil", "8544", 18, 1590, 1340, 15, 7, 10, 20, 60, "wire,taar", ""),
            ("Anchor Roma 6A Switch", "Switches & Sockets", "Anchor", "pcs", "8536", 18, 48, 42, 20, 10, 0.4m, 500, 2400, "switch,button", "स्विच"),
            ("Anchor Roma 6A 3-Pin Socket", "Switches & Sockets", "Anchor", "pcs", "8536", 18, 125, 108, 20, 10, 0.8m, 200, 900, "socket,plug point", "सॉकेट"),
            ("Havells Crabtree Athena 16A Switch", "Switches & Sockets", "Havells", "pcs", "8536", 18, 210, 182, 18, 8, 1.5m, 100, 380, "switch,16 amp switch", ""),
            ("Havells 32A SP MCB C-Curve", "MCB & DB", "Havells", "pcs", "8536", 18, 345, 290, 18, 8, 2.5m, 50, 200, "mcb,circuit breaker", "एमसीबी"),
            ("Havells 8-Way SPN Distribution Board", "MCB & DB", "Havells", "pcs", "8537", 18, 2350, 1990, 15, 6, 15, 8, 26, "db box,distribution box", ""),
            ("Crompton 9W LED Bulb (Pack of 4)", "LED Lighting", "Crompton", "pack", "8539", 12, 520, 399, 22, 12, 3, 40, 160, "led bulb,bulb", "एलईडी बल्ब"),
            ("Havells 20W LED Batten 4 ft", "LED Lighting", "Havells", "pcs", "9405", 18, 640, 520, 20, 10, 4, 30, 110, "tube light,batten", "ट्यूबलाइट"),
            ("Crompton HS Plus 1200 mm Ceiling Fan", "Fans", "Crompton", "pcs", "8414", 18, 2750, 2290, 12, 6, 15, 10, 34, "pankha,ceiling fan", "पंखा"),
            ("Havells Efficiencia Neo BLDC Fan 1200 mm", "Fans", "Havells", "pcs", "8414", 18, 5450, 4590, 10, 5, 30, 6, 16, "bldc fan,pankha", ""),
            ("Taparia Combination Plier 8\"", "Hand Tools", "Taparia", "pcs", "8203", 18, 420, 365, 15, 6, 2, 20, 60, "plier,pakad", "प्लास"),
            ("Taparia Screwdriver Set (6 pcs)", "Hand Tools", "Taparia", "set", "8205", 18, 560, 480, 15, 6, 3, 15, 45, "screwdriver,pechkas", "पेचकस सेट"),
            ("Pidilite Fevicol SH 1 kg", "Adhesives & Sealants", "Pidilite", "pcs", "3506", 18, 330, 295, 12, 5, 2, 40, 140, "fevicol,glue", "फेविकोल"),
            ("Pidilite M-Seal 100 g", "Adhesives & Sealants", "Pidilite", "pcs", "3214", 18, 70, 62, 15, 6, 0.4m, 100, 420, "m seal,leak seal", "एम-सील"),
            ("Pidilite CPVC Solvent Cement 118 ml", "Adhesives & Sealants", "Pidilite", "pcs", "3506", 18, 260, 225, 15, 6, 1.5m, 50, 180, "solvent,cpvc glue", "सॉल्वेंट"),
            ("Dr. Fixit LW+ 1 L", "Waterproofing", "Dr. Fixit", "pcs", "3824", 18, 285, 255, 12, 5, 2, 40, 120, "waterproofing,lw plus", ""),
            ("Dr. Fixit Roofseal 4 L", "Waterproofing", "Dr. Fixit", "pcs", "3209", 18, 2390, 2050, 12, 5, 14, 10, 30, "roof seal,terrace waterproof", ""),
            ("UltraTech Cement OPC 53 Grade (50 kg)", "Cement", "UltraTech", "bag", "2523", 28, 440, 395, 4, 2, 1, 100, 400, "cement,siment", "सीमेंट"),
            ("UltraTech Tile Fixo 20 kg", "Tile Adhesives", "UltraTech", "bag", "3214", 18, 650, 560, 10, 4, 4, 30, 90, "tile adhesive", ""),
            ("Birla White Wall Care Putty 40 kg", "Wall Putty", "Birla White", "bag", "3214", 18, 980, 850, 10, 4, 6, 25, 70, "putty,wall putty", "पुट्टी"),
        };

        var rack = new Rack { Code = "R1", Name = "Main rack", Rows = 4, Columns = 6 };
        for (var r = 1; r <= rack.Rows; r++)
            for (var c = 1; c <= rack.Columns; c++)
                rack.Locations.Add(new RackLocation { RowNo = r, ColumnNo = c, Label = $"R1-{(char)('A' + r - 1)}{c}" });
        _db.Racks.Add(rack);
        await _db.SaveChangesAsync(ct);
        var locs = rack.Locations.OrderBy(l => l.RowNo).ThenBy(l => l.ColumnNo).ToList();

        var seq = 0;
        var created = new List<Product>();
        foreach (var it in items)
        {
            var sub = subs[it.S];
            var code = $"BM{await _db.NextSequenceValueAsync(Sequences.ProductCode, ct):D6}";
            var p = new Product
            {
                Code = code, Name = it.N, Category = sub.Category, SubCategory = sub, Brand = brands[it.B], Unit = it.U, HsnCode = it.H,
                GstRate = it.G, Mrp = it.Mrp, ListPrice = it.L, PartnerDiscountPercent = it.Pd, RetailDiscountPercent = it.Rd,
                RewardPointsPerUnit = it.Pts, ReorderLevel = it.Rol, Sequence = ++seq,
                StockQty = it.Stock, AverageCost = Math.Round(it.L * 0.72m, 2),
                Description = $"{it.N}. Genuine {it.B} product supplied by BuildMate 24x7 with GST invoice."
            };
            foreach (var a in it.A.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) p.Aliases.Add(new ProductAlias { Alias = a });
            if (!string.IsNullOrEmpty(it.Hi)) p.Translations.Add(new ProductTranslation { LanguageCode = "hi", Name = it.Hi });
            p.Locations.Add(new ProductLocation { RackLocation = locs[(seq - 1) % locs.Count], Quantity = it.Stock });
            _db.Products.Add(p);
            created.Add(p);
        }
        await _db.SaveChangesAsync(ct);
        foreach (var p in created)
        {
            _db.StockMovements.Add(new StockMovement
            {
                ProductId = p.Id, Type = StockMovementType.OpeningStock, Quantity = p.StockQty, BalanceAfter = p.StockQty,
                UnitCost = p.AverageCost, ReferenceType = "Opening", Note = "Demo opening stock"
            });
            p.AgingFromAt ??= p.CreatedAt; // opening stock is the first receipt (written directly, not via StockService)
        }

        var g1 = new ProductGroup { Name = "Bathroom Fitting Kit", Description = "Everything for a standard bathroom", SortOrder = 1 };
        var g2 = new ProductGroup { Name = "House Wiring Essentials", Description = "Wires, switches, MCBs", SortOrder = 2 };
        var gi = 0;
        foreach (var p in created.Where(p => p.Category.Name == "Sanitary" || p.SubCategory?.Name == "CPVC Fittings")) g1.Items.Add(new ProductGroupItem { Product = p, SortOrder = gi++ });
        gi = 0;
        foreach (var p in created.Where(p => p.SubCategory?.Name is "Wires & Cables" or "Switches & Sockets" or "MCB & DB")) g2.Items.Add(new ProductGroupItem { Product = p, SortOrder = gi++ });
        _db.ProductGroups.AddRange(g1, g2);
        await _db.SaveChangesAsync(ct);

        _db.Banners.AddRange(
            new Banner { Title = "Everything to build your home", Subtitle = "Plumbing, sanitary, electrical & hardware — open 24x7", ImageUrl = "/banners/hero-1.svg", LinkType = BannerLinkType.None, SortOrder = 1 },
            new Banner { Title = "Partner prices for plumbers & electricians", Subtitle = "Download the BuildMate Partner app and earn reward points", ImageUrl = "/banners/hero-2.svg", LinkType = BannerLinkType.Url, LinkValue = "/partner", SortOrder = 2, Placement = ContentPlacement.Web },
            new Banner { Title = "Wiring season sale", Subtitle = "Extra savings on Polycab, Havells & Finolex wires", ImageUrl = "/banners/hero-3.svg", LinkType = BannerLinkType.ProductGroup, LinkValue = g2.Id.ToString(), SortOrder = 3 });
        _db.HomeSections.AddRange(
            new HomeSection { Title = "Bathroom fitting kit", Type = HomeSectionType.ProductGroup, ReferenceId = g1.Id, SortOrder = 1 },
            new HomeSection { Title = "Wiring essentials", Type = HomeSectionType.ProductGroup, ReferenceId = g2.Id, SortOrder = 2 },
            new HomeSection { Title = "Best deals", Type = HomeSectionType.Discounted, SortOrder = 3 },
            new HomeSection { Title = "Cement & building materials", Type = HomeSectionType.Category, ReferenceId = cats["Building Materials"].Id, SortOrder = 4 });

        var store = await _settings.GetAsync(ct);
        // Seller details default to the store's own invoice (StoreSettings); phone is a placeholder.
        store.SupportPhone = "9000000000";
        store.DeliveryFee = 99;
        store.FreeDeliveryAbove = 2999;
        store.MinOrderValue = 199;
        store.SupportedLanguages = new() { "en", "hi" };
        await _settings.SaveAsync(store, ct);
        await _db.SaveChangesAsync(ct);
    }
}
