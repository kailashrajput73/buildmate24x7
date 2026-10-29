namespace BuildMate.Domain.Enums;

public enum UserType { Staff = 1, Partner = 2, Customer = 3 }

public enum PartnerType { Plumber = 1, Electrician = 2, Contractor = 3, Builder = 4, Flooring = 5, Other = 9 }

public enum KycStatus { NotSubmitted = 0, Pending = 1, Approved = 2, Rejected = 3 }

public enum KycDocumentType { Aadhaar = 1, Pan = 2, Gst = 3, ShopPhoto = 4, Selfie = 5, Other = 9 }

public enum StockMovementType
{
    PurchaseIn = 1,
    SaleOut = 2,
    AdjustmentIn = 3,
    AdjustmentOut = 4,
    ReturnIn = 5,
    OpeningStock = 6
}

/// <summary>Product movement class, from India-time calendar days since the last successful dispatch.</summary>
public enum MovementCategory
{
    /// <summary>0–30 days.</summary>
    Fast = 1,
    /// <summary>31–120 days.</summary>
    Slow = 2,
    /// <summary>121 days or more.</summary>
    NonMoving = 3
}

public enum SalesChannel { App = 1, Web = 2, Store = 3 }

public enum CustomerKind { Partner = 1, Retail = 2, WalkIn = 3 }

public enum OrderStatus
{
    PendingPayment = 1,
    Paid = 2,
    Processing = 3,
    ReadyForPickup = 4,
    OutForDelivery = 5,
    Completed = 6,
    Cancelled = 7,
    PaymentFailed = 8
}

public enum FulfilmentType { StorePickup = 1, HomeDelivery = 2 }

/// <summary>Requested → Quoted → Accepted (an order exists) / Declined; staff can Cancel; Quoted lapses to Expired after ValidUntil.</summary>
public enum QuotationStatus { Requested = 1, Quoted = 2, Accepted = 3, Declined = 4, Expired = 5, Cancelled = 6 }

public enum PaymentMethod { Cashfree = 1, CashAtStore = 2, UpiAtStore = 3, CardAtStore = 4 }

public enum PaymentStatus { Pending = 1, Success = 2, Failed = 3, Refunded = 4, PartiallyRefunded = 5 }

public enum RewardTransactionType { Earned = 1, Reversed = 2, Adjusted = 3, Redeemed = 4 }

public enum ServiceType { Plumber = 1, Electrician = 2 }

public enum ServiceRequestStatus { Pending = 1, InProgress = 2, Completed = 3, Cancelled = 4 }

public enum ContentPlacement { Web = 1, App = 2, Both = 3 }

public enum BannerLinkType { None = 0, Product = 1, Category = 2, Brand = 3, ProductGroup = 4, Url = 5 }

public enum HomeSectionType { ProductGroup = 1, Category = 2, Brand = 3, NewArrivals = 4, Discounted = 5 }

public enum OutboxStatus { Pending = 1, Processed = 2, Failed = 3, Skipped = 4 }

public enum DevicePlatform { Android = 1, Ios = 2, Web = 3 }
