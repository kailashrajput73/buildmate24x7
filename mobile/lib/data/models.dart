// Plain models mirroring the API DTOs (camelCase JSON, enums as strings).

typedef Json = Map<String, dynamic>;

double _d(dynamic v) => v == null ? 0 : (v as num).toDouble();
int _i(dynamic v) => v == null ? 0 : (v as num).toInt();
String? _s(dynamic v) => v as String?;
List<T> _list<T>(dynamic v, T Function(Json) f) => (v as List? ?? const []).map((e) => f(e as Json)).toList();

class Paged<T> {
  final List<T> items;
  final int total, page, pageSize;
  Paged(this.items, this.total, this.page, this.pageSize);
  factory Paged.fromJson(Json j, T Function(Json) f) => Paged(_list(j['items'], f), _i(j['total']), _i(j['page']), _i(j['pageSize']));
  bool get hasMore => page * pageSize < total;
}

class AuthUser {
  final int id;
  final String name;
  final String? phone, email;
  final String userType;
  final String? kycStatus;
  final String preferredLanguage;
  AuthUser({required this.id, required this.name, this.phone, this.email, required this.userType, this.kycStatus, required this.preferredLanguage});
  factory AuthUser.fromJson(Json j) => AuthUser(
        id: _i(j['id']), name: j['name'] as String? ?? '', phone: _s(j['phone']), email: _s(j['email']),
        userType: j['userType'] as String, kycStatus: _s(j['kycStatus']), preferredLanguage: j['preferredLanguage'] as String? ?? 'en');
}

class CatalogFields {
  final int? typeId, familyId;
  final String? typeName, productClass, productFamily, size, length, familyImageUrl;
  final double? packSize, packMrp, boxPrice;
  CatalogFields.fromJson(Json j) : typeId = (j['typeId'] as num?)?.toInt(), familyId = (j['familyId'] as num?)?.toInt(),
    typeName = _s(j['typeName']), productClass = _s(j['class']), productFamily = _s(j['productFamily']), size = _s(j['size']), length = _s(j['length']), familyImageUrl = _s(j['familyImageUrl']),
    packSize = (j['packSize'] as num?)?.toDouble(), packMrp = (j['packMrp'] as num?)?.toDouble(), boxPrice = (j['boxPrice'] as num?)?.toDouble();
}

class ProductCard {
  final CatalogFields? catalog;
  final int id, categoryId;
  final String code, name, brandName, unit;
  final String? imageUrl;
  final double mrp, listPrice, discountPercent, price;
  final bool inStock;
  final double? rewardPoints;
  /// Size family. On collapsed listings [name] is the family and [variantCount] > 1.
  final String? family, variantLabel;
  /// e.g. "9 sizes" or "6 sizes · 5 colours · 2 lengths".
  final String? variantSummary;
  final int variantCount;
  final double? fromPrice;
  bool get isFamily => variantCount > 1;
  ProductCard({required this.id, required this.categoryId, required this.code, required this.name, required this.brandName, required this.unit,
      this.imageUrl, required this.mrp, required this.listPrice, required this.discountPercent, required this.price, required this.inStock, this.rewardPoints,
      this.catalog, this.family, this.variantLabel, this.variantCount = 1, this.fromPrice, this.variantSummary});
  factory ProductCard.fromJson(Json j) => ProductCard(
        catalog: j['catalog'] == null ? null : CatalogFields.fromJson(j['catalog'] as Json),
        id: _i(j['id']), categoryId: _i(j['categoryId']), code: j['code'] as String, name: j['name'] as String, brandName: j['brandName'] as String,
        unit: j['unit'] as String, imageUrl: _s(j['imageUrl']), mrp: _d(j['mrp']), listPrice: _d(j['listPrice']), discountPercent: _d(j['discountPercent']),
        price: _d(j['price']), inStock: j['inStock'] as bool? ?? false, rewardPoints: j['rewardPoints'] == null ? null : _d(j['rewardPoints']),
        family: _s(j['family']), variantLabel: _s(j['variantLabel']), variantCount: j['variantCount'] == null ? 1 : _i(j['variantCount']),
        fromPrice: j['fromPrice'] == null ? null : _d(j['fromPrice']), variantSummary: _s(j['variantSummary']));
}

