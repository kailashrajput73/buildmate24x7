import '../../../../core/network/api_config.dart';
import '../../domain/models/catalog_models.dart';
import '../../domain/models/pipes_fitting_catalog_models.dart';
import '../pipe_schedule_util.dart';
import '../models/api_catalog_product.dart';

/// Maps ASP.NET catalogue DTOs into the existing Flutter UI models.
abstract final class CatalogApiMapper {
  /// Display name used in the app for the pipes category.
  static const String pipesCategoryName = 'PIPES & FITTING';

  static const String electricalCategoryName = 'ELECTRICALS';

  static bool isPipesCategory(String category) {
    final normalized = category
        .toLowerCase()
        .replaceAll('&', 'and')
        .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    return normalized.contains('pipe');
  }

  static bool isElectricalCategory(String category) {
    final normalized = category
        .toLowerCase()
        .replaceAll('&', 'and')
        .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    return normalized.contains('electr');
  }

  /// Maps a `GET /api/catalog/categories` CategoryTree DTO.
  static Category categoryFromJson(Map<String, dynamic> json) {
    final name = json['name']?.toString().trim() ?? '';
    final productCount = _toInt(json['productCount']) ?? 0;
    final subCategories = json['subCategories'] ?? json['subcategories'];
    return Category(
      id: json['id']?.toString() ?? '',
      name: name,
      icon: 'plumbing',
      itemCount: productCount,
      iconColor: 0xFF1A56DB,
      iconBackground: 0xFFD6E4FF,
      imageAsset: '',
      imageUrl: _validImageUrl(json['imageUrl']?.toString()),
      description: '',
      subCategoryIds: subCategories is List
          ? subCategories
                .whereType<Map>()
                .map((sub) => sub['id']?.toString() ?? '')
                .where((id) => id.isNotEmpty)
                .toList()
          : const [],
    );
  }

  /// Lightweight [CatalogProduct] card model from a live [ProductVariant].
  static CatalogProduct productFromVariant(ProductVariant variant) {
    return CatalogProduct(
      id: variant.id,
      sku: variant.sku,
      name: variant.productName,
      categoryId: variant.categoryId,
      categoryName: variant.categoryName,
      subCategoryId: variant.subCategoryId,
      subCategoryName: variant.subCategoryName,
      description: variant.description,
      basePrice: variant.price,
      unit: variant.unit,
      icon: variant.icon,
      imageAsset: '',
      imageUrl: variant.imageUrl,
      specifications: variant.specifications,
      specSummary: variant.specSummary.isNotEmpty
          ? variant.specSummary
          : (variant.pipeType ?? variant.brandName),
      isFeatured: variant.isFeatured,
      isPopular: variant.isPopular,
    );
  }

  static List<ApiCatalogProduct> filterPipeItems(
    List<ApiCatalogProduct> items,
  ) {
    return items
        .where((item) => item.isActive && item.id.isNotEmpty)
        .where((item) => isPipesCategory(item.category))
        .toList();
  }

  static List<ApiCatalogProduct> filterElectricalItems(
    List<ApiCatalogProduct> items,
  ) {
    return items
        .where((item) => item.isActive && item.id.isNotEmpty)
        .where((item) => isElectricalCategory(item.category))
        .toList();
  }

  /// Whether a catalog row can be ordered from its [stock] field.
  ///
  /// The dashboard API often sends `stock: 0` when inventory is not maintained.
  /// Only negative quantities are treated as explicitly unavailable.
  static bool isPurchasableStock(double? stockQty) {
    if (stockQty == null) return true;
    return stockQty >= 0;
  }

  static StockStatus stockStatusFromQuantity(double? stockQty) {
    return isPurchasableStock(stockQty)
        ? StockStatus.inStock
        : StockStatus.outOfStock;
  }

  static List<ProductVariant> toVariants(
    List<ApiCatalogProduct> items, {
    String categoryId = '',
    bool alreadyFiltered = false,
  }) {
    final list = alreadyFiltered ? items : filterPipeItems(items);
    return list
        .map((item) => _toVariant(item, categoryId: categoryId))
        .toList();
  }

