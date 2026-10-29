namespace BuildMate.Domain.Common;

/// <summary>
/// Permission keys used by role-based access control. Roles store a list of these;
/// "*" grants everything. Each key is registered as an authorization policy.
/// </summary>
public static class Permissions
{
    public const string All = "*";

    public const string DashboardView = "dashboard.view";
    public const string CatalogView = "catalog.view";
    public const string CatalogManage = "catalog.manage";
    public const string PurchasesManage = "purchases.manage";
    public const string StockView = "stock.view";
    public const string StockAdjust = "stock.adjust";
    public const string RacksManage = "racks.manage";
    public const string PartnersView = "partners.view";
    public const string PartnersManage = "partners.manage";
    public const string KycApprove = "kyc.approve";
    public const string RewardsAdjust = "rewards.adjust";
    public const string OrdersView = "orders.view";
    public const string OrdersManage = "orders.manage";
    public const string OrdersSpecialDiscount = "orders.special_discount";
    public const string DispatchManage = "dispatch.manage";
    public const string CounterBilling = "billing.counter";
    public const string ServiceRequestsManage = "service_requests.manage";
    public const string ContentManage = "content.manage";
    public const string ReportsView = "reports.view";
    public const string UsersManage = "users.manage";
    public const string SettingsManage = "settings.manage";

    public static readonly IReadOnlyList<(string Key, string Label, string Group)> Catalogue = new[]
    {
        (DashboardView, "View dashboard", "General"),
        (CatalogView, "View catalogue", "Catalogue"),
        (CatalogManage, "Manage categories, brands, products, groups", "Catalogue"),
        (PurchasesManage, "Enter and upload purchases", "Inventory"),
        (StockView, "View stock and inventory reports", "Inventory"),
        (StockAdjust, "Adjust stock manually", "Inventory"),
        (RacksManage, "Manage racks and locations", "Inventory"),
        (PartnersView, "View referral partners", "Partners"),
        (PartnersManage, "Create and edit referral partners", "Partners"),
        (KycApprove, "Approve or reject KYC", "Partners"),
        (RewardsAdjust, "Adjust reward points", "Partners"),
        (OrdersView, "View orders", "Sales"),
        (OrdersManage, "Edit and cancel orders", "Sales"),
        (OrdersSpecialDiscount, "Give special discounts", "Sales"),
        (DispatchManage, "Dispatch orders and issue invoices", "Sales"),
        (CounterBilling, "Counter billing for walk-in customers", "Sales"),
        (ServiceRequestsManage, "Manage plumber / electrician requests", "Services"),
        (ContentManage, "Manage website and app content", "Content"),
        (ReportsView, "View reports and analytics", "Reports"),
        (UsersManage, "Manage staff users and roles", "Admin"),
        (SettingsManage, "Manage settings and integrations", "Admin"),
    };

    public static IEnumerable<string> AllKeys => Catalogue.Select(c => c.Key);
}