/// One picker row (Size, Colour, Length…). Each choice opens [VariantChoice.productId].
class VariantAxis {
  final String name;
  final List<VariantChoice> choices;
  VariantAxis(this.name, this.choices);
  factory VariantAxis.fromJson(Json j) => VariantAxis(j['name'] as String, _list(j['choices'], VariantChoice.fromJson));
}

/// [exact] = same other options as the current product; otherwise picking it changes them.
class VariantChoice {
  final String value;
  final int productId;
  final bool selected, exact, inStock;
  VariantChoice(this.value, this.productId, this.selected, this.exact, this.inStock);
  factory VariantChoice.fromJson(Json j) => VariantChoice(j['value'] as String, _i(j['productId']),
      j['selected'] as bool? ?? false, j['exact'] as bool? ?? true, j['inStock'] as bool? ?? false);
}

/// One size in a product family (size picker).
class VariantOption {
  final int id;
  final String code, label;
  final double mrp, price;
  final bool inStock;
  VariantOption(this.id, this.code, this.label, this.mrp, this.price, this.inStock);
  factory VariantOption.fromJson(Json j) =>
      VariantOption(_i(j['id']), j['code'] as String, j['label'] as String, _d(j['mrp']), _d(j['price']), j['inStock'] as bool? ?? false);
}

class ProductDetail {
  final ProductCard card;
  final String? description, categoryName, subCategoryName, hsnCode;
  final double gstRate, maxOrderQty;
  final List<String> imageUrls, otherNames;
  final List<ProductCard> related;
  final List<VariantOption> variants;
  final List<({String name, String value})> specs;
  final List<VariantAxis> variantAxes;
  ProductDetail({required this.card, this.description, this.categoryName, this.subCategoryName, this.hsnCode, required this.gstRate,
      required this.maxOrderQty, required this.imageUrls, required this.otherNames, required this.related,
      this.variants = const [], this.specs = const [], this.variantAxes = const []});
  factory ProductDetail.fromJson(Json j) => ProductDetail(
        card: ProductCard.fromJson({...j, 'imageUrl': (j['imageUrls'] as List?)?.cast<String>().firstOrNull}),
        description: _s(j['description']), categoryName: _s(j['categoryName']), subCategoryName: _s(j['subCategoryName']), hsnCode: _s(j['hsnCode']),
        gstRate: _d(j['gstRate']), maxOrderQty: _d(j['maxOrderQty']),
        imageUrls: (j['imageUrls'] as List? ?? []).cast<String>(), otherNames: (j['otherNames'] as List? ?? []).cast<String>(),
        related: _list(j['related'], ProductCard.fromJson),
        variants: _list(j['variants'], VariantOption.fromJson),
        specs: (j['specs'] as List? ?? []).map((s) => (name: s['name'] as String, value: s['value'] as String)).toList(),
        variantAxes: _list(j['variantAxes'], VariantAxis.fromJson));
}

class ProductCategory {
  final int id, productCount;
  final String name;
  final String? imageUrl;
  final List<({int id, String name})> subCategories;
  ProductCategory(this.id, this.name, this.imageUrl, this.productCount, this.subCategories);
  factory ProductCategory.fromJson(Json j) => ProductCategory(_i(j['id']), j['name'] as String, _s(j['imageUrl']), _i(j['productCount']),
      (j['subCategories'] as List? ?? []).map((s) => (id: _i(s['id']), name: s['name'] as String)).toList());
}

class PromoBanner {
  final int id;
  final String title, imageUrl, linkType;
  final String? subtitle, mobileImageUrl, linkValue;
  PromoBanner(this.id, this.title, this.subtitle, this.imageUrl, this.mobileImageUrl, this.linkType, this.linkValue);
  factory PromoBanner.fromJson(Json j) => PromoBanner(_i(j['id']), j['title'] as String, _s(j['subtitle']), j['imageUrl'] as String, _s(j['mobileImageUrl']),
      j['linkType'] as String? ?? 'None', _s(j['linkValue']));
}

