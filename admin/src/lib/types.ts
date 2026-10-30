// Mirrors the API DTOs (ASP.NET serialises to camelCase; enums as strings).

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number }

export type UserType = 'Staff' | 'Partner' | 'Customer'
export type KycStatus = 'NotSubmitted' | 'Pending' | 'Approved' | 'Rejected'
export type PartnerType = 'Plumber' | 'Electrician' | 'Contractor' | 'Builder' | 'Flooring' | 'Other'
export type OrderStatus = 'PendingPayment' | 'Paid' | 'Processing' | 'ReadyForPickup' | 'OutForDelivery' | 'Completed' | 'Cancelled' | 'PaymentFailed'
export type PaymentStatus = 'Pending' | 'Success' | 'Failed' | 'Refunded' | 'PartiallyRefunded'
export type PaymentMethod = 'Cashfree' | 'CashAtStore' | 'UpiAtStore' | 'CardAtStore'
export type SalesChannel = 'App' | 'Web' | 'Store'
export type CustomerKind = 'Partner' | 'Retail' | 'WalkIn'
export type FulfilmentType = 'StorePickup' | 'HomeDelivery'
export type ServiceType = 'Plumber' | 'Electrician'
export type ServiceRequestStatus = 'Pending' | 'InProgress' | 'Completed' | 'Cancelled'
export type ContentPlacement = 'Web' | 'App' | 'Both'
export type BannerLinkType = 'None' | 'Product' | 'Category' | 'Brand' | 'ProductGroup' | 'Url'
export type HomeSectionType = 'ProductGroup' | 'Category' | 'Brand' | 'NewArrivals' | 'Discounted'
export type StockMovementType = 'PurchaseIn' | 'SaleOut' | 'AdjustmentIn' | 'AdjustmentOut' | 'ReturnIn' | 'OpeningStock'
export type KycDocumentType = 'Aadhaar' | 'Pan' | 'Gst' | 'ShopPhoto' | 'Selfie' | 'Other'

export type AuthUser = {
  id: number; name: string; phone?: string; email?: string; userType: UserType
  kycStatus?: KycStatus; roleName?: string; permissions: string[]; preferredLanguage: string
}
export type AuthResult = { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; user: AuthUser; isNewUser: boolean }

export type Category = { id: number; name: string; description?: string; imageUrl?: string; sortOrder: number; isActive: boolean; productCount: number; subCategoryCount: number }
export type SubCategory = { id: number; categoryId: number; categoryName: string; name: string; sortOrder: number; isActive: boolean; productCount: number }
export type Brand = { id: number; name: string; logoUrl?: string; sortOrder: number; isActive: boolean; productCount: number }

export type Product = {
  id: number; code: string; name: string; description?: string
  categoryId: number; categoryName: string; subCategoryId?: number; subCategoryName?: string; brandId: number; brandName: string
  barcode?: string; unit: string; hsnCode?: string; gstRate: number
  mrp: number; listPrice: number; partnerDiscountPercent: number; retailDiscountPercent: number
  partnerPrice: number; retailPrice: number; rewardPointsPerUnit: number
  reorderLevel: number; sequence: number; stockQty: number; reservedQty: number; availableQty: number; averageCost: number
  isLowStock: boolean; imageUrls: string[]; isActive: boolean; showOnWeb: boolean; showOnApp: boolean
  aliases: string[]; translations: Record<string, string>; groupIds: number[]; rackLocations: string[]
  createdAt: string; updatedAt: string
  /** Products with the same family are shown as sizes of one item. */
  variantFamily?: string | null; variantLabel?: string | null
  /** "Name: Value" lines shown as a specification table. */
  specs: string[]
} & MovementFields
export type ProductUpsert = Omit<Product, keyof MovementFields | 'id' | 'code' | 'categoryName' | 'subCategoryName' | 'brandName' | 'partnerPrice' | 'retailPrice' |
  'stockQty' | 'reservedQty' | 'availableQty' | 'averageCost' | 'isLowStock' | 'rackLocations' | 'createdAt' | 'updatedAt'>

export type ProductLookup = {
  id: number; code: string; name: string; brandName: string; unit: string; listPrice: number
  partnerDiscountPercent: number; retailDiscountPercent: number; gstRate: number; availableQty: number; stockQty: number
  imageUrl?: string; rackLocations: string[]
}
export type ProductGroup = { id: number; name: string; description?: string; imageUrl?: string; sortOrder: number; isActive: boolean; productCount: number; productIds: number[] }

export type Rack = { id: number; code: string; name?: string; rows: number; columns: number; isActive: boolean; locationCount: number; occupiedCount: number }
export type RackLocation = { id: number; label: string; rowNo: number; columnNo: number; products: { productId: number; code: string; name: string; quantity: number }[] }

