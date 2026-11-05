import 'dart:async';

import 'package:flutter/foundation.dart' hide Category;

import '../../features/catalog/data/catalog_fallback_loader.dart';
import '../../features/catalog/data/mock/catalog_mock_data.dart';
import '../../features/catalog/data/mappers/catalog_api_mapper.dart';
import '../../features/catalog/data/models/api_catalog_product.dart';
import '../../features/catalog/data/repositories/catalog_repository.dart';
import '../network/api_client.dart';
import '../../features/catalog/domain/models/catalog_models.dart';
import '../../features/catalog/domain/models/category_module_kind.dart';
import '../../features/catalog/domain/models/pipes_fitting_catalog_models.dart';
import '../network/api_config.dart';

/// API-backed catalog state with polling for live Pipes & Fitting data.
///
/// Also powers Home categories / featured / popular from the same backend.
class CatalogController extends ChangeNotifier {
  CatalogController({CatalogRepository? repository})
      : _repository = repository ?? CatalogRepository();

  final CatalogRepository _repository;

  Timer? _pollTimer;
  bool _disposed = false;
  bool _catalogRefreshInFlight = false;
  bool _catalogRefreshQueued = false;
  bool _isLoading = false;
  bool _isHomeLoading = false;
  bool _isPolling = false;
  String? _error;
  bool _useApi = false;
  List<ProductVariant> _apiVariants = const [];
  List<Category> _categories = const [];
  PipesFittingCatalog? _pipesFittingCatalog;
  PipesFittingCatalog? _electricalsCatalog;
  Map<String, String> _pipeMaterialTypeImages = const {};
  String _apiSyncToken = '';

  bool get isLoading => _isLoading;
  bool get isHomeLoading => _isHomeLoading;
  String? get error => _error;
  bool get isUsingApi => _useApi;
  bool get isPolling => _isPolling;

  /// Changes when API catalog content changes — use to reset UI filters.
  String get pipeCatalogFingerprint => _apiSyncToken;

  List<ProductVariant> get pipeVariants {
    if (_useApi && _apiVariants.isNotEmpty) return _apiVariants;
    return CatalogMockData.variants
        .where((v) => CatalogMockData.plumbingModuleCategoryIds
            .contains(v.categoryId))
        .toList();
  }

  /// Live categories for Home / category grids.
  List<Category> get homeCategories => _categories;

  /// Hierarchical catalog for the Pipes & Fitting category screen.
  PipesFittingCatalog? get pipesFittingCatalog => _pipesFittingCatalog;

  /// Hierarchical catalog for the Electricals category screen.
  PipesFittingCatalog? get electricalsCatalog => _electricalsCatalog;

  PipesFittingCatalog? catalogFor(CategoryModuleKind module) {
    return module == CategoryModuleKind.electricals
        ? _electricalsCatalog
        : _pipesFittingCatalog;
  }

  /// `GET /api/subcategories` images keyed for UPVC / CPVC / PVC type tiles.
  Map<String, String> get pipeMaterialTypeImages => _pipeMaterialTypeImages;

  /// Resolved server URL for a pipes sidebar **Type** row.
  String? pipeTypeSidebarImageUrl(
    String typeName, {
    String? catalogFallbackUrl,
  }) {
    return CatalogApiMapper.typeSidebarImageUrl(
      typeName,
      _pipeMaterialTypeImages,
      catalogFallbackUrl: catalogFallbackUrl,
    );
  }

  /// Featured strip: highest discount first, then price.
  List<ProductVariant> get featuredVariants {
    final list = List<ProductVariant>.from(_apiVariants);
    list.sort((a, b) {
      final ad = a.discountRate ?? 0;
      final bd = b.discountRate ?? 0;
      final byDiscount = bd.compareTo(ad);
      if (byDiscount != 0) return byDiscount;
      return a.price.compareTo(b.price);
    });
    return list.take(12).toList();
  }

  /// Popular strip: in-stock first, then by name.
  List<ProductVariant> get popularVariants {
    final list = List<ProductVariant>.from(_apiVariants);
    list.sort((a, b) {
      final stockCmp = (b.inStock ? 1 : 0).compareTo(a.inStock ? 1 : 0);
      if (stockCmp != 0) return stockCmp;
      return a.productName.compareTo(b.productName);
    });
    return list.take(12).toList();
  }

  List<CatalogProduct> get featuredProducts =>
      featuredVariants.map(CatalogApiMapper.productFromVariant).toList();

  List<CatalogProduct> get popularProducts =>
      popularVariants.map(CatalogApiMapper.productFromVariant).toList();

