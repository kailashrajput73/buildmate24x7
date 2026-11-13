/// Domain models for the "Pipes & Fitting" catalog hierarchy.
///
/// Hierarchy: Category -> Type (UPVC/CPVC/PVC) -> SubCategory -> Class -> Product.
/// Populated from the live ASP.NET catalogue API, not local mock assets.
class PipesFittingProduct {
  const PipesFittingProduct({
    this.id,
    required this.brand,
    required this.productName,
    this.productGroup,
    this.length,
    this.size,
    this.productCode,
    this.stdPkg,
    required this.mrp,
    this.sellingPrice,
    this.discountRate,
    this.imageUrl,
    this.stock,
    this.unit = 'pcs',
    this.productClass,
  });

  final String? id;
  final String brand;
  final String productName;
  final String? productGroup;
  final String? length;
  final String? size;
  final String? productCode;
  final String? stdPkg;
  final double mrp;
  final double? sellingPrice;
  final double? discountRate;
  final String? imageUrl;
  final double? stock;
  final String unit;
  final String? productClass;

  double get displayPrice {
    if (sellingPrice != null && sellingPrice! > 0) return sellingPrice!;
    if (mrp > 0) return mrp;
    return 0;
  }

  factory PipesFittingProduct.fromJson(Map<String, dynamic> json) {
    return PipesFittingProduct(
      id: json['id']?.toString(),
      brand: json['brand']?.toString() ?? '',
      productName: json['productName']?.toString() ?? '',
      productGroup: json['productGroup']?.toString(),
      length: json['length']?.toString(),
      size: json['size']?.toString(),
      productCode: json['productCode']?.toString(),
      stdPkg: json['stdPkg']?.toString(),
      mrp: (json['mrp'] as num?)?.toDouble() ?? 0,
      sellingPrice: (json['sellingPrice'] as num?)?.toDouble(),
      discountRate: (json['discountRate'] as num?)?.toDouble(),
      imageUrl: json['imageUrl']?.toString(),
      stock: (json['stock'] as num?)?.toDouble(),
      unit: json['unit']?.toString() ?? 'pcs',
      productClass: json['productClass']?.toString(),
    );
  }
}

class PipesFittingClass {
  const PipesFittingClass({
    required this.className,
    required this.products,
  });

  final String className;
  final List<PipesFittingProduct> products;

  factory PipesFittingClass.fromJson(Map<String, dynamic> json) {
    return PipesFittingClass(
      className: json['class']?.toString() ?? '',
      products: (json['products'] as List<dynamic>? ?? [])
          .map((e) => PipesFittingProduct.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class PipesFittingSubCategory {
  const PipesFittingSubCategory({
    required this.subCategory,
    required this.classes,
    this.imageUrl,
  });

  final String subCategory;
  final List<PipesFittingClass> classes;
  final String? imageUrl;

  factory PipesFittingSubCategory.fromJson(Map<String, dynamic> json) {
    return PipesFittingSubCategory(
      subCategory: json['subCategory']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ?? json['imageUrl']?.toString(),
      classes: (json['classes'] as List<dynamic>? ?? [])
          .map((e) => PipesFittingClass.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  int get productCount =>
      classes.fold(0, (sum, c) => sum + c.products.length);
}

class PipesFittingType {
  const PipesFittingType({
    required this.type,
    required this.subCategories,
    this.imageUrl,
  });

  final String type;
  final List<PipesFittingSubCategory> subCategories;
  final String? imageUrl;

  factory PipesFittingType.fromJson(Map<String, dynamic> json) {
    return PipesFittingType(
      type: json['type']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ?? json['imageUrl']?.toString(),
      subCategories: (json['subCategories'] as List<dynamic>? ?? [])
          .map(
            (e) => PipesFittingSubCategory.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );
  }

  /// The Type's own server image only (no sub-category or product image
  /// fallback); null → the sidebar shows a neutral placeholder.
  String? get resolvedImageUrl {
    final url = imageUrl?.trim();
    return url == null || url.isEmpty ? null : url;
  }

  int get productCount =>
      subCategories.fold(0, (sum, s) => sum + s.productCount);
}

class PipesFittingCatalog {
  const PipesFittingCatalog({
    required this.category,
    required this.types,
  });

  final String category;
  final List<PipesFittingType> types;

  factory PipesFittingCatalog.fromJson(Map<String, dynamic> json) {
    return PipesFittingCatalog(
      category: json['category']?.toString() ?? '',
      types: (json['types'] as List<dynamic>? ?? [])
          .map((e) => PipesFittingType.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  PipesFittingType? typeByName(String name) {
    for (final type in types) {
      if (type.type.toLowerCase() == name.toLowerCase()) return type;
    }
    return null;
  }

  int get productCount =>
      types.fold(0, (sum, t) => sum + t.productCount);
}