  /// Resolves backend image paths (including relative `/uploads/...`) to absolute URLs.
  static String? resolveImageUrl(String? url) => _validImageUrl(url);

  /// Maps sidebar type labels (UPVC, CPVC, PVC) from the Type DTO name.
  static String? materialTypeKeyFromName(String name) {
    final normalized = name.trim().toUpperCase();
    if (normalized.isEmpty) return null;
    if (normalized.contains('UPVC')) return 'UPVC';
    if (normalized.contains('CPVC')) return 'CPVC';
    if (RegExp(r'\bPVC\b').hasMatch(normalized) ||
        normalized.contains('SWR') ||
        normalized.contains('PVCSWR')) {
      return 'PVC';
    }
    return null;
  }

  /// Server image for the **Type** sidebar row (UPVC / CPVC / PVC).
  static String? typeSidebarImageUrl(
    String typeName,
    Map<String, String> materialImagesByName, {
    String? catalogFallbackUrl,
  }) {
    final typeKey = _pipeMaterialKey(typeName);
    final fromMap = materialImagesByName[typeKey];
    if (fromMap != null && fromMap.isNotEmpty) {
      return resolveImageUrl(fromMap);
    }
    return resolveImageUrl(catalogFallbackUrl);
  }

  static String _pipeMaterialKey(String name) {
    return name.trim().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
  }

  /// Builds the category → type → subcategory → class tree used by
  /// [PipesFittingCategoryScreen] from live API rows (no mock asset).
  static PipesFittingCatalog toPipesFittingCatalog(
    List<ApiCatalogProduct> items, {
    Map<String, String> materialImagesByName = const {},
    String categoryLabel = pipesCategoryName,
    bool pipesOnly = true,
  }) {
    final pipeItems = pipesOnly ? filterPipeItems(items) : items;

    // type -> subcategory -> class -> products
    final nested =
        <String, Map<String, Map<String, List<PipesFittingProduct>>>>{};

    final typeImages = <String, String>{};
    for (final item in pipeItems) {
      final typeName = resolveType(item);
      final typeImage = _validImageUrl(item.typeImageUrl);
      if (typeImage != null) typeImages.putIfAbsent(typeName, () => typeImage);
      final subName = resolveSubCategory(item);
      final className = resolveClass(item);
      nested
          .putIfAbsent(typeName, () => {})
          .putIfAbsent(subName, () => {})
          .putIfAbsent(className, () => [])
          .add(_toPipesFittingProduct(item));
    }

    final typeOrder = const ['UPVC', 'PVC', 'CPVC', 'General'];
    final typeNames = nested.keys.toList()
      ..sort((a, b) {
        final ai = typeOrder.indexOf(a);
        final bi = typeOrder.indexOf(b);
        if (ai == -1 && bi == -1) return a.compareTo(b);
        if (ai == -1) return 1;
        if (bi == -1) return -1;
        return ai.compareTo(bi);
      });

    final types = typeNames.map((typeName) {
      final subMap = nested[typeName]!;
      final subNames = subMap.keys.toList()..sort();
      final subCategories = subNames.map((subName) {
        final classMap = subMap[subName]!;
        final classNames = classMap.keys.toList()..sort();
        final classes = classNames
            .map(
              (className) => PipesFittingClass(
                className: className,
                products: classMap[className]!,
              ),
            )
            .toList();
        final classProducts = classMap.values.expand((p) => p).toList();
        final subImageUrl = classProducts
            .map((p) => p.imageUrl)
            .whereType<String>()
            .firstWhere((url) => url.isNotEmpty, orElse: () => '');
        return PipesFittingSubCategory(
          subCategory: subName,
          classes: classes,
          imageUrl: subImageUrl.isEmpty ? null : subImageUrl,
        );
      }).toList();
      // Only the Type's own server image — never a product image (that made
      // every Type show the same pipe / cable photo). None → placeholder.
      final typeImageUrl = typeSidebarImageUrl(
        typeName,
        materialImagesByName,
        catalogFallbackUrl: typeImages[typeName],
      );
      return PipesFittingType(
        type: typeName,
        subCategories: subCategories,
        imageUrl: typeImageUrl,
      );
    }).toList();

    return PipesFittingCatalog(category: categoryLabel, types: types);
  }