  ProductVariant? variantById(String id) {
    for (final v in _apiVariants) {
      if (v.id == id) return v;
    }
    return null;
  }

  /// Live product/brand/SKU search for the global Search screen.
  List<ProductVariant> searchVariants(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    return _apiVariants.where((v) {
      return v.productName.toLowerCase().contains(q) ||
          v.displayName.toLowerCase().contains(q) ||
          v.brandName.toLowerCase().contains(q) ||
          v.sku.toLowerCase().contains(q) ||
          v.categoryName.toLowerCase().contains(q) ||
          v.subCategoryName.toLowerCase().contains(q) ||
          (v.pipeType?.toLowerCase().contains(q) ?? false) ||
          v.specSummary.toLowerCase().contains(q);
    }).toList();
  }

  /// Category name matches for search results.
  List<Category> searchCategories(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    return _categories
        .where((c) => c.name.toLowerCase().contains(q))
        .toList();
  }

  /// Variants for a product id (API productCode or variant id).
  List<ProductVariant> variantsForProduct(String productId) {
    final byProduct =
        _apiVariants.where((v) => v.productId == productId).toList();
    if (byProduct.isNotEmpty) return byProduct;
    final single = variantById(productId);
    return single == null ? const [] : [single];
  }

  List<ProductVariant> pipeVariantsForSubCategory(String? subCategoryId) {
    final all = pipeVariants;
    if (subCategoryId == null) return all;
    return all.where((v) => v.subCategoryId == subCategoryId).toList();
  }

  Brand? brandById(String brandId) {
    return _brandsFromVariants().where((b) => b.id == brandId).firstOrNull;
  }

  List<Brand> brandsForPipeCategory() => catalogBrands;

  /// All brands derived from live catalog variants.
  List<Brand> get catalogBrands => _brandsFromVariants();

  Category? categoryById(String id) {
    for (final c in _categories) {
      if (c.id == id) return c;
    }
    return null;
  }

  String? _pipesCategoryId() {
    for (final c in _categories) {
      if (CatalogApiMapper.isPipesCategory(c.name)) {
        return c.id;
      }
    }
    return null;
  }

  String? _electricalCategoryId() {
    for (final c in _categories) {
      if (CatalogApiMapper.isElectricalCategory(c.name)) {
        return c.id;
      }
    }
    return null;
  }

  String? get pipesCategoryId => _pipesCategoryId();

  String? get electricalCategoryId => _electricalCategoryId();

  List<ProductVariant> variantsByBrand(String brandId) =>
      _apiVariants.where((v) => v.brandId == brandId).toList();

  List<ProductVariant> variantsForCategory(String categoryId) =>
      _apiVariants.where((v) => v.categoryId == categoryId).toList();

  CatalogProduct? productById(String id) {
    final direct = variantById(id);
    if (direct != null) return CatalogApiMapper.productFromVariant(direct);
    final group = variantsForProduct(id);
    if (group.isEmpty) return null;
    return CatalogApiMapper.productFromVariant(group.first);
  }

  ProductVariant? cheapestVariantFor(String productId) {
    final list = List<ProductVariant>.from(variantsForProduct(productId));
    if (list.isEmpty) return null;
    list.sort((a, b) => a.price.compareTo(b.price));
    return list.first;
  }

  List<SubCategory> subCategoriesFor(String categoryId) {
    final map = <String, SubCategory>{};
    for (final v in variantsForCategory(categoryId)) {
      map.putIfAbsent(
        v.subCategoryId,
        () => SubCategory(
          id: v.subCategoryId,
          categoryId: categoryId,
          name: v.subCategoryName,
        ),
      );
    }
    final counts = <String, int>{};
    for (final v in variantsForCategory(categoryId)) {
      counts[v.subCategoryId] = (counts[v.subCategoryId] ?? 0) + 1;
    }
    return map.values
        .map(
          (s) => SubCategory(
            id: s.id,
            categoryId: s.categoryId,
            name: s.name,
            productCount: counts[s.id] ?? 0,
          ),
        )
        .toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  }

  List<Brand> brandsForCategory(String categoryId) {
    final ids = variantsForCategory(categoryId).map((v) => v.brandId).toSet();
    return catalogBrands.where((b) => ids.contains(b.id)).toList();
  }

  List<CatalogProduct> productsForCategory(String categoryId) =>
      _distinctProducts(variantsForCategory(categoryId));

  List<CatalogProduct> get allCatalogProducts =>
      _distinctProducts(_apiVariants);