class StoreInfo {
  final String storeName, supportPhone, address, openingHours;
  final String? whatsAppNumber, minAppVersion;
  final double minOrderValue, deliveryFee, freeDeliveryAbove;
  final bool homeDeliveryEnabled, storePickupEnabled;
  final List<String> deliveryPincodes;
  bool deliversTo(String pincode) => homeDeliveryEnabled && (deliveryPincodes.isEmpty || deliveryPincodes.contains(pincode.trim()));
  StoreInfo({required this.storeName, required this.supportPhone, required this.address, required this.openingHours, this.whatsAppNumber,
      this.minAppVersion, required this.minOrderValue, required this.deliveryFee, required this.freeDeliveryAbove,
      required this.homeDeliveryEnabled, required this.storePickupEnabled, this.deliveryPincodes = const []});
  factory StoreInfo.fromJson(Json j) => StoreInfo(
        storeName: j['storeName'] as String? ?? 'BuildMate 24x7', supportPhone: j['supportPhone'] as String? ?? '', address: j['address'] as String? ?? '',
        openingHours: j['openingHours'] as String? ?? '', whatsAppNumber: _s(j['whatsAppNumber']), minAppVersion: _s(j['minAppVersion']),
        minOrderValue: _d(j['minOrderValue']), deliveryFee: _d(j['deliveryFee']), freeDeliveryAbove: _d(j['freeDeliveryAbove']),
        deliveryPincodes: (j['deliveryPincodes'] as List? ?? []).cast<String>(),
        homeDeliveryEnabled: j['homeDeliveryEnabled'] as bool? ?? true, storePickupEnabled: j['storePickupEnabled'] as bool? ?? true);
}

class HomeFeed {
  final List<PromoBanner> banners;
  final List<ProductCategory> categories;
  final List<({int id, String name, String? logoUrl})> brands;
  final List<({int id, String title, String type, int? referenceId, List<ProductCard> products})> sections;
  final StoreInfo store;
  HomeFeed(this.banners, this.categories, this.brands, this.sections, this.store);
  factory HomeFeed.fromJson(Json j) => HomeFeed(
        _list(j['banners'], PromoBanner.fromJson),
        _list(j['categories'], ProductCategory.fromJson),
        (j['brands'] as List? ?? []).map((b) => (id: _i(b['id']), name: b['name'] as String, logoUrl: _s(b['logoUrl']))).toList(),
        (j['sections'] as List? ?? [])
            .map((s) => (id: _i(s['id']), title: s['title'] as String, type: s['type'] as String, referenceId: s['referenceId'] as int?,
                products: _list(s['products'], ProductCard.fromJson)))
            .toList(),
        StoreInfo.fromJson(j['store'] as Json));
}

class CartLine {
  final String purchaseUnit;
  final double? packSize;
  final int productId;
  final String code, name, brandName, unit;
  final String? imageUrl, issue;
  final double quantity, listPrice, discountPercent, unitPrice, lineTotal, availableQty;
  final double? rewardPoints;
  CartLine({this.purchaseUnit = "Piece", this.packSize, required this.productId, required this.code, required this.name, required this.brandName, required this.unit, this.imageUrl, this.issue,
      required this.quantity, required this.listPrice, required this.discountPercent, required this.unitPrice, required this.lineTotal,
      required this.availableQty, this.rewardPoints});
  factory CartLine.fromJson(Json j) => CartLine(purchaseUnit: j["purchaseUnit"] as String? ?? "Piece", packSize: (j["packSize"] as num?)?.toDouble(),
        productId: _i(j['productId']), code: j['code'] as String, name: j['name'] as String, brandName: j['brandName'] as String, unit: j['unit'] as String,
        imageUrl: _s(j['imageUrl']), issue: _s(j['issue']), quantity: _d(j['quantity']), listPrice: _d(j['listPrice']),
        discountPercent: _d(j['discountPercent']), unitPrice: _d(j['unitPrice']), lineTotal: _d(j['lineTotal']), availableQty: _d(j['availableQty']),
        rewardPoints: j['rewardPoints'] == null ? null : _d(j['rewardPoints']));
}