  static PipesFittingCatalog toElectricalsCatalog(
    List<ApiCatalogProduct> items, {
    Map<String, String> materialImagesByName = const {},
  }) {
    return toPipesFittingCatalog(
      filterElectricalItems(items),
      materialImagesByName: materialImagesByName,
      categoryLabel: electricalCategoryName,
      pipesOnly: false,
    );
  }

  static PipesFittingProduct _toPipesFittingProduct(ApiCatalogProduct item) {
    final mrp = item.resolvedMrp;
    final selling = item.resolvedSelling;
    return PipesFittingProduct(
      id: item.id,
      brand: item.brand ?? 'Unknown',
      productName: _displayName(item),
      productGroup: item.productGroup?.trim(),
      length: item.length,
      size: _sizeLabel(item),
      productCode: item.productCode,
      stdPkg: item.stdPkg,
      mrp: mrp,
      sellingPrice: selling,
      discountRate: _resolveDiscountRate(
        discountField: item.discount,
        mrp: mrp,
        selling: selling,
      ),
      imageUrl: _validImageUrl(item.imageUrl),
      stock: item.stock,
      unit: item.unit,
      productClass: resolveClass(item),
    );
  }

  static ProductVariant _toVariant(
    ApiCatalogProduct item, {
    String categoryId = '',
  }) {
    final typeName = resolveType(item);
    final subCategoryName = resolveSubCategory(item);
    final brandName = item.brand ?? 'Unknown';
    final brandId = item.brandId ?? _brandIdFromName(brandName);
    final mrp = item.resolvedMrp;
    final selling = item.resolvedSelling;
    final discountRate = _resolveDiscountRate(
      discountField: item.discount,
      mrp: mrp,
      selling: selling,
    );
    final stockStatus = item.inStock == null
        ? stockStatusFromQuantity(item.stock)
        : item.inStock!
        ? StockStatus.inStock
        : StockStatus.outOfStock;
    final sizeLabel = _sizeLabel(item);
    final productGroup = item.productGroup?.trim();
    final displayName = _displayName(item);
    final className = resolveClass(item);

    return ProductVariant(
      id: item.id,
      productId: item.productCode ?? item.id,
      productName: displayName,
      sku: item.productCode ?? item.id,
      brandId: brandId,
      brandName: brandName,
      categoryId: categoryId.isNotEmpty
          ? categoryId
          : (item.subcategoryId ?? _subCategoryIdForType(typeName)),
      categoryName: item.category.trim().isNotEmpty
          ? item.category.trim()
          : pipesCategoryName,
      subCategoryId: item.subcategoryId ?? _subCategoryIdForType(typeName),
      subCategoryName: subCategoryName,
      description: productGroup ?? displayName,
      price: selling,
      unit: item.unit,
      icon: 'plumbing',
      rating: 4.5,
      reviewCount: 0,
      stockStatus: stockStatus,
      specifications: {
        ...item.specs,
        if (item.productCode != null) 'SKU': item.productCode!,
        if (sizeLabel != null && sizeLabel.isNotEmpty) 'Size': sizeLabel,
        if (item.length != null) 'Length': item.length!,
        if (productGroup != null) 'Product Group': productGroup,
        'Type': typeName,
        'Class': className,
      },
      imageAsset: '',
      imageUrl: _validImageUrl(item.imageUrl),
      specSummary: className,
      pipeType: typeName,
      mrp: mrp,
      discountRate: discountRate,
    );
  }