export type PurchaseListItem = { id: number; purchaseNo: string; purchaseDate: string; supplierName?: string; supplierInvoiceNo?: string; itemCount: number; totalQuantity: number; totalAmount: number; createdAt: string }
export type PurchaseDetail = {
  id: number; purchaseNo: string; purchaseDate: string; supplierName?: string; supplierGstin?: string; supplierInvoiceNo?: string; notes?: string
  totalAmount: number; createdAt: string
  items: { productId: number; productCode: string; productName: string; quantity: number; listPrice: number; purchaseDiscountPercent: number; netRate: number; lineTotal: number; rackLabel?: string }[]
}
export type StockRow = {
  productId: number; code: string; name: string; category: string; brand: string; unit: string; stockQty: number; reservedQty: number
  availableQty: number; reorderLevel: number; averageCost: number; value: number; listPrice: number; racks: string[]
} & MovementFields
/** Fast / Slow / Non-moving, from India-time days since the last successful dispatch (api: Inventory/ProductMovement.cs). */
export type MovementCategory = 'Fast' | 'Slow' | 'NonMoving'
export type MovementFields = { movement: MovementCategory; daysSinceMovement: number; neverDispatched: boolean; lastDispatchedAt?: string | null; movementReferenceAt?: string }
export type MovementBucket = { products: number; neverDispatched: number; stockQty: number; stockValue: number }
export type MovementSummary = { asOf: string; fastMaxDays: number; slowMaxDays: number; fast: MovementBucket; slow: MovementBucket; nonMoving: MovementBucket }
export type ProductMovementHistory = MovementFields & {
  productId: number; code: string; name: string; unit: string; stockQty: number; movementReferenceAt: string; firstReceiptAt?: string | null; createdAt: string
  dispatchCount: number; qtyLast30Days: number; qtyLast120Days: number
  dispatches: { dispatchedAt: string; invoiceNo: string; dispatchNo: string; orderId: number; orderNo: string; customer: string; channel: string; quantity: number }[]
}
export type StockMovement = { id: number; createdAt: string; productId: number; productCode: string; productName: string; type: StockMovementType; quantity: number; balanceAfter: number; unitCost: number; referenceType?: string; referenceNo?: string; note?: string }

export type PartnerListItem = {
  userId: number; name: string; phone?: string; businessName?: string; partnerType: PartnerType; city?: string; area?: string; pincode?: string
  kycStatus: KycStatus; managerName?: string; rewardBalance: number; orderCount: number; totalPurchase: number; lastOrderAt?: string; isActive: boolean; createdAt: string
}
export type PartnerDetail = {
  userId: number; name: string; phone?: string; email?: string; isActive: boolean; createdAt: string; lastLoginAt?: string
  partnerType: PartnerType; businessName?: string; addressLine?: string; area?: string; city?: string; state?: string; pincode?: string
  latitude?: number; longitude?: number; gstin?: string; locationVerified: boolean
  kycStatus: KycStatus; kycSubmittedAt?: string; kycReviewedByName?: string; kycReviewedAt?: string; kycRemarks?: string
  managerId?: number; managerName?: string; createdByAdmin: boolean; rewardBalance: number
  documents: { id: number; documentType: KycDocumentType; documentNumberMasked?: string; fileKey: string; uploadedAt: string }[]
  stats: { orderCount: number; totalPurchase: number; averageOrderValue: number; lastOrderAt?: string; pointsEarned: number; topProducts: { id: number; name: string; quantity: number; amount: number }[] }
}
export type RewardTxn = { id: number; createdAt: string; type: string; points: number; balanceAfter: number; orderId?: number; orderNo?: string; note?: string }

export type OrderListItem = {
  id: number; orderNo: string; createdAt: string; channel: SalesChannel; customerKind: CustomerKind; status: OrderStatus; paymentStatus: PaymentStatus
  fulfilmentType: FulfilmentType; scheduledAt?: string; customerName: string; customerPhone?: string; itemCount: number; grandTotal: number
  balanceDue: number; rewardPointsEarned: number; invoiceNo?: string
}
export type OrderItem = {
  id: number; productId: number; productCode: string; productName: string; hsnCode?: string; imageUrl?: string; quantity: number; listPrice: number
  discountPercent: number; specialDiscountPercent: number; unitPrice: number; gstRate: number; taxAmount: number; lineTotal: number
  rewardPoints: number; addedAtStore: boolean; rackLocations: string[]
}
export type OrderDetail = {
  id: number; orderNo: string; createdAt: string; channel: SalesChannel; customerKind: CustomerKind; status: OrderStatus; paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod; paidAt?: string; fulfilmentType: FulfilmentType; scheduledAt?: string
  userId?: number; customerName: string; customerPhone?: string; customerGstin?: string
  shipLine1?: string; shipLine2?: string; shipCity?: string; shipState?: string; shipPincode?: string
  subTotal: number; discountTotal: number; taxTotal: number; shippingFee: number; grandTotal: number; amountPaid: number; balanceDue: number
  rewardPointsEarned: number; rewardsCredited: boolean; customerNotes?: string; internalNotes?: string; cancelReason?: string
  canEdit: boolean; canDispatch: boolean; canCancel: boolean
  items: OrderItem[]; events: { at: string; action: string; details?: string; by?: string }[]
  payments: { id: number; at: string; method: PaymentMethod; status: PaymentStatus; amount: number; reference?: string }[]
  dispatch?: { dispatchNo: string; invoiceNo: string; dispatchedAt: string; dispatchedBy?: string; vehicleNo?: string; deliveryPerson?: string; notes?: string }
}
export type { InvoiceData as Invoice } from '../components/InvoiceSheet'