class Cart {
  final List<CartLine> items;
  final double subTotal, discountTotal, total, rewardPoints, deliveryFee, freeDeliveryAbove, minOrderValue;
  /// Bill rounded to the rupee (what is charged) and the rounding difference.
  final double payable, roundOff;
  final bool canCheckout, storePickupEnabled, homeDeliveryEnabled;
  final List<String> issues;
  Cart({required this.items, required this.subTotal, required this.discountTotal, required this.total, required this.rewardPoints,
      required this.deliveryFee, required this.freeDeliveryAbove, required this.minOrderValue, required this.canCheckout, required this.issues,
      required this.storePickupEnabled, required this.homeDeliveryEnabled, required this.payable, required this.roundOff});
  factory Cart.fromJson(Json j) => Cart(
        items: _list(j['items'], CartLine.fromJson), subTotal: _d(j['subTotal']), discountTotal: _d(j['discountTotal']), total: _d(j['total']),
        rewardPoints: _d(j['rewardPoints']), deliveryFee: _d(j['deliveryFee']), freeDeliveryAbove: _d(j['freeDeliveryAbove']),
        minOrderValue: _d(j['minOrderValue']), canCheckout: j['canCheckout'] as bool? ?? false, issues: (j['issues'] as List? ?? []).cast<String>(),
        storePickupEnabled: j['storePickupEnabled'] as bool? ?? true, homeDeliveryEnabled: j['homeDeliveryEnabled'] as bool? ?? true,
        payable: j['payable'] == null ? (_d(j['total']) + _d(j['deliveryFee'])).roundToDouble() : _d(j['payable']), roundOff: _d(j['roundOff']));
  int get count => items.length;
}

class Address {
  final int id;
  final String name, phone, line1, city, state, pincode;
  final String? line2, landmark;
  final bool isDefault;
  Address({required this.id, required this.name, required this.phone, required this.line1, this.line2, this.landmark, required this.city,
      required this.state, required this.pincode, required this.isDefault});
  factory Address.fromJson(Json j) => Address(
        id: _i(j['id']), name: j['name'] as String, phone: j['phone'] as String, line1: j['line1'] as String, line2: _s(j['line2']),
        landmark: _s(j['landmark']), city: j['city'] as String, state: j['state'] as String, pincode: j['pincode'] as String, isDefault: j['isDefault'] as bool? ?? false);
  String get oneLine => [line1, line2, landmark, city, pincode].where((s) => s != null && s.isNotEmpty).join(', ');
}

class OrderSummary {
  final int id, itemCount;
  final String orderNo, createdAt, status, fulfilmentType;
  final double grandTotal, rewardPointsEarned;
  final String? invoiceNo, scheduledAt;
  OrderSummary({required this.id, required this.itemCount, required this.orderNo, required this.createdAt, required this.status,
      required this.fulfilmentType, required this.grandTotal, required this.rewardPointsEarned, this.invoiceNo, this.scheduledAt});
  factory OrderSummary.fromJson(Json j) => OrderSummary(
        id: _i(j['id']), itemCount: _i(j['itemCount']), orderNo: j['orderNo'] as String, createdAt: j['createdAt'] as String,
        status: j['status'] as String, fulfilmentType: j['fulfilmentType'] as String, grandTotal: _d(j['grandTotal']),
        rewardPointsEarned: _d(j['rewardPointsEarned']), invoiceNo: _s(j['invoiceNo']), scheduledAt: _s(j['scheduledAt']));
}

class OrderItem {
  final String purchaseUnit;
  final double? packSize, purchaseQuantity;
  final int productId;
  final String productName, productCode;
  final String? imageUrl;
  final double quantity, listPrice, discountPercent, specialDiscountPercent, unitPrice, lineTotal, rewardPoints;
  OrderItem({this.purchaseUnit = "Piece", this.packSize, this.purchaseQuantity, required this.productId, required this.productName, required this.productCode, this.imageUrl, required this.quantity,
      required this.listPrice, required this.discountPercent, required this.specialDiscountPercent, required this.unitPrice, required this.lineTotal,
      required this.rewardPoints});
  factory OrderItem.fromJson(Json j) => OrderItem(purchaseUnit: j["purchaseUnit"] as String? ?? "Piece", packSize: (j["packSize"] as num?)?.toDouble(), purchaseQuantity: (j["purchaseQuantity"] as num?)?.toDouble(),
        productId: _i(j['productId']), productName: j['productName'] as String, productCode: j['productCode'] as String, imageUrl: _s(j['imageUrl']),
        quantity: _d(j['quantity']), listPrice: _d(j['listPrice']), discountPercent: _d(j['discountPercent']),
        specialDiscountPercent: _d(j['specialDiscountPercent']), unitPrice: _d(j['unitPrice']), lineTotal: _d(j['lineTotal']), rewardPoints: _d(j['rewardPoints']));
}