  List<CatalogProduct> filterCatalogProducts({
    required List<CatalogProduct> source,
    String? subCategoryId,
    String? brandId,
    String? size,
    String? material,
    ProductSort sort = ProductSort.popularity,
  }) {
    var list = List<CatalogProduct>.from(source);
    if (subCategoryId != null && subCategoryId.isNotEmpty) {
      list = list.where((p) => p.subCategoryId == subCategoryId).toList();
    }
    if (size != null && size.isNotEmpty) {
      final needle = size.toLowerCase();
      list = list.where((p) {
        final specSize = (p.specifications['Size'] ?? '').toLowerCase();
        return specSize.contains(needle) ||
            p.specSummary.toLowerCase().contains(needle);
      }).toList();
    }
    if (material != null && material.isNotEmpty) {
      final needle = material.toLowerCase();
      list = list.where((p) {
        final m = (p.specifications['Material'] ?? '').toLowerCase();
        return m.contains(needle);
      }).toList();
    }
    if (brandId != null && brandId.isNotEmpty) {
      list = list.where((p) {
        return variantsForProduct(p.id).any((v) => v.brandId == brandId);
      }).toList();
    }

    switch (sort) {
      case ProductSort.popularity:
        list.sort((a, b) {
          final pa = (a.isPopular ? 2 : 0) + (a.isFeatured ? 1 : 0);
          final pb = (b.isPopular ? 2 : 0) + (b.isFeatured ? 1 : 0);
          if (pb != pa) return pb.compareTo(pa);
          return a.name.compareTo(b.name);
        });
      case ProductSort.priceLowHigh:
        list.sort((a, b) => a.basePrice.compareTo(b.basePrice));
      case ProductSort.priceHighLow:
        list.sort((a, b) => b.basePrice.compareTo(a.basePrice));
      case ProductSort.newest:
        break;
      case ProductSort.brandAz:
        list.sort((a, b) {
          final va = cheapestVariantFor(a.id);
          final vb = cheapestVariantFor(b.id);
          return (va?.brandName ?? '').compareTo(vb?.brandName ?? '');
        });
    }
    return list;
  }

  List<String> sizeOptionsForCategory(String categoryId) {
    final values = <String>{};
    for (final v in variantsForCategory(categoryId)) {
      final size = v.specifications['Size']?.trim() ?? '';
      if (size.isNotEmpty) values.add(size);
    }
    final sorted = values.toList()..sort();
    return sorted;
  }

  List<String> attributeOptionsForCategory(
    String categoryId,
    String attributeKey,
  ) {
    final values = <String>{};
    for (final v in variantsForCategory(categoryId)) {
      final value = v.specifications[attributeKey]?.trim() ?? '';
      if (value.isNotEmpty) values.add(value);
    }
    final sorted = values.toList()..sort();
    return sorted;
  }

  List<CatalogProduct> compatibleProductsFor(
    CatalogProduct product, {
    String? sizeFilter,
  }) {
    var list = allCatalogProducts
        .where((p) => p.categoryId == product.categoryId && p.id != product.id)
        .toList();
    final size = sizeFilter?.trim();
    if (size != null && size.isNotEmpty) {
      final needle = size.toLowerCase();
      list = list.where((p) {
        final specSize = (p.specifications['Size'] ?? '').toLowerCase();
        final summary = p.specSummary.toLowerCase();
        final name = p.name.toLowerCase();
        return specSize.contains(needle) ||
            summary.contains(needle) ||
            name.contains(needle);
      }).toList();
    }
    return list.take(12).toList();
  }

  /// Discounted products surfaced as promotional offers.
  List<Offer> get catalogOffers {
    final discounted = _apiVariants
        .where((v) => (v.discountRate ?? 0) > 0)
        .toList();
    discounted.sort(
      (a, b) => (b.discountRate ?? 0).compareTo(a.discountRate ?? 0),
    );
    return discounted.take(24).map((v) {
      final pct = ((v.discountRate ?? 0) * 100).round();
      return Offer(
        id: v.id,
        title: v.productName,
        description: '${v.brandName} · ${v.displayName}',
        discountText: '$pct% OFF',
        validUntil: '',
        productIds: [v.id],
      );
    }).toList();
  }

  Offer? offerById(String offerId) {
    for (final o in catalogOffers) {
      if (o.id == offerId) return o;
    }
    return null;
  }

