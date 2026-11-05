import '../../../../core/network/api_config.dart';
import '../../domain/models/catalog_models.dart';
import '../../domain/models/pipes_fitting_catalog_models.dart';
import '../mock/upvc_pipe_matrix_data.dart';
import '../pipe_schedule_util.dart';
import '../models/api_catalog_product.dart';
import '../models/api_subcategory.dart';

/// Maps dashboard backend catalog JSON into existing Flutter UI models.
abstract final class CatalogApiMapper {
  /// Display name used in the app for the pipes category.
  static const String pipesCategoryName = 'PIPES & FITTING';

  /// Query value accepted by `GET /api/catalog?category=...`.
  static const String pipesCategoryQuery = 'PIPES & FITTING';

  static const String electricalCategoryName = 'ELECTRICALS';

  static const String electricalCategoryQuery = 'Electricals';

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

  /// Category query strings to try before falling back to unfiltered `GET /catalog`.
  static List<String> catalogQueryCandidates(List<Category> categories) {
    final seen = <String>{};
    final queries = <String>[];

    void add(String? value) {
      final trimmed = value?.trim() ?? '';
      if (trimmed.isEmpty) return;
      final key = trimmed.toLowerCase();
      if (!seen.add(key)) return;
      queries.add(trimmed);
    }

    for (final category in categories) {
      final name = category.name;
      if (isPipesCategory(name) || isElectricalCategory(name)) {
        add(name);
      }
    }

    add(pipesCategoryQuery);
    add('Pipes & Fittings');
    add('Plumbing Pipes & Fittings');
    add(electricalCategoryQuery);
    add(electricalCategoryName);
    add('Electrical');
    return queries;
  }

