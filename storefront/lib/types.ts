export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number }

export type ProductCard = {
  id: number; code: string; name: string; brandName: string; categoryId: number; unit: string; imageUrl?: string | null
  mrp: number; listPrice: number; discountPercent: number; price: number; inStock: boolean; rewardPoints?: number | null
  /** Size family, e.g. "King CPVC Coupler SDR 11". On collapsed listings `name` is the family and `variantCount` > 1. */
  family?: string | null; variantLabel?: string | null; variantCount?: number; fromPrice?: number | null
  /** Card text for a family, e.g. "9 sizes" or "6 sizes · 5 colours · 2 lengths". */
  variantSummary?: string | null
}
export type VariantOption = { id: number; code: string; label: string; mrp: number; price: number; inStock: boolean }
export type Spec = { name: string; value: string }
/** One picker row (Size, Colour, Length…). Each choice opens `productId`; `exact` = same other options as now. */
export type VariantAxis = { name: string; choices: { value: string; productId: number; selected: boolean; exact: boolean; inStock: boolean }[] }
export type ProductDetail = ProductCard & {
  description?: string; brandId: number; categoryName: string; subCategoryId?: number; subCategoryName?: string
  hsnCode?: string; gstRate: number; imageUrls: string[]; maxOrderQty: number; otherNames: string[]; related: ProductCard[]
  variants: VariantOption[]; specs: Spec[]; variantAxes?: VariantAxis[]
}
export type CategoryTree = { id: number; name: string; imageUrl?: string; productCount: number; subCategories: { id: number; name: string }[] }
export type BrandRef = { id: number; name: string; logoUrl?: string | null }
export type Banner = { id: number; title: string; subtitle?: string; imageUrl: string; mobileImageUrl?: string | null; linkType: string; linkValue?: string | null }
export type StoreInfo = {
  storeName: string; supportPhone: string; whatsAppNumber?: string; supportEmail?: string; address: string; openingHours: string
  minOrderValue: number; deliveryFee: number; freeDeliveryAbove: number; homeDeliveryEnabled: boolean; storePickupEnabled: boolean
  supportedLanguages: string[]; androidAppUrl?: string; iosAppUrl?: string
}
export type HomeFeed = {
  banners: Banner[]; categories: CategoryTree[]; brands: BrandRef[]
  sections: { id: number; title: string; type: string; referenceId?: number; products: ProductCard[] }[]
  store: StoreInfo
}

export type AuthUser = { id: number; name: string; phone?: string; email?: string; userType: 'Staff' | 'Partner' | 'Customer'; kycStatus?: 'NotSubmitted' | 'Pending' | 'Approved' | 'Rejected' | null; preferredLanguage: string }
export type AuthResult = { accessToken: string; refreshToken: string; user: AuthUser; isNewUser: boolean }

export type CartLine = {
  productId: number; code: string; name: string; brandName: string; unit: string; imageUrl?: string; quantity: number
  listPrice: number; discountPercent: number; unitPrice: number; lineTotal: number; mrp: number; availableQty: number; issue?: string | null
}
export type Cart = {
  items: CartLine[]; itemCount: number; subTotal: number; discountTotal: number; total: number; deliveryFee: number; roundOff: number; payable: number
  freeDeliveryAbove: number; minOrderValue: number; canCheckout: boolean; issues: string[]; storePickupEnabled: boolean; homeDeliveryEnabled: boolean
}
export type Address = { id: number; name: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string; isDefault: boolean }

export type OrderStatus = 'PendingPayment' | 'Paid' | 'Processing' | 'ReadyForPickup' | 'OutForDelivery' | 'Completed' | 'Cancelled' | 'PaymentFailed'
export type OrderSummary = { id: number; orderNo: string; createdAt: string; status: OrderStatus; fulfilmentType: 'StorePickup' | 'HomeDelivery'; itemCount: number; grandTotal: number; invoiceNo?: string }
export type OrderDetail = OrderSummary & {
  scheduledAt?: string; paidAt?: string; subTotal: number; discountTotal: number; taxTotal: number; shippingFee: number; amountPaid: number
  shipLine1?: string; shipCity?: string; shipPincode?: string; customerNotes?: string; cancelReason?: string
  items: { id: number; productId: number; productName: string; productCode: string; imageUrl?: string; quantity: number; unitPrice: number; lineTotal: number }[]
  events: { at: string; action: string; details?: string }[]
  dispatch?: { invoiceNo: string; dispatchedAt: string }
}
export type CheckoutResult = { orderId: number; orderNo: string; amount: number; gatewayOrderId: string; paymentSessionId: string; environment: string }

export type ServiceRequest = {
  id: number; requestNo: string; createdAt: string; serviceType: 'Plumber' | 'Electrician'; description: string; status: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled'
  preferredAt?: string; assignedPartnerName?: string; assignedPartnerPhone?: string
}
export type Notification = { id: number; createdAt: string; title: string; body: string; link?: string; isRead: boolean }

export type QuotationStatus = 'Requested' | 'Quoted' | 'Accepted' | 'Declined' | 'Expired' | 'Cancelled'
export type QuotationSummary = {
  id: number; quoteNo: string; createdAt: string; status: QuotationStatus; customerKind: string; customerName: string
  fulfilmentType: 'StorePickup' | 'HomeDelivery'; itemCount: number; subTotal: number; grandTotal: number; validUntil?: string | null; orderId?: number | null
}
export type Quotation = QuotationSummary & {
  addressText?: string | null; preferredAt?: string | null; customerNotes?: string | null
  items: { id: number; productId: number; code: string; name: string; imageUrl?: string | null; unit: string; quantity: number; listPrice: number
    discountPercent: number; specialDiscountPercent: number; unitPrice: number; lineTotal: number; rewardPoints: number }[]
  discountTotal: number; shippingFee: number; roundOff: number; rewardPoints: number; storeMessage?: string | null
  quotedAt?: string | null; validUntil?: string | null; cancelReason?: string | null; orderNo?: string | null
}