  List<CatalogProduct> _distinctProducts(List<ProductVariant> variants) {
    final byKey = <String, ProductVariant>{};
    for (final v in variants) {
      final key = v.productId;
      final existing = byKey[key];
      if (existing == null || v.price < existing.price) {
        byKey[key] = v;
      }
    }
    return byKey.values.map(CatalogApiMapper.productFromVariant).toList();
  }

  /// Loads categories + catalog once for Home, then starts polling.
  Future<void> refreshHomeCatalog({bool showLoading = true}) async {
    if (_disposed) return;
    if (showLoading) {
      _isHomeLoading = true;
      notifyListeners();
    }

    try {
      await _refreshCatalogFromServer(showPipeLoading: false);
    } finally {
      if (!_disposed && showLoading) {
        _isHomeLoading = false;
        notifyListeners();
      }
    }

    await startPipeCatalogSync();
  }

  /// Initial load + starts polling (idempotent).
  Future<void> startPipeCatalogSync() async {
    if (_isPolling) return;
    _isPolling = true;
    if (_apiVariants.isEmpty) {
      await refreshPipeCatalog(showLoading: true);
    }
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(
      ApiConfig.catalogPollInterval,
      (_) => refreshPipeCatalog(showLoading: false),
    );
  }

  void stopPipeCatalogSync() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _isPolling = false;
  }

  Future<void> refreshPipeCatalog({bool showLoading = false}) async {
    await _refreshCatalogFromServer(showPipeLoading: showLoading);
  }

  bool _hasCachedCatalog() {
    return _pipesFittingCatalog != null ||
        _electricalsCatalog != null ||
        _apiVariants.isNotEmpty;
  }

  void _recordCatalogFetchFailure(Object error) {
    if (!_hasCachedCatalog()) {
      _error = error.toString();
      if (_apiVariants.isEmpty && _categories.isEmpty) {
        _useApi = false;
      }
      return;
    }
    // Keep showing the last good server catalog; do not flip to mock or error UI.
    _useApi = true;
  }

  /// Single-flight catalog fetch used by Home, Pipes/Electricals, and polling.
  Future<void> _refreshCatalogFromServer({required bool showPipeLoading}) async {
    if (_disposed) return;
    if (_catalogRefreshInFlight) {
      _catalogRefreshQueued = true;
      return;
    }
    _catalogRefreshInFlight = true;

    if (showPipeLoading) {
      _isLoading = true;
      notifyListeners();
    }

    try {
      final categoriesFuture = _repository.fetchCategories();
      List<Category> categories = _categories;
      try {
        categories = await categoriesFuture;
        if (!_disposed && categories.isNotEmpty) {
          _categories = categories;
        }
      } catch (_) {
        // Keep last good categories.
      }

      final items = await _repository.fetchCatalogSkus(categories: categories);
      if (_disposed) return;

      final changed = await _applyCatalogItems(items, categories: categories);

      if (_hasCachedCatalog()) {
        _error = null;
      }
      if (changed || _categories.isNotEmpty) {
        notifyListeners();
      }
    } catch (e) {
      if (_disposed) return;
      if (await _tryApplyBundledCatalogFallback(e)) {
        notifyListeners();
      } else {
        _recordCatalogFetchFailure(e);
        notifyListeners();
      }
    } finally {
      _catalogRefreshInFlight = false;
      if (!_disposed && showPipeLoading) {
        _isLoading = false;
        notifyListeners();
      }
      if (_catalogRefreshQueued && !_disposed) {
        _catalogRefreshQueued = false;
        await _refreshCatalogFromServer(showPipeLoading: false);
      }
    }
  }

  /// Demo catalog from bundled JSON when the API blocks mobile browse (HTTP 401).
  Future<bool> _tryApplyBundledCatalogFallback(Object error) async {
    if (_hasCachedCatalog()) return false;
    final isBlocked = error is ApiException &&
        (error.statusCode == 401 ||
            error.message.contains('Unable to load catalog'));
    if (!isBlocked) return false;

    final trees = await CatalogFallbackLoader.loadBundledTrees();
    if (trees == null) return false;

    _pipesFittingCatalog = trees.pipes;
    _electricalsCatalog = trees.electricals;
    _useApi = false;
    _error = null;
    return true;
  }

  Future<Map<String, String>> _loadPipeMaterialImages() async {
    final fromTree = await _repository.fetchPipeTypeImagesFromTree();
    if (fromTree.isNotEmpty) return fromTree;

    final categoryId = _pipesCategoryId();
    if (categoryId == null || categoryId.isEmpty) return const {};
    try {
      final subs = await _repository.fetchSubcategories(categoryId: categoryId);
      return CatalogApiMapper.materialImagesFromSubcategories(subs);
    } catch (_) {
      return const {};
    }
  }

  /// Returns true when variants/tree changed.
  Future<bool> _applyCatalogItems(
    List<ApiCatalogProduct> items, {
    List<Category> categories = const [],
  }) async {
    if (categories.isNotEmpty) {
      _categories = categories;
    }

    final pipeItems = CatalogApiMapper.filterPipeItems(items);
    final electricalItems = CatalogApiMapper.filterElectricalItems(items);

    final pipesCategoryId = _pipesCategoryId() ?? '';
    final electricalCategoryId = _electricalCategoryId() ?? '';

    final materialImages = await _loadPipeMaterialImages();
    final materialImagesChanged =
        !_materialImageMapsEqual(_pipeMaterialTypeImages, materialImages);
    _pipeMaterialTypeImages = materialImages;

    var pipeVariants = CatalogApiMapper.toVariants(
      pipeItems,
      categoryId: pipesCategoryId,
      alreadyFiltered: true,
    );
    var electricalVariants = CatalogApiMapper.toVariants(
      electricalItems,
      categoryId: electricalCategoryId,
      alreadyFiltered: true,
    );

    var nextPipeTree = CatalogApiMapper.toPipesFittingCatalog(
      pipeItems,
      materialImagesByName: materialImages,
      pipesOnly: false,
    );
    var nextElectricalTree = CatalogApiMapper.toElectricalsCatalog(
      electricalItems,
      materialImagesByName: materialImages,
    );

    if (nextPipeTree.types.isEmpty &&
        (_pipesFittingCatalog?.types.isNotEmpty ?? false)) {
      nextPipeTree = _pipesFittingCatalog!;
      pipeVariants = _apiVariants
          .where((v) => CatalogApiMapper.isPipesCategory(v.categoryName))
          .toList();
    }
    if (nextElectricalTree.types.isEmpty &&
        (_electricalsCatalog?.types.isNotEmpty ?? false)) {
      nextElectricalTree = _electricalsCatalog!;
      electricalVariants = _apiVariants
          .where(
            (v) => CatalogApiMapper.isElectricalCategory(v.categoryName),
          )
          .toList();
    }

    final nextVariants = [...pipeVariants, ...electricalVariants];

    if (nextVariants.isEmpty && _apiVariants.isNotEmpty) {
      return false;
    }

    final nextToken = items.map((e) => e.syncFingerprint).join('|');

    if (nextToken == _apiSyncToken && _apiVariants.isNotEmpty) {
      if (materialImagesChanged) {
        _pipesFittingCatalog = nextPipeTree;
        _electricalsCatalog = nextElectricalTree;
        return true;
      }
      return false;
    }

    final hadCatalogBeforeApply = _hasCachedCatalog();

    _apiSyncToken = nextToken;
    _apiVariants = nextVariants;
    _pipesFittingCatalog = nextPipeTree;
    _electricalsCatalog = nextElectricalTree;
    _useApi = nextVariants.isNotEmpty;
    if (nextVariants.isEmpty && !hadCatalogBeforeApply) {
      _error = 'No products available from server';
    }
    return true;
  }

  bool _materialImageMapsEqual(
    Map<String, String> a,
    Map<String, String> b,
  ) {
    if (a.length != b.length) return false;
    for (final entry in a.entries) {
      if (b[entry.key] != entry.value) return false;
    }
    return true;
  }

  List<Brand> _brandsFromVariants() {
    final map = <String, Brand>{};
    for (final variant in _apiVariants) {
      map.putIfAbsent(
        variant.brandId,
        () => Brand(
          id: variant.brandId,
          name: variant.brandName,
          abbreviation: _abbreviation(variant.brandName),
          color: 0xFF1565C0,
          productCount: 0,
        ),
      );
    }
    for (final brand in map.values.toList()) {
      final count = _apiVariants.where((v) => v.brandId == brand.id).length;
      map[brand.id] = Brand(
        id: brand.id,
        name: brand.name,
        abbreviation: brand.abbreviation,
        color: brand.color,
        productCount: count,
      );
    }
    return map.values.toList()..sort((a, b) => a.name.compareTo(b.name));
  }

  String _abbreviation(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.length >= 2
          ? parts.first.substring(0, 2).toUpperCase()
          : parts.first.toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  void dispose() {
    _disposed = true;
    stopPipeCatalogSync();
    _repository.dispose();
    super.dispose();
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    if (!iterator.moveNext()) return null;
    return iterator.current;
  }
}