  static String resolveType(ApiCatalogProduct item) {
    final explicit = item.type?.trim();
    if (explicit != null && explicit.isNotEmpty) {
      return explicit.toUpperCase();
    }
    final hay =
        '${item.productName ?? ''} ${item.name} ${item.productGroup ?? ''}'
            .toUpperCase();
    if (hay.contains('CPVC')) return 'CPVC';
    if (hay.contains('UPVC')) return 'UPVC';
    if (RegExp(r'\bPVC\b').hasMatch(hay)) return 'PVC';
    return 'General';
  }

  static String resolveSubCategory(ApiCatalogProduct item) {
    final sub = item.subcategory?.trim();
    if (sub == null || sub.isEmpty) return 'Pipe';
    if (sub.toLowerCase() == 'pipes') return 'Pipe';
    // Title-case singular/plural labels from API.
    if (sub.toLowerCase() == 'pipe') return 'Pipe';
    if (sub.toLowerCase() == 'fitting' || sub.toLowerCase() == 'fittings') {
      return 'Fitting';
    }
    if (sub.toLowerCase() == 'tubing') return 'Tubing';
    return sub;
  }

  static String resolveClass(ApiCatalogProduct item) {
    final explicit = item.productClass?.trim();
    if (explicit != null && explicit.isNotEmpty) return explicit;
    for (final candidate in [item.productGroup, item.productName, item.name]) {
      final normalized = PipeScheduleUtil.normalizePipeSchedule(candidate);
      if (normalized != null) return normalized;
    }
    return 'General';
  }

  static String _displayName(ApiCatalogProduct item) {
    final productName = item.productName?.trim();
    if (productName != null && productName.isNotEmpty) return productName;
    return item.name.trim();
  }

  static String _subCategoryIdForType(String typeName) {
    final slug = typeName
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    if (slug.isEmpty) return 'sub-pipes-general';
    return 'cat-pipes-tubing__$slug';
  }

  static String _brandIdFromName(String brandName) {
    final slug = brandName
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    return 'brand-$slug';
  }

  static String? _sizeLabel(ApiCatalogProduct item) {
    final rawSize = item.size?.trim();
    if (rawSize != null &&
        rawSize.isNotEmpty &&
        rawSize.toUpperCase() != 'MM' &&
        RegExp(r'\d').hasMatch(rawSize)) {
      return rawSize;
    }
    if (item.sizeMm != null && item.sizeMm! > 0) {
      final mm = item.sizeMm!;
      final inchLabel = item.sizeInch?.trim();
      if (inchLabel != null && inchLabel.isNotEmpty) return inchLabel;
      final asInt = mm == mm.roundToDouble();
      return asInt ? '${mm.toInt()}mm' : '${mm}mm';
    }
    if (item.sizeInch != null &&
        item.sizeInch!.trim().isNotEmpty &&
        RegExp(r'\d').hasMatch(item.sizeInch!)) {
      return item.sizeInch!.trim();
    }
    return null;
  }

  static double? _resolveDiscountRate({
    required double? discountField,
    required double mrp,
    required double selling,
  }) {
    if (discountField != null && discountField > 0) {
      // Backend may send 8 (percent) or 0.08 (fraction).
      final rate = discountField > 1 ? discountField / 100 : discountField;
      if (rate > 0) return rate.clamp(0.0, 1.0);
    }
    if (mrp > 0 && selling < mrp) {
      return ((mrp - selling) / mrp).clamp(0.0, 1.0);
    }
    return null;
  }

  static String? _validImageUrl(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    final trimmed = url.trim();
    final parsed = Uri.tryParse(trimmed);
    if (parsed == null) return null;

    final uri = parsed.hasScheme
        ? parsed
        : Uri.parse(ApiConfig.baseUrl).resolveUri(parsed);
    if (!(uri.isScheme('http') || uri.isScheme('https')) || uri.host.isEmpty) {
      return null;
    }
    // Google Photos share links are not direct image URLs.
    if (uri.host.contains('photos.app.goo.gl') ||
        uri.host.contains('photos.google.com')) {
      return null;
    }
    if (uri.path.startsWith('/files/mock/')) return null;
    return uri.toString();
  }

  static int? _toInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString().trim());
  }
}
