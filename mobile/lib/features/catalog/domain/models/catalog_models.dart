// Catalog domain models for the BuildMate 24x7 marketplace.
// Designed for later backend swap without UI rewrites.
//
// Hierarchy (Excel = source of truth for categories/products):
//   Category → SubCategory → CatalogProduct → ProductVariant(Brand) → Cart

class AppUserProfile {
  const AppUserProfile({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.businessName,
    this.isGuest = false,
  });

  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? businessName;
  final bool isGuest;

  /// Initials derived from [name] (e.g. Rajesh Kumar → RK).
  String get initials {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final w = parts.first;
      return (w.length >= 2 ? w.substring(0, 2) : w).toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  /// Logged-out / no-session placeholder — not a real user.
  static const empty = AppUserProfile(id: '', name: '');
}

class Category {
  const Category({
    required this.id,
    required this.name,
    required this.icon,
    required this.itemCount,
    required this.iconColor,
    required this.iconBackground,
    this.imageAsset = '',
    this.imageUrl,
    this.description = '',
    this.subCategoryIds = const [],
  });

  final String id;
  final String name;
  final String icon;
  final int itemCount;
  final int iconColor;
  final int iconBackground;
  /// Local asset path for category product imagery (empty = use [icon]).
  final String imageAsset;
  /// Remote category image from backend (preferred over [imageAsset]).
  final String? imageUrl;
  final String description;
  final List<String> subCategoryIds;
}

class SubCategory {
  const SubCategory({
    required this.id,
    required this.categoryId,
    required this.name,
    this.description = '',
    this.productCount = 0,
  });

  final String id;
  final String categoryId;
  final String name;
  final String description;
  final int productCount;
}

class Brand {
  const Brand({
    required this.id,
    required this.name,
    required this.abbreviation,
    required this.color,
    required this.productCount,
    this.logoAsset = '',
    this.description = '',
    this.categoryIds = const [],
  });

  final String id;
  final String name;
  final String abbreviation;
  final int color;
  final int productCount;
  /// Local brand logo asset path (empty = use [abbreviation]).
  final String logoAsset;
  final String description;
  final List<String> categoryIds;
}

enum StockStatus { inStock, outOfStock, limited }

/// Base product from the Excel catalogue (no brand yet).
class CatalogProduct {
  const CatalogProduct({
    required this.id,
    required this.sku,
    required this.name,
    required this.categoryId,
    required this.categoryName,
    required this.subCategoryId,
    required this.subCategoryName,
    required this.description,
    required this.basePrice,
    required this.unit,
    required this.icon,
    required this.specifications,
    this.imageAsset = '',
    this.imageUrl,
    this.specSummary = '',
    this.isFeatured = false,
    this.isPopular = false,
  });

  final String id;
  final String sku;
  final String name;
  final String categoryId;
  final String categoryName;
  final String subCategoryId;
  final String subCategoryName;
  final String description;
  final double basePrice;
  final String unit;
  final String icon;
  /// Local category product image used on product cards (empty = use [icon]).
  final String imageAsset;
  /// Remote product image from backend (preferred over [imageAsset]).
  final String? imageUrl;
  final Map<String, String> specifications;
  final String specSummary;
  final bool isFeatured;
  final bool isPopular;

  String get priceLabel => formatInr(basePrice);

  String get priceWithUnit => '$priceLabel / $unit';
}

/// Brand-specific sellable variant of a [CatalogProduct].
class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.productId,
    required this.productName,
    required this.sku,
    required this.brandId,
    required this.brandName,
    required this.categoryId,
    required this.categoryName,
    required this.subCategoryId,
    required this.subCategoryName,
    required this.description,
    required this.price,
    required this.unit,
    required this.icon,
    required this.rating,
    required this.reviewCount,
    required this.stockStatus,
    required this.specifications,
    this.imageAsset = '',
    this.specSummary = '',
    this.minimumOrderQuantity = 1,
    this.isFeatured = false,
    this.isPopular = false,
    this.pipeType,
    this.mrp,
    this.purchasePrice,
    this.discountRate,
    this.imageUrl,
  });

  final String id;
  final String productId;
  final String productName;
  final String sku;
  final String brandId;
  final String brandName;
  final String categoryId;
  final String categoryName;
  final String subCategoryId;
  final String subCategoryName;
  final String description;
  final double price;
  final String unit;
  final String icon;
  final double rating;
  final int reviewCount;
  final StockStatus stockStatus;
  /// Local product image asset (typically the category visual).
  final String imageAsset;
  final Map<String, String> specifications;
  final String specSummary;
  final int minimumOrderQuantity;
  final bool isFeatured;
  final bool isPopular;
  /// Pipe schedule type (e.g. SCH40, SCH80). Null for non-pipe variants.
  final String? pipeType;
  final double? mrp;
  final double? purchasePrice;
  /// Discount off MRP stored as fraction (0.08 = 8%).
  final double? discountRate;
  /// Remote product image URL from catalog API (empty = use [imageAsset]).
  final String? imageUrl;

  /// Display name including brand for cart/quotation lines.
  String get displayName => '$brandName $productName';

  bool get inStock => stockStatus != StockStatus.outOfStock;

  /// Selling price derived from MRP and [discountRate]: MRP − (MRP × discountRate).
  double? get sellingPrice =>
      mrp == null || discountRate == null ? null : mrp! - (mrp! * discountRate!);

  /// Resolved discount fraction from [discountRate] or MRP vs selling [price].
  double? get effectiveDiscountRate {
    if (discountRate != null && discountRate! > 0) {
      return discountRate!.clamp(0.0, 1.0);
    }
    final listPrice = mrp;
    if (listPrice != null && listPrice > 0) {
      final sell = sellingPrice ?? price;
      if (sell < listPrice) {
        return ((listPrice - sell) / listPrice).clamp(0.0, 1.0);
      }
    }
    return discountRate;
  }

  String get priceLabel => formatInr(price);

  String? get mrpLabel => mrp == null ? null : formatInr(mrp!);

  String? get purchasePriceLabel =>
      purchasePrice == null ? null : formatInr(purchasePrice!);

  String? get sellingPriceLabel =>
      sellingPrice == null ? null : formatInr(sellingPrice!);

  String? get discountPercentLabel {
    final rate = effectiveDiscountRate;
    if (rate == null || rate <= 0) return null;
    return '${(rate * 100).toStringAsFixed(1)}%';
  }

  String get priceWithUnit => '$priceLabel / $unit';

  /// Back-compat alias used by older UI that expected [name].
  String get name => productName;
}

