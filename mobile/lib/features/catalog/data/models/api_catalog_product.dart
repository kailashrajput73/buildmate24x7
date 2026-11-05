/// Raw catalog item from `GET /api/catalog` (dashboard backend schema).
class ApiCatalogProduct {
  const ApiCatalogProduct({
    required this.id,
    required this.name,
    required this.category,
    required this.unit,
    required this.standardRate,
    this.productCode,
    this.productName,
    this.type,
    this.productGroup,
    this.productClass,
    this.subcategory,
    this.subcategoryId,
    this.brand,
    this.brandId,
    this.size,
    this.sizeMm,
    this.sizeInch,
    this.length,
    this.stdPkg,
    this.mrp,
    this.sellingPrice,
    this.discount,
    this.stock,
    this.imageUrl,
    this.isActive = true,
    this.updatedAt,
  });

  final String id;
  final String name;
  final String category;
  final String unit;
  final double standardRate;
  final String? productCode;
  final String? productName;
  final String? type;
  final String? productGroup;
  final String? productClass;
  final String? subcategory;
  final String? subcategoryId;
  final String? brand;
  final String? brandId;
  final String? size;
  final double? sizeMm;
  final String? sizeInch;
  final String? length;
  final String? stdPkg;
  final double? mrp;
  final double? sellingPrice;
  final double? discount;
  final double? stock;
  final String? imageUrl;
  final bool isActive;
  final String? updatedAt;

  /// MRP for display — ignores zero placeholders from the API.
  double get resolvedMrp {
    if (mrp != null && mrp! > 0) return mrp!;
    if (standardRate > 0) return standardRate;
    return 0;
  }

  /// Selling price — falls back to MRP / standard rate when selling is 0 or null.
  double get resolvedSelling {
    if (sellingPrice != null && sellingPrice! > 0) return sellingPrice!;
    if (standardRate > 0) return standardRate;
    return resolvedMrp;
  }

  factory ApiCatalogProduct.fromJson(Map<String, dynamic> json) {
    return ApiCatalogProduct(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString() ?? '',
      unit: json['unit']?.toString() ?? 'pcs',
      standardRate: _firstPositive(
            json,
            const ['standardRate', 'standard_rate', 'rate', 'price'],
          ) ??
          0,
      productCode: _nullableString(json['productCode'] ?? json['product_code']),
      productName: _nullableString(json['productName'] ?? json['product_name']),
      type: _nullableString(json['type']),
      productGroup: _nullableString(json['productGroup'] ?? json['product_group']),
      productClass: _nullableString(json['productClass'] ?? json['product_class']),
      subcategory: _nullableString(json['subcategory'] ?? json['sub_category']),
      subcategoryId:
          _nullableString(json['subcategoryId'] ?? json['subcategory_id']),
      brand: _nullableString(json['brand']),
      brandId: _nullableString(json['brandId'] ?? json['brand_id']),
      size: _nullableString(json['size']),
      sizeMm: _toDouble(json['sizeMm'] ?? json['size_mm']),
      sizeInch: _nullableString(json['sizeInch'] ?? json['size_inch']),
      length: _nullableString(json['length']),
      stdPkg: _nullableString(json['stdPkg'] ?? json['std_pkg']),
      mrp: _firstPositive(json, const ['mrp', 'MRP']),
      sellingPrice: _firstPositive(
        json,
        const ['sellingPrice', 'selling_price', 'salePrice', 'sale_price'],
      ),
      discount: _toDouble(json['discount'] ?? json['discount_rate']),
      stock: _toDouble(json['stock']),
      imageUrl: _nullableString(json['imageUrl'] ?? json['image_url']),
      isActive: json['isActive'] != false && json['is_active'] != false,
      updatedAt: _nullableString(json['updatedAt'] ?? json['updated_at']),
    );
  }

  /// Stable fingerprint for polling change detection.
  String get syncFingerprint => [
        id,
        productCode ?? '',
        name,
        category,
        type ?? '',
        productGroup ?? '',
        productClass ?? '',
        subcategory ?? '',
        brand ?? '',
        size ?? '',
        sizeMm?.toString() ?? '',
        mrp?.toString() ?? '',
        sellingPrice?.toString() ?? '',
        discount?.toString() ?? '',
        stock?.toString() ?? '',
        imageUrl ?? '',
        isActive.toString(),
        updatedAt ?? '',
      ].join('|');

  static String? _nullableString(dynamic value) {
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    final parsed = double.tryParse(value.toString().replaceAll(',', '').trim());
    return parsed;
  }

  static double? _firstPositive(
    Map<String, dynamic> json,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = _toDouble(json[key]);
      if (value != null && value > 0) return value;
    }
    return null;
  }
}