class OrderDetail {
  final OrderSummary summary;
  final double subTotal, discountTotal, taxTotal, shippingFee, amountPaid;
  final bool rewardsCredited;
  final String? shipAddress, customerNotes, cancelReason, dispatchedAt;
  final List<OrderItem> items;
  final List<({String at, String action, String? details})> events;
  OrderDetail({required this.summary, required this.subTotal, required this.discountTotal, required this.taxTotal, required this.shippingFee,
      required this.amountPaid, required this.rewardsCredited, this.shipAddress, this.customerNotes, this.cancelReason, this.dispatchedAt,
      required this.items, required this.events});
  factory OrderDetail.fromJson(Json j) => OrderDetail(
        summary: OrderSummary.fromJson({...j, 'itemCount': (j['items'] as List).length, 'invoiceNo': (j['dispatch'] as Json?)?['invoiceNo']}),
        subTotal: _d(j['subTotal']), discountTotal: _d(j['discountTotal']), taxTotal: _d(j['taxTotal']), shippingFee: _d(j['shippingFee']),
        amountPaid: _d(j['amountPaid']), rewardsCredited: j['rewardsCredited'] as bool? ?? false,
        shipAddress: [j['shipLine1'], j['shipCity'], j['shipPincode']].where((s) => s != null).join(', ').trim().isEmpty
            ? null
            : [j['shipLine1'], j['shipCity'], j['shipPincode']].where((s) => s != null).join(', '),
        customerNotes: _s(j['customerNotes']), cancelReason: _s(j['cancelReason']), dispatchedAt: _s((j['dispatch'] as Json?)?['dispatchedAt']),
        items: _list(j['items'], OrderItem.fromJson),
        events: (j['events'] as List? ?? []).map((e) => (at: e['at'] as String, action: e['action'] as String, details: e['details'] as String?)).toList());
  double get balanceDue => summary.grandTotal - amountPaid;
}

class CheckoutResult {
  final int orderId;
  final String orderNo, gatewayOrderId, paymentSessionId, environment;
  final double amount;
  CheckoutResult(this.orderId, this.orderNo, this.amount, this.gatewayOrderId, this.paymentSessionId, this.environment);
  factory CheckoutResult.fromJson(Json j) => CheckoutResult(_i(j['orderId']), j['orderNo'] as String, _d(j['amount']), j['gatewayOrderId'] as String,
      j['paymentSessionId'] as String, j['environment'] as String);
}

class KycDocument {
  final int id;
  final String documentType;
  final String? documentNumberMasked;
  KycDocument(this.id, this.documentType, this.documentNumberMasked);
  factory KycDocument.fromJson(Json j) => KycDocument(_i(j['id']), j['documentType'] as String, _s(j['documentNumberMasked']));
}

class PartnerProfile {
  final int userId;
  final String name, partnerType, kycStatus;
  final String? phone, email, businessName, addressLine, area, city, state, pincode, gstin, kycRemarks, managerName;
  final double? latitude, longitude;
  final double rewardBalance;
  final List<KycDocument> documents;
  final int orderCount;
  final double totalPurchase;
  PartnerProfile({required this.userId, required this.name, required this.partnerType, required this.kycStatus, this.phone, this.email,
      this.businessName, this.addressLine, this.area, this.city, this.state, this.pincode, this.gstin, this.kycRemarks, this.managerName,
      this.latitude, this.longitude, required this.rewardBalance, required this.documents, required this.orderCount, required this.totalPurchase});
  factory PartnerProfile.fromJson(Json j) => PartnerProfile(
        userId: _i(j['userId']), name: j['name'] as String? ?? '', partnerType: j['partnerType'] as String? ?? 'Other',
        kycStatus: j['kycStatus'] as String? ?? 'NotSubmitted', phone: _s(j['phone']), email: _s(j['email']), businessName: _s(j['businessName']),
        addressLine: _s(j['addressLine']), area: _s(j['area']), city: _s(j['city']), state: _s(j['state']), pincode: _s(j['pincode']),
        gstin: _s(j['gstin']), kycRemarks: _s(j['kycRemarks']), managerName: _s(j['managerName']),
        latitude: (j['latitude'] as num?)?.toDouble(), longitude: (j['longitude'] as num?)?.toDouble(), rewardBalance: _d(j['rewardBalance']),
        documents: _list(j['documents'], KycDocument.fromJson), orderCount: _i((j['stats'] as Json?)?['orderCount']),
        totalPurchase: _d((j['stats'] as Json?)?['totalPurchase']));
  bool get approved => kycStatus == 'Approved';
}