  /// Maps `GET /api/categories` row → domain [Category].
  static Category categoryFromJson(Map<String, dynamic> json) {
    final name = json['name']?.toString().trim() ?? '';
    final productCount = _toInt(json['productCount']) ?? 0;
    return Category(
      id: json['id']?.toString() ?? '',
      name: name,
      icon: 'plumbing',
      itemCount: productCount,
      iconColor: 0xFF1A56DB,
      iconBackground: 0xFFD6E4FF,
      imageAsset: _categoryImageAsset(name),
      imageUrl: _validImageUrl(json['imageUrl']?.toString()),
      description: '',
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

  static List<ApiCatalogProduct> filterPipeItems(List<ApiCatalogProduct> items) {
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

  /// Maps sidebar type labels (UPVC, CPVC, PVC) from `GET /api/subcategories`.
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

  /// Type tile images from `GET /api/catalog/tree` (UPVC / CPVC / PVC `imageUrl`).
  static Map<String, String> materialImagesFromCatalogTree(
    Map<String, dynamic> treeEnvelope,
  ) {
    final map = <String, String>{};
    final root = treeEnvelope['data'] ?? treeEnvelope;
    if (root is! Map<String, dynamic>) return map;

    final categories = root['categories'];
    if (categories is! List) return map;

    for (final entry in categories) {
      if (entry is! Map<String, dynamic>) continue;
      final categoryName = entry['name']?.toString() ?? '';
      if (!isPipesCategory(categoryName)) continue;

      final types = entry['types'];
      if (types is! List) continue;
      for (final typeEntry in types) {
        if (typeEntry is! Map<String, dynamic>) continue;
        final typeName = typeEntry['name']?.toString().trim() ?? '';
        if (typeName.isEmpty) continue;
        final url = resolveImageUrl(
          typeEntry['imageUrl']?.toString() ?? typeEntry['image_url']?.toString(),
        );
        if (url == null) continue;
        map[_pipeMaterialKey(typeName)] = url;
      }
    }
    return map;
  }

  /// Maps sub-category names (UPVC, CPVC, PVC, PVC SWR, …) to server image URLs.
  static Map<String, String> materialImagesFromSubcategories(
    List<ApiSubCategory> subcategories,
  ) {
    final map = <String, String>{};
    for (final sub in subcategories) {
      final url = resolveImageUrl(sub.imageUrl);
      if (url == null) continue;
      final material = materialTypeKeyFromName(sub.name);
      if (material != null) {
        map[_pipeMaterialKey(material)] = url;
      }
      map[_pipeMaterialKey(sub.name)] = url;
    }
    return map;
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
    final material = materialTypeKeyFromName(typeName);
    if (material != null) {
      final fromMaterial = materialImagesByName[_pipeMaterialKey(material)];
      if (fromMaterial != null && fromMaterial.isNotEmpty) {
        return resolveImageUrl(fromMaterial);
      }
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
    final nested = <String, Map<String, Map<String, List<PipesFittingProduct>>>>{};

    for (final item in pipeItems) {
      final typeName = resolveType(item);
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
      final typeProducts = subMap.values
          .expand((classMap) => classMap.values.expand((products) => products));
      final typeImageUrl = typeSidebarImageUrl(
            typeName,
            materialImagesByName,
            catalogFallbackUrl: _firstProductImageUrl(typeProducts),
          ) ??
          _firstProductImageUrl(typeProducts);
      return PipesFittingType(
        type: typeName,
        subCategories: subCategories,
        imageUrl: typeImageUrl,
      );
    }).toList();

    return PipesFittingCatalog(
      category: categoryLabel,
      types: types,
    );
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
    final stockStatus = stockStatusFromQuantity(item.stock);
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

  static String? _spreadsheetSizeLabel(double mm, String? inchLabel) {
    if (inchLabel != null &&
        inchLabel.trim().isNotEmpty &&
        RegExp(r'\d').hasMatch(inchLabel)) {
      return inchLabel.trim();
    }
    return UpvcPipeMatrixData.sizeLabelFor(mm);
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
      final spreadsheetLabel = _spreadsheetSizeLabel(mm, item.sizeInch);
      if (spreadsheetLabel != null) return spreadsheetLabel;
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

  static String _categoryImageAsset(String name) {
    final normalized = name
        .toLowerCase()
        .replaceAll('&', 'and')
        .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    const root = 'assets/images/categories/';
    if (normalized.contains('furniture')) {
      return '${root}locks_handles.png';
    }
    if (normalized.contains('valve')) {
      return '${root}valves_controls.png';
    }
    if (normalized.contains('sanitary') || normalized.contains('bath')) {
      return '${root}sanitary_wares.png';
    }
    if (normalized.contains('plywood') || normalized.contains('mdf')) {
      return '${root}consumables.png';
    }
    if (normalized.contains('waterproof') || normalized.contains('repair')) {
      return '${root}paints_putty.png';
    }
    if (normalized.contains('safety')) {
      return '${root}hardware_tools.png';
    }
    if (normalized.contains('construction') || normalized.contains('sand')) {
      return '${root}cement_plaster.png';
    }
    if (normalized.contains('pipe') ||
        normalized.contains('plumb') ||
        (normalized.contains('fitting') && !normalized.contains('furniture'))) {
      return '${root}plumbing_pipes_fittings.png';
    }
    if (normalized.contains('electr')) {
      return '${root}electricals_lights.png';
    }
    if (normalized.contains('cement') || normalized.contains('plaster')) {
      return '${root}cement_plaster.png';
    }
    if (normalized.contains('til') || normalized.contains('grout')) {
      return '${root}tiling_grouts.png';
    }
    if (normalized.contains('paint') || normalized.contains('putty')) {
      return '${root}paints_putty.png';
    }
    if (normalized.contains('fevicol') || normalized.contains('adhesive')) {
      return '${root}fevicol_adhesives.png';
    }
    if (normalized.contains('lock') || normalized.contains('handle')) {
      return '${root}locks_handles.png';
    }
    if (normalized.contains('hardware') || normalized.contains('tool')) {
      return '${root}hardware_tools.png';
    }
    return '';
  }

  static String? _firstProductImageUrl(Iterable<PipesFittingProduct> products) {
    for (final product in products) {
      final url = resolveImageUrl(product.imageUrl);
      if (url != null && url.isNotEmpty) return url;
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
    return uri.toString();
  }

  static int? _toInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString().trim());
  }
}