enum ProductSort {
  popularity,
  priceLowHigh,
  priceHighLow,
  newest,
  brandAz,
}

class CartItem {
  const CartItem({
    required this.variant,
    required this.quantity,
  });

  final ProductVariant variant;
  final int quantity;

  String get variantId => variant.id;
  String get productId => variant.productId;
  String get brandId => variant.brandId;

  double get unitPrice => variant.price;
  double get totalPrice => variant.price * quantity;

  CartItem copyWith({ProductVariant? variant, int? quantity}) {
    return CartItem(
      variant: variant ?? this.variant,
      quantity: quantity ?? this.quantity,
    );
  }
}

class Offer {
  const Offer({
    required this.id,
    required this.title,
    required this.description,
    required this.discountText,
    required this.validUntil,
    this.minimumOrder = '',
    this.categoryId,
    this.productIds = const [],
    this.routeName = '',
  });

  final String id;
  final String title;
  final String description;
  final String discountText;
  final String validUntil;
  final String minimumOrder;
  final String? categoryId;
  final List<String> productIds;
  final String routeName;
}

class ConstructionTool {
  const ConstructionTool({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.routeName,
  });

  final String id;
  final String title;
  final String subtitle;
  final String icon;
  final String routeName;
}

class BannerItem {
  const BannerItem({
    required this.id,
    required this.eyebrow,
    required this.headline,
    required this.description,
    required this.ctaLabel,
    required this.icon,
    required this.gradientStart,
    required this.gradientEnd,
    this.categoryId,
    this.routeName = '',
  });

  final String id;
  final String eyebrow;
  final String headline;
  final String description;
  final String ctaLabel;
  final String icon;
  final int gradientStart;
  final int gradientEnd;
  final String? categoryId;
  final String routeName;
}

class QuotationStatus {
  static const pending = 'pending';
  static const sold = 'sold';
}

class QuotationDraft {
  const QuotationDraft({
    required this.id,
    required this.items,
    required this.createdAt,
    required this.requesterId,
    this.customerName = '',
    this.customerPhone = '',
    this.notes = '',
    this.status = QuotationStatus.pending,
    this.soldAt,
    this.displayId,
  });

  final String id;
  final List<CartItem> items;
  final DateTime createdAt;
  final String requesterId;
  final String customerName;
  final String customerPhone;
  final String notes;
  final String status;
  final DateTime? soldAt;
  final String? displayId;

  double get estimatedTotal =>
      items.fold(0, (sum, item) => sum + item.totalPrice);

  double get grandTotal => estimatedTotal;

  String get quotationLabel => displayId ?? id;

  bool get isPending => status == QuotationStatus.pending;
  bool get isSold => status == QuotationStatus.sold;

  QuotationDraft copyWith({
    String? id,
    List<CartItem>? items,
    DateTime? createdAt,
    String? requesterId,
    String? customerName,
    String? customerPhone,
    String? notes,
    String? status,
    DateTime? soldAt,
    String? displayId,
    bool clearSoldAt = false,
  }) {
    return QuotationDraft(
      id: id ?? this.id,
      items: items ?? this.items,
      createdAt: createdAt ?? this.createdAt,
      requesterId: requesterId ?? this.requesterId,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      notes: notes ?? this.notes,
      status: status ?? this.status,
      soldAt: clearSoldAt ? null : (soldAt ?? this.soldAt),
      displayId: displayId ?? this.displayId,
    );
  }
}

/// Formats [price] as whole rupees with Western digit grouping (₹12,200).
String formatInr(double price) {
  final formatted = price >= 1000
      ? price.toStringAsFixed(0).replaceAllMapped(
            RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
            (m) => '${m[1]},',
          )
      : (price == price.roundToDouble()
          ? price.toStringAsFixed(0)
          : price.toStringAsFixed(0));
  return '₹$formatted';
}