class RewardTxn {
  final int id;
  final String createdAt, type;
  final double points, balanceAfter;
  final String? orderNo, note;
  RewardTxn(this.id, this.createdAt, this.type, this.points, this.balanceAfter, this.orderNo, this.note);
  factory RewardTxn.fromJson(Json j) => RewardTxn(_i(j['id']), j['createdAt'] as String, j['type'] as String, _d(j['points']), _d(j['balanceAfter']),
      _s(j['orderNo']), _s(j['note']));
}

class RewardSummary {
  final double balance, lifetimeEarned, thisMonthEarned, pointValueRupees;
  final List<RewardTxn> recent;
  RewardSummary(this.balance, this.lifetimeEarned, this.thisMonthEarned, this.pointValueRupees, this.recent);
  factory RewardSummary.fromJson(Json j) => RewardSummary(_d(j['balance']), _d(j['lifetimeEarned']), _d(j['thisMonthEarned']),
      _d(j['pointValueRupees']), _list(j['recent'], RewardTxn.fromJson));
}

class AppNotification {
  final int id;
  final String createdAt, title, body;
  final String? link;
  final bool isRead;
  AppNotification(this.id, this.createdAt, this.title, this.body, this.link, this.isRead);
  factory AppNotification.fromJson(Json j) =>
      AppNotification(_i(j['id']), j['createdAt'] as String, j['title'] as String, j['body'] as String, _s(j['link']), j['isRead'] as bool? ?? false);
}

class QuotationSummary {
  final int id, itemCount;
  final String quoteNo, createdAt, status, fulfilmentType;
  final double subTotal, grandTotal;
  final String? validUntil;
  final int? orderId;
  QuotationSummary(this.id, this.quoteNo, this.createdAt, this.status, this.fulfilmentType, this.itemCount, this.subTotal, this.grandTotal, this.validUntil, this.orderId);
  factory QuotationSummary.fromJson(Json j) => QuotationSummary(_i(j['id']), j['quoteNo'] as String, j['createdAt'] as String, j['status'] as String,
      j['fulfilmentType'] as String, _i(j['itemCount']), _d(j['subTotal']), _d(j['grandTotal']), _s(j['validUntil']), j['orderId'] == null ? null : _i(j['orderId']));
}

class QuotationLine {
  final int id, productId;
  final String code, name, unit;
  final String? imageUrl;
  final double quantity, listPrice, discountPercent, specialDiscountPercent, unitPrice, lineTotal, rewardPoints;
  QuotationLine(this.id, this.productId, this.code, this.name, this.unit, this.imageUrl, this.quantity, this.listPrice, this.discountPercent,
      this.specialDiscountPercent, this.unitPrice, this.lineTotal, this.rewardPoints);
  factory QuotationLine.fromJson(Json j) => QuotationLine(_i(j['id']), _i(j['productId']), j['code'] as String, j['name'] as String,
      j['unit'] as String? ?? 'pcs', _s(j['imageUrl']), _d(j['quantity']), _d(j['listPrice']), _d(j['discountPercent']), _d(j['specialDiscountPercent']),
      _d(j['unitPrice']), _d(j['lineTotal']), _d(j['rewardPoints']));
  /// Price at the customer's regular discount, before the store's extra discount.
  double get regularTotal => (listPrice * (1 - discountPercent / 100) * quantity * 100).round() / 100;
}

class Quotation {
  final QuotationSummary summary;
  final String? addressText, preferredAt, customerNotes, storeMessage, quotedAt, cancelReason, orderNo;
  final List<QuotationLine> items;
  final double discountTotal, shippingFee, roundOff, rewardPoints;
  Quotation(this.summary, this.addressText, this.preferredAt, this.customerNotes, this.storeMessage, this.quotedAt, this.cancelReason, this.orderNo,
      this.items, this.discountTotal, this.shippingFee, this.roundOff, this.rewardPoints);
  factory Quotation.fromJson(Json j) => Quotation(QuotationSummary.fromJson(j), _s(j['addressText']), _s(j['preferredAt']), _s(j['customerNotes']),
      _s(j['storeMessage']), _s(j['quotedAt']), _s(j['cancelReason']), _s(j['orderNo']), _list(j['items'], QuotationLine.fromJson),
      _d(j['discountTotal']), _d(j['shippingFee']), _d(j['roundOff']), _d(j['rewardPoints']));
}