export type ServiceRequest = {
  id: number; requestNo: string; createdAt: string; serviceType: ServiceType; description: string; contactName: string; contactPhone: string
  address?: string; pincode?: string; preferredAt?: string; status: ServiceRequestStatus; assignedPartnerId?: number
  assignedPartnerName?: string; assignedPartnerPhone?: string; adminNotes?: string
  history: { at: string; status: ServiceRequestStatus; note?: string; by?: string }[]
}

export type Banner = { id: number; title: string; subtitle?: string; imageUrl: string; mobileImageUrl?: string; linkType: BannerLinkType; linkValue?: string; placement: ContentPlacement; sortOrder: number; isActive: boolean; startsAt?: string; endsAt?: string }
export type HomeSection = { id: number; title: string; type: HomeSectionType; referenceId?: number; referenceName?: string; maxItems: number; placement: ContentPlacement; sortOrder: number; isActive: boolean }

export type Role = { id: number; name: string; description?: string; permissions: string[]; isSystem: boolean; userCount: number }
export type Permission = { key: string; label: string; group: string }
export type Staff = { id: number; name: string; email?: string; phone?: string; roleId?: number; roleName?: string; isActive: boolean; lastLoginAt?: string; partnerCount: number }

export type StoreSettings = {
  storeName: string; legalName: string; addressLine: string; city: string; state: string; pincode: string; gstin?: string; pan?: string
  bankName?: string; bankBranch?: string; bankAccountNo?: string; bankIfsc?: string; invoiceLogoUrl?: string; invoiceNumberDigits: number
  supportPhone: string; supportEmail?: string; whatsAppNumber?: string; openingHours: string
  minOrderValue: number; deliveryFee: number; freeDeliveryAbove: number; deliveryPincodes: string[]
  homeDeliveryEnabled: boolean; storePickupEnabled: boolean; rewardPointValue: number; referralRewardPoints?: number; referralWelcomePoints?: number; invoicePrefix: string; invoiceTerms: string
  supportedLanguages: string[]; androidAppUrl?: string; iosAppUrl?: string; minAppVersion?: string
}

export type InvoiceNumbering = { financialYear: string; prefix: string; digits: number; nextNumber: number; nextInvoiceNo: string }

export type Dashboard = {
  kpis: {
    salesToday: number; ordersToday: number; salesThisMonth: number; ordersThisMonth: number; salesLastMonth: number
    awaitingDispatch: number; awaitingPayment: number; pendingKyc: number; lowStockCount: number; activePartners: number
    openServiceRequests: number; inventoryValue: number; averageOrderValue: number
  }
  trend: { label: string; date: string; app: number; web: number; store: number; orders: number }[]
  topProducts: NamedValue[]; topPartners: NamedValue[]; byCategory: NamedValue[]; byChannel: NamedValue[]
}
export type NamedValue = { id: number; name: string; quantity: number; amount: number; orders: number }

export type ImportError = { row: number; message: string }
export type ImportSummary = { created: number; updated: number; skipped: number; warnings: ImportError[] }

// ---------------------------------------------------------------- Quotations
export type QuotationStatus = 'Requested' | 'Quoted' | 'Accepted' | 'Declined' | 'Expired' | 'Cancelled'
export type QuotationSummary = {
  id: number; quoteNo: string; createdAt: string; status: QuotationStatus; customerKind: 'Partner' | 'Retail' | 'WalkIn'
  customerName: string; customerPhone?: string | null; fulfilmentType: 'StorePickup' | 'HomeDelivery'; itemCount: number
  subTotal: number; grandTotal: number; validUntil?: string | null; orderId?: number | null
}
export type QuotationLine = {
  id: number; productId: number; code: string; name: string; imageUrl?: string | null; unit: string; quantity: number
  listPrice: number; discountPercent: number; specialDiscountPercent: number; unitPrice: number; lineTotal: number; rewardPoints: number
  averageCost?: number | null; availableQty?: number | null
}
export type Quotation = QuotationSummary & {
  channel: string; addressText?: string | null; preferredAt?: string | null; customerNotes?: string | null; items: QuotationLine[]
  discountTotal: number; shippingFee: number; roundOff: number; rewardPoints: number; storeMessage?: string | null
  quotedAt?: string | null; quotedByName?: string | null; respondedAt?: string | null; cancelReason?: string | null; orderNo?: string | null
}
