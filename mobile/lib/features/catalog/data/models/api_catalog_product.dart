/// Product row mapped from the current ASP.NET catalogue DTOs.
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
    this.typeId,
    this.categoryId,
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
    this.inStock,
    this.imageUrl,
    this.specs = const {},
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
  final String? typeId;
  final String? categoryId;
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
  final bool? inStock;
  final String? imageUrl;
  final Map<String, String> specs;
  final bool isActive;
  final String? updatedAt;

  double get resolvedMrp => mrp ?? standardRate;

  /// Preserve explicit zero prices; only fall back when the API omitted price.
  double get resolvedSelling => sellingPrice ?? standardRate;

  /// Accepts both paged product cards and detailed category-item/product DTOs.
  factory ApiCatalogProduct.fromJson(Map<String, dynamic> json) {
    final catalog = json['catalog'] is Map
        ? Map<String, dynamic>.from(json['catalog'] as Map)
        : const <String, dynamic>{};
    final name = _nullableString(json['name']) ?? '';
    final rawSpecs = json['specs'] ?? json['specifications'];
    final specs = <String, String>{};
    if (rawSpecs is Map) {
      for (final entry in rawSpecs.entries) {
        final key = entry.key.toString().trim();
        if (key.isNotEmpty && entry.value != null) {
          specs[key] = entry.value.toString();
        }
      }
    } else if (rawSpecs is List) {
      for (final entry in rawSpecs.whereType<Map>()) {
        final key = _nullableString(entry['name']);
        final value = _nullableString(entry['value']);
        if (key != null && value != null) specs[key] = value;
      }
    }

    final images = json['imageUrls'];
    final imageUrl = _nullableString(json['imageUrl'] ?? json['image_url']) ??
        (images is List && images.isNotEmpty
            ? _nullableString(images.first)
            : null);
    final stockFlag = _toBool(json['inStock'] ?? json['isInStock']);
    final rawStock = _toDouble(json['stock'] ?? json['availableQty']);

    return ApiCatalogProduct(
      id: json['id']?.toString() ?? '',
      name: name,
      category: _nullableString(json['categoryName'] ?? json['category']) ?? '',
      unit: _nullableString(json['unit']) ?? 'pcs',
      standardRate: _firstNumber(
            json,
            const ['listPrice', 'standardRate', 'standard_rate', 'rate'],
          ) ??
          _toDouble(json['price']) ??
          0,
      productCode: _nullableString(
        json['code'] ?? json['productCode'] ?? json['product_code'],
      ),
      productName:
          _nullableString(json['productName'] ?? json['product_name']) ?? name,
      type: _nullableString(
        json['type'] ?? catalog['typeName'] ?? catalog['type'],
      ),
      typeId: _nullableString(json['typeId'] ?? catalog['typeId']),
      categoryId: _nullableString(json['categoryId'] ?? json['category_id']),
      productGroup: _nullableString(
        json['productGroup'] ??
            json['product_group'] ??
            catalog['productFamily'] ??
            json['family'],
      ),
      productClass: _nullableString(
        json['productClass'] ?? json['product_class'] ?? catalog['class'],
      ),
      subcategory: _nullableString(
        json['subCategoryName'] ??
            json['subcategoryName'] ??
            json['subcategory'] ??
            json['subCategory'],
      ),
      subcategoryId: _nullableString(
        json['subCategoryId'] ??
            json['subcategoryId'] ??
            json['subcategory_id'],
      ),
      brand: _nullableString(json['brandName'] ?? json['brand']),
      brandId: _nullableString(json['brandId'] ?? json['brand_id']),
      size: _nullableString(json['size'] ?? catalog['size']),
      sizeMm: _toDouble(json['sizeMm'] ?? json['size_mm']) ??
          (_nullableString(catalog['sizeUnit'])?.toLowerCase() == 'mm'
              ? _toDouble(catalog['sizeValue'])
              : null),
      sizeInch: _nullableString(json['sizeInch'] ?? json['size_inch']),
      length: _nullableString(json['length'] ?? catalog['length']),
      stdPkg: _nullableString(
        json['stdPkg'] ?? json['std_pkg'] ?? catalog['packSize'],
      ),
      mrp: _firstNumber(json, const ['mrp', 'MRP']),
      sellingPrice: _firstNumber(
        json,
        const ['price', 'sellingPrice', 'selling_price', 'salePrice', 'sale_price'],
      ),
      discount: _toDouble(
        json['discountPercent'] ??
            json['discount'] ??
            json['discount_rate'],
      ),
      stock: stockFlag == null
          ? rawStock
          : (stockFlag ? (rawStock ?? 1) : -1),
      inStock: stockFlag,
      imageUrl: imageUrl,
      specs: specs,
      isActive: json['isActive'] != false && json['is_active'] != false,
      updatedAt: _nullableString(json['updatedAt'] ?? json['updated_at']),
    );
  }

  String get syncFingerprint => [
        id,
        productCode ?? '',
        name,
        category,
        categoryId ?? '',
        type ?? '',
        typeId ?? '',
        productGroup ?? '',
        productClass ?? '',
        subcategory ?? '',
        subcategoryId ?? '',
        brand ?? '',
        brandId ?? '',
        size ?? '',
        sizeMm?.toString() ?? '',
        length ?? '',
        mrp?.toString() ?? '',
        sellingPrice?.toString() ?? '',
        discount?.toString() ?? '',
        stock?.toString() ?? '',
        inStock?.toString() ?? '',
        imageUrl ?? '',
        specs.entries.map((e) => '${e.key}:${e.value}').join(','),
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
    return double.tryParse(value.toString().replaceAll(',', '').trim());
  }

  static double? _firstNumber(
    Map<String, dynamic> json,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = _toDouble(json[key]);
      if (value != null) return value;
    }
    return null;
  }

  static bool? _toBool(dynamic value) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      return switch (value.trim().toLowerCase()) {
        'true' || '1' || 'yes' => true,
        'false' || '0' || 'no' => false,
        _ => null,
      };
    }
    return null;
  }
}
