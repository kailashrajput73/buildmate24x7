import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/category_image.dart';
import '../../domain/models/catalog_models.dart';
import '../../domain/models/category_module_kind.dart';
import '../../domain/models/pipes_fitting_catalog_models.dart';
import '../../data/mappers/catalog_api_mapper.dart';
import '../widgets/pdp_configurator_chips.dart';
import '../widgets/pipe_configurator_classes.dart';
import '../widgets/pipes_filter_panel.dart';
import '../../../../shared/widgets/delivery_pin_sheet.dart';
import '../../../../core/state/delivery_controller.dart';

/// Category-level entry screen for Plumbing Pipes & Fittings.
///
/// Single-page Category -> Type -> Sub-category drilldown: the left sidebar
/// lets the shopper pick a server-provided pipe type and sub-category
/// (Pipe/Fitting/Tubing), and the product grid on the right updates in
/// place — no new page is opened. Data is loaded live from
/// The ASP.NET catalogue API and polled for near-real-time updates.
class PipesFittingCategoryScreen extends StatefulWidget {
  const PipesFittingCategoryScreen({
    super.key,
    this.module = CategoryModuleKind.pipes,
  });

  final CategoryModuleKind module;

  @override
  State<PipesFittingCategoryScreen> createState() =>
      _PipesFittingCategoryScreenState();
}

class _CatSectionMeta {
  const _CatSectionMeta({
    required this.typeName,
    required this.label,
    this.imageUrl,
  });

  final String? typeName;
  final String label;
  final String? imageUrl;
}

class _SubCatMeta {
  const _SubCatMeta({
    required this.name,
    this.imageUrl,
  });

  final String name;
  final String? imageUrl;
}

class _CategoryProductGroup {
  const _CategoryProductGroup({
    required this.title,
    required this.subCategory,
    required this.className,
    required this.products,
  });

  final String title;
  final String subCategory;
  final String className;
  final List<PipesFittingProduct> products;

  /// Lowest customer price among SKUs with a positive price (ignores unset API rows).
  double get minMrp {
    final prices = products
        .map((p) => p.displayPrice)
        .where((price) => price > 0)
        .toList();
    if (prices.isEmpty) return 0;
    return prices.reduce((a, b) => a < b ? a : b);
  }

  String get unit => products.isNotEmpty ? products.first.unit : 'pcs';

  String get discountLabel {
    final rates = products
        .map((p) => p.discountRate)
        .whereType<double>()
        .where((r) => r > 0);
    if (rates.isEmpty) return '';
    final maxRate = rates.reduce((a, b) => a > b ? a : b);
    return 'discount ${(maxRate * 100).round()}%';
  }
}

bool _isFittingSubCategory(String? subCategory) {
  switch (subCategory?.trim().toLowerCase()) {
    case 'fitting':
    case 'fittings':
      return true;
    default:
      return false;
  }
}

/// Strips brand, material, and size tokens so fittings share one grid tile.
String _normalizeFittingFamilyLabel(String raw, {required String brand}) {
  var name = raw.trim();
  if (name.isEmpty) return '';
  if (brand.trim().isNotEmpty) {
    name = name.replaceAll(
      RegExp(RegExp.escape(brand.trim()), caseSensitive: false),
      ' ',
    );
  }
  name = name.replaceAll(
    RegExp(r'\b(upvc|cpvc|pvc|swr|hdpe)\b', caseSensitive: false),
    ' ',
  );
  name = name.replaceAll(
    RegExp(r'\d+\s*(mm)?\s*x\s*\d+\s*(mm)?', caseSensitive: false),
    ' ',
  );
  name = name.replaceAll(RegExp(r'\d+(\.\d+)?\s*"\b'), ' ');
  name = name.replaceAll(RegExp(r'\d+\s*mm\b', caseSensitive: false), ' ');
  name = name.replaceAll(RegExp(r'\(\s*[^)]+\)'), ' ');
  name = name.replaceAll(RegExp(r'\bell\b', caseSensitive: false), 'elbow');
  name = _normalizeProductFamilyLabel(name);
  name = name.replaceAll(RegExp(r'[^\w\s]'), ' ');
  name = name.replaceAll(RegExp(r'\s+'), ' ').trim();
  return name.toLowerCase();
}

/// Merges multi-brand pipe/tubing rows without collapsing different diameters.
String _normalizePipeProductGroupKey(String raw, {required String brand}) {
  var name = raw.trim();
  if (name.isEmpty) return '';
  if (brand.trim().isNotEmpty) {
    name = name.replaceAll(
      RegExp(RegExp.escape(brand.trim()), caseSensitive: false),
      ' ',
    );
  }
  name = name.replaceAll(
    RegExp(r'\b(upvc|cpvc|pvc|swr|hdpe)\b', caseSensitive: false),
    ' ',
  );
  name = _normalizeProductFamilyLabel(name);
  name = name.replaceAll(RegExp(r'[^\w\s]'), ' ');
  name = name.replaceAll(RegExp(r'\s+'), ' ').trim();
  return name.toLowerCase();
}

String _catalogFamilyToken(
  PipesFittingProduct product, {
  String? subCategory,
}) {
  final isFitting = _isFittingSubCategory(subCategory);
  final group = product.productGroup?.trim();
  if (group != null && group.isNotEmpty) {
    final fromGroup = isFitting
        ? _normalizeFittingFamilyLabel(group, brand: product.brand)
        : _normalizePipeProductGroupKey(group, brand: product.brand);
    if (fromGroup.isNotEmpty) return fromGroup;
  }
  final base = _productLineBaseName(product);
  if (base.isNotEmpty) {
    final fromBase = isFitting
        ? _normalizeFittingFamilyLabel(base, brand: product.brand)
        : _normalizePipeProductGroupKey(base, brand: product.brand);
    if (fromBase.isNotEmpty) return fromBase;
  }
  if (isFitting) {
    return _normalizeFittingFamilyLabel(
      product.productName,
      brand: product.brand,
    );
  }
  return _normalizeProductFamilyLabel(product.productName);
}

String _familyTokenDisplayTitle(String token, {String? rawGroup}) {
  final trimmedGroup = rawGroup?.trim();
  if (trimmedGroup != null &&
      trimmedGroup.isNotEmpty &&
      !RegExp(r'\d').hasMatch(trimmedGroup) &&
      trimmedGroup.length <= 40) {
    return trimmedGroup;
  }
  if (token.isEmpty) return token;
  return token
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map(
        (part) =>
            '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}

/// Groups size/brand variants of the same fitting or pipe line for grid cards.
String _productLineKey(
  PipesFittingProduct product, {
  String? subCategory,
}) {
  final token = _catalogFamilyToken(product, subCategory: subCategory);
  if (token.isNotEmpty) return 'group:$token';
  final code = product.productCode?.trim();
  if (code != null && code.isNotEmpty) return 'code:${code.toLowerCase()}';
  return 'id:${product.id ?? product.productName.hashCode}';
}

String _productLineTitle(
  PipesFittingProduct product, {
  String? subCategory,
}) {
  if (_isFittingSubCategory(subCategory)) {
    final token = _catalogFamilyToken(product, subCategory: subCategory);
    if (token.isNotEmpty) {
      return _familyTokenDisplayTitle(
        token,
        rawGroup: product.productGroup,
      );
    }
  }
  final group = product.productGroup?.trim();
  if (group != null && group.isNotEmpty) return group;
  final base = _productLineBaseName(product);
  if (base.isNotEmpty) return base;
  return product.productName.trim();
}

String _productLineBaseName(PipesFittingProduct product) {
  var name = product.productName.trim();
  final brand = product.brand.trim();
  if (brand.isNotEmpty) {
    name = name.replaceAll(
      RegExp(RegExp.escape(brand), caseSensitive: false),
      '',
    );
  }
  final size = product.size?.trim();
  if (size != null && size.isNotEmpty) {
    final pattern = RegExp(
      RegExp.escape(size),
      caseSensitive: false,
    );
    name = name.replaceAll(pattern, '').trim();
  }
  name = name.replaceAll(
    RegExp(r'\d+\s*MM\s*(\([^)]*\))?', caseSensitive: false),
    '',
  );
  name = name.replaceAll(
    RegExp(r'\b(SCH\s*\d+|SDR\s*[\d.]+|\d+\s*KG|CLASS\s*\d+|PN\s*\d+)\b', caseSensitive: false),
    '',
  );
  name = name.replaceAll(RegExp(r'\s*,\s*'), ', ');
  return name.replaceAll(RegExp(r',?\s*$'), '').trim();
}

/// Strips schedule / pressure tier so Sch 40 vs Sch 80 share one family.
String _normalizeProductFamilyLabel(String raw) {
  var name = raw.trim();
  name = name.replaceAll(RegExp(r'sch\s*\d+', caseSensitive: false), '');
  name = name.replaceAll(RegExp(r'sdr\s*[\d.]+', caseSensitive: false), '');
  name = name.replaceAll(RegExp(r'\d+\s*kg', caseSensitive: false), '');
  name = name.replaceAll(RegExp(r'\s+'), ' ').trim();
  return name.toLowerCase();
}

String _productFamilyKey(
  PipesFittingProduct product, {
  String? subCategory,
}) {
  final token = _catalogFamilyToken(product, subCategory: subCategory);
  if (token.isNotEmpty) {
    final prefix = _isFittingSubCategory(subCategory) ? 'fit' : 'pg';
    return '$prefix:$token';
  }
  return _productLineKey(product, subCategory: subCategory);
}

bool _sameProductFamily(
  PipesFittingProduct a,
  PipesFittingProduct b, {
  String? subCategory,
}) =>
    _productFamilyKey(a, subCategory: subCategory) ==
    _productFamilyKey(b, subCategory: subCategory);

bool _pipeBrandMatches(String a, String b) =>
    a.trim().toLowerCase() == b.trim().toLowerCase();

bool _pipeSizeMatches(String? a, String? b) {
  if (a == null || b == null) return false;
  final left = a.trim();
  final right = b.trim();
  if (left.isEmpty || right.isEmpty) return false;
  if (left.toLowerCase() == right.toLowerCase()) return true;
  final leftMm = pipeSizeMmValue(left);
  final rightMm = pipeSizeMmValue(right);
  return leftMm != null && rightMm != null && leftMm == rightMm;
}

String? _representativeImageUrl(List<PipesFittingProduct> products) {
  final counts = <String, int>{};
  for (final product in products) {
    final url = product.imageUrl?.trim();
    if (url == null || url.isEmpty) continue;
    counts[url] = (counts[url] ?? 0) + 1;
  }
  if (counts.isEmpty) return null;
  return counts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
}

String _productClassLabel(PipesFittingProduct product, String fallback) {
  final value = product.productClass?.trim();
  if (value != null && value.isNotEmpty) return value;
  return fallback;
}

/// Splits a merged product line into per-class groups for the configurator.
List<_CategoryProductGroup> splitGroupByProductClass(
  _CategoryProductGroup group,
) {
  final buckets = <String, List<PipesFittingProduct>>{};
  for (final product in group.products) {
    final className = _productClassLabel(product, group.className);
    buckets.putIfAbsent(className, () => []).add(product);
  }
  if (buckets.length <= 1) return [group];
  return buckets.entries
      .map(
        (entry) => _CategoryProductGroup(
          title: group.title,
          subCategory: group.subCategory,
          className: entry.key,
          products: entry.value,
        ),
      )
      .toList();
}

bool _productMatchesClassSelection(
  PipesFittingProduct product,
  String groupClassName,
  String classFilter,
) {
  final label = _productClassLabel(product, groupClassName);
  return PipeFilterClasses.matches(label, classFilter) ||
      PipeConfiguratorClasses.matchesCanonical(classFilter, label);
}

/// Class filter labels for the header dropdown — only classes that exist on the server.
List<String> pipeClassFilterOptionsForCatalog(
  PipesFittingCatalog catalog,
  String? typeName,
) {
  final serverLabels = <String>{};
  final types = typeName == null
      ? catalog.types
      : catalog.types.where(
          (type) => type.type.toLowerCase() == typeName.toLowerCase(),
        );
  for (final type in types) {
    for (final subCategory in type.subCategories) {
      for (final pipeClass in subCategory.classes) {
        final className = pipeClass.className.trim();
        if (className.isNotEmpty) serverLabels.add(className);
        for (final product in pipeClass.products) {
          final label = _productClassLabel(product, pipeClass.className).trim();
          if (label.isNotEmpty) serverLabels.add(label);
        }
      }
    }
  }

  final seen = <String>{};
  final ordered = <String>[];
  void add(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return;
    final key = trimmed.toLowerCase();
    if (seen.add(key)) ordered.add(trimmed);
  }

  final canonical = PipeConfiguratorClasses.optionsForType(typeName);
  if (canonical.isNotEmpty) {
    for (final canon in canonical) {
      final hasProduct = serverLabels.any(
        (server) => PipeConfiguratorClasses.matchesCanonical(canon, server),
      );
      if (hasProduct) add(canon);
    }
    for (final server in serverLabels) {
      final mapped = canonical.any(
        (canon) => PipeConfiguratorClasses.matchesCanonical(canon, server),
      );
      if (!mapped) add(server);
    }
  } else {
    for (final server in serverLabels) {
      add(server);
    }
  }

  ordered.sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
  return ordered;
}

List<String> pipeClassOptionsForFamily(
  List<_CategoryProductGroup> familyGroups, {
  String? typeName,
}) {
  final serverLabels = <String>{};
  for (final group in familyGroups) {
    for (final product in group.products) {
      final label = _productClassLabel(product, group.className).trim();
      if (label.isNotEmpty) serverLabels.add(label);
    }
  }

  final canonical = PipeConfiguratorClasses.optionsForType(typeName);
  if (canonical.isNotEmpty) {
    final options = <String>[];
    for (final canon in canonical) {
      if (serverLabels.any(
        (server) => PipeConfiguratorClasses.matchesCanonical(canon, server),
      )) {
        options.add(canon);
      }
    }
    if (options.isNotEmpty) return options;
  }

  final list = serverLabels.toList();
  list.sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
  return list;
}

String pipeClassOptionMatchingLabel(
  List<String> options,
  String currentLabel,
) {
  for (final option in options) {
    if (PipeConfiguratorClasses.matchesCanonical(option, currentLabel) ||
        PipeFilterClasses.matches(option, currentLabel)) {
      return option;
    }
  }
  return currentLabel;
}

double listPriceForProductGroup(
  _CategoryProductGroup group,
  CatalogController catalog,
) {
  final prices = <double>[];
  for (final product in group.products) {
    var value = product.displayPrice;
    if (value <= 0 && product.id != null) {
      final live = catalog.variantById(product.id!);
      if (live != null && live.price > 0) value = live.price;
    }
    if (value > 0) prices.add(value);
  }
  if (prices.isEmpty) return 0;
  return prices.reduce((a, b) => a < b ? a : b);
}

_CategoryProductGroup _groupWithClassFilter(
  _CategoryProductGroup group,
  String classFilter,
) {
  final filtered = group.products
      .where(
        (p) => _productMatchesClassSelection(p, group.className, classFilter),
      )
      .toList();
  if (filtered.isEmpty) return group;
  return _CategoryProductGroup(
    title: group.title,
    subCategory: group.subCategory,
    className: classFilter,
    products: filtered,
  );
}

List<PipesFittingProduct> _catalogProductsForSection(
  PipesFittingCatalog catalog,
  String? typeName,
  String? subCategory,
) {
  final types = typeName == null
      ? catalog.types
      : catalog.types.where(
          (type) => type.type.toLowerCase() == typeName.toLowerCase(),
        );
  final products = <PipesFittingProduct>[];
  for (final type in types) {
    for (final sub in type.subCategories) {
      if (subCategory != null &&
          sub.subCategory.toLowerCase() != subCategory.toLowerCase()) {
        continue;
      }
      for (final cls in sub.classes) {
        products.addAll(cls.products);
      }
    }
  }
  return products;
}

List<_CategoryProductGroup> buildPipeCatalogGroupsForSection(
  PipesFittingCatalog catalog,
  String? typeName,
  String? subCategory,
) {
  final types = typeName == null
      ? catalog.types
      : catalog.types.where(
          (type) => type.type.toLowerCase() == typeName.toLowerCase(),
        );

  final groups = <_CategoryProductGroup>[];
  for (final type in types) {
    for (final sub in type.subCategories) {
      if (subCategory != null &&
          sub.subCategory.toLowerCase() != subCategory.toLowerCase()) {
        continue;
      }
      final buckets = <String, List<PipesFittingProduct>>{};
      for (final cls in sub.classes) {
        for (final product in cls.products) {
          final key = _productFamilyKey(
            product,
            subCategory: sub.subCategory,
          );
          final bucket = buckets.putIfAbsent(key, () => []);
          final id = product.id?.trim();
          if (id != null &&
              id.isNotEmpty &&
              bucket.any((p) => p.id?.trim() == id)) {
            continue;
          }
          bucket.add(product);
        }
      }
      for (final lineProducts in buckets.values) {
        if (lineProducts.isEmpty) continue;
        final representative = lineProducts.first;
        groups.add(
          _CategoryProductGroup(
            title: _productLineTitle(
              representative,
              subCategory: sub.subCategory,
            ),
            subCategory: sub.subCategory,
            className: _productClassLabel(representative, ''),
            products: lineProducts,
          ),
        );
      }
    }
  }
  return groups;
}

String? resolvePipeTypeForProduct(
  PipesFittingCatalog catalog,
  PipesFittingProduct product,
) {
  final productId = product.id?.trim();
  final productCode = product.productCode?.trim().toLowerCase();

  for (final type in catalog.types) {
    for (final sub in type.subCategories) {
      for (final cls in sub.classes) {
        for (final candidate in cls.products) {
          if (productId != null &&
              productId.isNotEmpty &&
              candidate.id?.trim() == productId) {
            return type.type;
          }
          final code = candidate.productCode?.trim().toLowerCase();
          if (productCode != null &&
              productCode.isNotEmpty &&
              code == productCode) {
            return type.type;
          }
        }
      }
    }
  }
  return null;
}

List<_CategoryProductGroup> configuratorLineGroups({
  required List<_CategoryProductGroup> catalogPool,
  required _CategoryProductGroup initialGroup,
  required PipesFittingProduct anchor,
}) {
  final subCategory = initialGroup.subCategory;
  final lineKey = _productLineKey(anchor, subCategory: subCategory);
  final lineTitle = _productLineTitle(anchor, subCategory: subCategory);

  final familyKey = _productFamilyKey(anchor, subCategory: subCategory);
  final matched = catalogPool.where((g) {
    if (g.subCategory.toLowerCase() != initialGroup.subCategory.toLowerCase()) {
      return false;
    }
    if (g.products.isEmpty) return false;
    return g.products.any((p) {
      if (_productFamilyKey(p, subCategory: subCategory) == familyKey) {
        return true;
      }
      if (_productLineKey(p, subCategory: subCategory) == lineKey) {
        return true;
      }
      if (_productLineTitle(p, subCategory: subCategory) == lineTitle) {
        return true;
      }
      return _catalogFamilyToken(p, subCategory: subCategory) ==
          _catalogFamilyToken(anchor, subCategory: subCategory);
    });
  }).toList();

  if (matched.isNotEmpty) return matched;
  return catalogPool
      .where(
        (g) =>
            g.subCategory.toLowerCase() ==
            initialGroup.subCategory.toLowerCase(),
      )
      .toList();
}

/// Maps a live [PipesFittingProduct] into a [ProductVariant] so it can be
/// added to the shared [CartController] like any other catalog product.
ProductVariant _variantFor(
  PipesFittingProduct product,
  _CategoryProductGroup group, {
  String? categoryId,
}) {
  final fallbackId = [
    product.brand,
    product.productName,
    product.size ?? '',
    product.productCode ?? '',
  ].join('|').toLowerCase().hashCode;

  final stockStatus = CatalogApiMapper.stockStatusFromQuantity(product.stock);

  return ProductVariant(
    id: product.id ?? 'pipe-$fallbackId',
    productId: product.productCode ?? product.id ?? 'pipe-product-$fallbackId',
    productName: product.productName,
    sku: product.productCode ?? '',
    brandId: 'brand-${product.brand.toLowerCase().replaceAll(' ', '-')}',
    brandName: product.brand,
    categoryId: categoryId ?? '',
    categoryName: 'PIPES & FITTING',
    subCategoryId: group.subCategory.toLowerCase(),
    subCategoryName: group.subCategory,
    description: group.title,
    price: product.displayPrice,
    unit: product.unit.isNotEmpty ? product.unit : group.unit,
    icon: 'plumbing',
    rating: 0,
    reviewCount: 0,
    stockStatus: stockStatus,
    specifications: {
      if (product.size != null) 'Size': product.size!,
      if (product.length != null) 'Length': product.length!,
      if (product.stdPkg != null) 'Std. Packaging': product.stdPkg!,
      'Class': product.productClass ?? group.className,
    },
    imageAsset: '',
    imageUrl: product.imageUrl,
    mrp: product.mrp,
    discountRate: product.discountRate,
  );
}

class _PipesFittingCategoryScreenState
    extends State<PipesFittingCategoryScreen> {
  static const _allSection = _CatSectionMeta(
    typeName: null,
    label: 'All',
  );

  String? _selectedType;
  String? _subCategory;
  PipeModuleSort _sort = PipeModuleSort.all;
  String? _selectedBrand;
  String? _size;
  String? _class;
  final GlobalKey _sortButtonKey = GlobalKey();
  final GlobalKey _sizeButtonKey = GlobalKey();
  final GlobalKey _brandButtonKey = GlobalKey();
  final GlobalKey _classButtonKey = GlobalKey();
  OverlayEntry? _sortOverlay;
  OverlayEntry? _sizeOverlay;
  OverlayEntry? _brandOverlay;
  OverlayEntry? _classOverlay;

  PipesFittingCatalog? _activeCatalog(CatalogController catalog) =>
      catalog.catalogFor(widget.module);

  bool _isCatalogMissing(CatalogController catalog) =>
      _activeCatalog(catalog) == null;

  String get _screenTitle => widget.module == CategoryModuleKind.electricals
      ? 'Electricals'
      : 'Plumbing Pipes & Fittings';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final catalog = context.read<CatalogController>();
      catalog.startPipeCatalogSync();
      catalog.refreshPipeCatalog(
        showLoading: _isCatalogMissing(catalog),
      );
    });
  }

  @override
  void dispose() {
    _closeSortMenu();
    _closeSizeMenu();
    _closeBrandMenu();
    _closeClassMenu();
    super.dispose();
  }

  List<_SubCatMeta> _subCategoryItems(
    PipesFittingCatalog catalog,
    String? typeName,
  ) {
    final items = <_SubCatMeta>[];
    final types = typeName == null
        ? catalog.types
        : catalog.types.where(
            (type) => type.type.toLowerCase() == typeName.toLowerCase(),
          );
    for (final type in types) {
      for (final sub in type.subCategories) {
        final lower = sub.subCategory.toLowerCase();
        if (!items.any((item) => item.name.toLowerCase() == lower)) {
          String? url = sub.imageUrl;
          if (url == null || url.isEmpty) {
            for (final cls in sub.classes) {
              for (final p in cls.products) {
                if (p.imageUrl != null && p.imageUrl!.isNotEmpty) {
                  url = p.imageUrl;
                  break;
                }
              }
              if (url != null && url.isNotEmpty) break;
            }
          }
          items.add(_SubCatMeta(
            name: sub.subCategory,
            imageUrl: (url != null && url.isNotEmpty) ? url : null,
          ));
        }
      }
    }
    items.sort((a, b) {
      final order = _subCategoryDisplayOrder(a.name)
          .compareTo(_subCategoryDisplayOrder(b.name));
      if (order != 0) return order;
      return a.name.compareTo(b.name);
    });
    return items;
  }

  /// Pipe before Fitting; other sub-categories follow alphabetically.
  static int _subCategoryDisplayOrder(String name) {
    final lower = name.toLowerCase();
    if (lower == 'pipe' || lower == 'pipes') return 0;
    if (lower == 'fitting' || lower == 'fittings') return 1;
    return 2;
  }

  List<_CategoryProductGroup> _groupsForSection(
    PipesFittingCatalog catalog,
    String? typeName,
    String? subCategory,
  ) =>
      buildPipeCatalogGroupsForSection(catalog, typeName, subCategory);

  List<String> _classNamesForCatalog(
    PipesFittingCatalog catalog,
    String? typeName,
  ) =>
      pipeClassFilterOptionsForCatalog(catalog, typeName);

  List<String> _sizeNamesForCatalog(PipesFittingCatalog catalog) {
    final sizes = _groupsForSection(catalog, _selectedType, _subCategory)
        .expand((group) => group.products)
        .map((product) => product.size?.trim())
        .whereType<String>()
        .where((size) => size.isNotEmpty)
        .toSet()
        .toList();
    sortPipeSizesAscending(sizes);
    return sizes;
  }

  bool _matchesBrand(_CategoryProductGroup group, String brand) {
    return group.products.any(
      (p) => p.brand.toLowerCase() == brand.toLowerCase(),
    );
  }

  bool _matchesSize(_CategoryProductGroup group, String sizeLabel) {
    final targetMm = pipeSizeMmValue(sizeLabel);
    if (targetMm == null) {
      return group.products.any(
        (product) =>
            product.size?.trim().toLowerCase() ==
            sizeLabel.trim().toLowerCase(),
      );
    }
    return group.products.any((p) {
      final raw = p.size ?? '';
      final mm = pipeSizeMmValue(raw);
      if (mm != null && mm == targetMm) return true;
      return raw.toLowerCase().contains('${targetMm.toInt()}');
    });
  }

  List<_CategoryProductGroup> _filteredGroups(PipesFittingCatalog catalog) {
    var groups = _groupsForSection(catalog, _selectedType, _subCategory);

    if (_selectedBrand != null) {
      groups = groups.where((g) => _matchesBrand(g, _selectedBrand!)).toList();
    }
    if (_size != null && _size!.isNotEmpty) {
      groups = groups.where((g) => _matchesSize(g, _size!)).toList();
    }
    if (_class != null) {
      groups = groups
          .map((g) => _groupWithClassFilter(g, _class!))
          .where((g) => g.products.isNotEmpty)
          .toList();
    }

    switch (_sort) {
      case PipeModuleSort.all:
        break;
      case PipeModuleSort.discount:
        break;
      case PipeModuleSort.priceLowHigh:
        groups.sort((a, b) => a.minMrp.compareTo(b.minMrp));
      case PipeModuleSort.whatsNew:
        groups = groups.reversed.toList();
      case PipeModuleSort.priceHighLow:
        groups.sort((a, b) => b.minMrp.compareTo(a.minMrp));
      case PipeModuleSort.ratings:
        break;
    }
    return groups;
  }

  String _pluralize(String value) =>
      value.toLowerCase().endsWith('s') ? value : '${value}s';

  String _titleFor(PipesFittingCatalog catalog) {
    final typeLabel = _selectedType;
    if (typeLabel == null && _subCategory == null) return catalog.category;
    if (typeLabel != null && _subCategory != null) {
      return '$typeLabel ${_pluralize(_subCategory!)}';
    }
    if (typeLabel != null) return '$typeLabel Products';
    return _pluralize(_subCategory!);
  }

  String _subtitleFor(PipesFittingCatalog catalog) {
    final typeLabel = _selectedType;
    if (_selectedBrand != null) {
      final scope = typeLabel ?? catalog.category;
      return '$_selectedBrand brand $scope products';
    }
    if (typeLabel != null && _subCategory != null) {
      return 'High quality $typeLabel ${_subCategory!.toLowerCase()}s for various applications';
    }
    if (typeLabel != null) {
      return 'Browse $typeLabel pipes, fittings and accessories';
    }
    return 'Wide range of pipes, fittings and accessories';
  }

  void _closeSortMenu() {
    _sortOverlay?.remove();
    _sortOverlay = null;
  }

  void _closeSizeMenu() {
    _sizeOverlay?.remove();
    _sizeOverlay = null;
  }

  void _closeBrandMenu() {
    _brandOverlay?.remove();
    _brandOverlay = null;
  }

  void _closeClassMenu() {
    _classOverlay?.remove();
    _classOverlay = null;
  }

  void _closeAllMenus() {
    _closeSortMenu();
    _closeSizeMenu();
    _closeBrandMenu();
    _closeClassMenu();
  }

  void _showDropdown({
    required GlobalKey buttonKey,
    required ValueChanged<OverlayEntry?> setOverlay,
    required VoidCallback closeThis,
    required double menuWidth,
    required Widget Function() buildMenu,
  }) {
    final renderBox =
        buttonKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return;
    final offset = renderBox.localToGlobal(Offset.zero);
    final size = renderBox.size;

    final entry = OverlayEntry(
      builder: (context) {
        final screenWidth = MediaQuery.sizeOf(context).width;
        const edgeMargin = AppSpacing.space3;
        // Anchor to the button's right edge, but clamp so the menu never
        // spills off either side of the screen.
        final maxLeft = screenWidth - menuWidth - edgeMargin;
        final left = (offset.dx + size.width - menuWidth).clamp(
          edgeMargin,
          maxLeft < edgeMargin ? edgeMargin : maxLeft,
        );

        return Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onTap: closeThis,
              ),
            ),
            Positioned(
              top: offset.dy + size.height + AppSpacing.space1,
              left: left,
              width: menuWidth,
              child: buildMenu(),
            ),
          ],
        );
      },
    );
    setOverlay(entry);
    Overlay.of(context).insert(entry);
  }

  void _toggleSortMenu() {
    if (_sortOverlay != null) {
      _closeSortMenu();
      return;
    }
    _closeAllMenus();
    _showDropdown(
      buttonKey: _sortButtonKey,
      setOverlay: (entry) => _sortOverlay = entry,
      closeThis: _closeSortMenu,
      menuWidth: 240,
      buildMenu: () => _SortDropdownMenu(
        selectedSort: _sort,
        onSelected: (sort) {
          setState(() => _sort = sort);
          _closeSortMenu();
        },
      ),
    );
  }

  void _toggleSizeMenu() {
    if (_sizeOverlay != null) {
      _closeSizeMenu();
      return;
    }
    _closeAllMenus();
    final catalog = _activeCatalog(context.read<CatalogController>());
    _showDropdown(
      buttonKey: _sizeButtonKey,
      setOverlay: (entry) => _sizeOverlay = entry,
      closeThis: _closeSizeMenu,
      menuWidth: 200,
      buildMenu: () => _SizeDropdownMenu(
        sizes: catalog == null
            ? const <String>[]
            : _sizeNamesForCatalog(catalog),
        selectedSize: _size,
        onSelected: (size) {
          setState(() => _size = size);
          _closeSizeMenu();
        },
      ),
    );
  }

  List<String> _brandNamesForFilter(PipesFittingCatalog catalog) =>
      PipeFilterBrands.fromPipesCatalog(catalog);

  void _toggleBrandMenu() {
    if (_brandOverlay != null) {
      _closeBrandMenu();
      return;
    }
    _closeAllMenus();
    final catalog = _activeCatalog(context.read<CatalogController>());
    final brandNames = catalog != null
        ? _brandNamesForFilter(catalog)
        : const <String>[];
    _showDropdown(
      buttonKey: _brandButtonKey,
      setOverlay: (entry) => _brandOverlay = entry,
      closeThis: _closeBrandMenu,
      menuWidth: 220,
      buildMenu: () => _BrandDropdownMenu(
        brands: brandNames,
        selectedBrand: _selectedBrand,
        onSelected: (brand) {
          setState(() => _selectedBrand = brand);
          _closeBrandMenu();
        },
      ),
    );
  }

  void _toggleClassMenu() {
    if (_classOverlay != null) {
      _closeClassMenu();
      return;
    }
    _closeAllMenus();
    final catalog = _activeCatalog(context.read<CatalogController>());
    _showDropdown(
      buttonKey: _classButtonKey,
      setOverlay: (entry) => _classOverlay = entry,
      closeThis: _closeClassMenu,
      menuWidth: 200,
      buildMenu: () => _ClassDropdownMenu(
        classes: catalog == null
            ? const <String>[]
            : _classNamesForCatalog(catalog, _selectedType),
        selectedClass: _class,
        onSelected: (className) {
          setState(() => _class = className);
          _closeClassMenu();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      // Guard against very short viewports (e.g. web with DevTools docked):
      // enforce a minimum height and let the page scroll instead of overflowing.
      body: LayoutBuilder(
        builder: (context, constraints) {
          const minBodyHeight = 480.0;
          if (constraints.maxHeight >= minBodyHeight) {
            return _buildBody(context);
          }
          return SingleChildScrollView(
            child: SizedBox(height: minBodyHeight, child: _buildBody(context)),
          );
        },
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    return Column(
      children: [
        _CategoryHeader(
          screenTitle: _screenTitle,
          sort: _sort,
          selectedSize: _size,
          selectedBrand: _selectedBrand,
          selectedClass: _class,
          sortButtonKey: _sortButtonKey,
          sizeButtonKey: _sizeButtonKey,
          brandButtonKey: _brandButtonKey,
          classButtonKey: _classButtonKey,
          onBack: () => Navigator.of(context).maybePop(),
          onSearch: () => Navigator.of(
            context,
          ).pushNamed(AppRoutes.search, arguments: const SearchArgs()),
          onSortTap: _toggleSortMenu,
          onSizeTap: _toggleSizeMenu,
          onBrandTap: _toggleBrandMenu,
          onClassTap: _toggleClassMenu,
        ),
        Expanded(child: _buildCatalogContent(context)),
      ],
    );
  }

  Widget _buildCatalogContent(BuildContext context) {
    final catalogCtrl = context.watch<CatalogController>();
    final catalog = _activeCatalog(catalogCtrl);

    // Category switched off in the dashboard: no cached products are shown.
    final moduleCategoryId = widget.module == CategoryModuleKind.electricals
        ? catalogCtrl.electricalCategoryId
        : catalogCtrl.pipesCategoryId;
    if (catalogCtrl.categoriesLoaded && moduleCategoryId == null) {
      return const _CatalogStateMessage(
        icon: Icons.block_rounded,
        title: 'This category is not available',
        subtitle: 'Please choose another category.',
      );
    }

    if (catalogCtrl.isLoading && catalog == null) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (catalog == null) {
      return _CatalogStateMessage(
        icon: Icons.cloud_off_rounded,
        title: 'Unable to load catalog',
        subtitle:
            catalogCtrl.error ?? 'Please check your connection and try again.',
        actionLabel: 'Retry',
        onAction: () => context.read<CatalogController>().refreshPipeCatalog(
          showLoading: true,
        ),
      );
    }

    final brandNames = _brandNamesForFilter(catalog);
    if (_selectedBrand != null &&
        !brandNames.any(
          (b) => b.toLowerCase() == _selectedBrand!.toLowerCase(),
        )) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _selectedBrand = null);
      });
    }

    final groups = _filteredGroups(catalog);
    final sectionGroups = _groupsForSection(
      catalog,
      _selectedType,
      _subCategory,
    );
    final sections = [
      _allSection,
      for (final type in catalog.types)
        _CatSectionMeta(
          typeName: type.type,
          label: type.type,
          imageUrl: catalogCtrl.pipeTypeSidebarImageUrl(
            type.type,
            catalogFallbackUrl: type.resolvedImageUrl,
          ),
        ),
    ];
    final subCategoryItems = _subCategoryItems(catalog, _selectedType);

    return Stack(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _CategorySidebar(
              sections: sections,
              selectedType: _selectedType,
              subCategories: subCategoryItems,
              selectedSubCategory: _subCategory,
              onSectionSelected: (typeName) => setState(() {
                _selectedType = typeName;
                _subCategory = null;
                final classes = _classNamesForCatalog(catalog, typeName);
                if (_class != null &&
                    !classes.any(
                      (c) => PipeFilterClasses.matches(c, _class!),
                    )) {
                  _class = null;
                }
                final sizes = _sizeNamesForCatalog(catalog);
                if (_size != null &&
                    !sizes.any(
                      (size) => size.toLowerCase() == _size!.toLowerCase(),
                    )) {
                  _size = null;
                }
              }),
              onSubCategorySelected: (name) => setState(() {
                _subCategory = name;
                final sizes = _sizeNamesForCatalog(catalog);
                if (_size != null &&
                    !sizes.any(
                      (size) => size.toLowerCase() == _size!.toLowerCase(),
                    )) {
                  _size = null;
                }
              }),
            ),
            Expanded(
              child: ColoredBox(
                color: AppColors.background,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _ContentHeading(
                      title: _titleFor(catalog),
                      subtitle: _subtitleFor(catalog),
                    ),
                    Expanded(
                      child: groups.isEmpty
                          ? const _CatalogStateMessage(
                              icon: Icons.inventory_2_outlined,
                              title: 'No products here yet',
                              subtitle:
                                  'Try another category or adjust your filters.',
                            )
                          : GridView.builder(
                              padding: const EdgeInsets.fromLTRB(
                                AppSpacing.space3,
                                0,
                                AppSpacing.space3,
                                AppSpacing.space2,
                              ),
                              gridDelegate:
                                  const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 2,
                                    mainAxisSpacing: AppSpacing.space3,
                                    crossAxisSpacing: AppSpacing.space3,
                                    childAspectRatio: 0.52,
                                  ),
                              itemCount: groups.length,
                              itemBuilder: (context, index) {
                                final group = groups[index];
                                return _CategoryProductCard(
                                  group: group,
                                  catalogSectionGroups: sectionGroups,
                                  pipeType: _selectedType,
                                  catalogModule: widget.module,
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        if (catalogCtrl.isLoading)
          const Positioned(
            top: 8,
            right: 12,
            child: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
      ],
    );
  }
}

class _CategoryHeader extends StatelessWidget {
  const _CategoryHeader({
    required this.screenTitle,
    required this.sort,
    required this.selectedSize,
    required this.selectedBrand,
    required this.selectedClass,
    required this.sortButtonKey,
    required this.sizeButtonKey,
    required this.brandButtonKey,
    required this.classButtonKey,
    required this.onBack,
    required this.onSearch,
    required this.onSortTap,
    required this.onSizeTap,
    required this.onBrandTap,
    required this.onClassTap,
  });

  final String screenTitle;
  final PipeModuleSort sort;
  final String? selectedSize;
  final String? selectedBrand;
  final String? selectedClass;
  final Key sortButtonKey;
  final Key sizeButtonKey;
  final Key brandButtonKey;
  final Key classButtonKey;
  final VoidCallback onBack;
  final VoidCallback onSearch;
  final VoidCallback onSortTap;
  final VoidCallback onSizeTap;
  final VoidCallback onBrandTap;
  final VoidCallback onClassTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      color: AppColors.surface,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.space3,
            AppSpacing.space2,
            AppSpacing.space3,
            AppSpacing.space2,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _HeaderIconButton(
                    icon: Icons.arrow_back_rounded,
                    onPressed: onBack,
                  ),
                  const SizedBox(width: AppSpacing.space3),
                  Expanded(
                    child: Text(
                      screenTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.onBackground,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  _HeaderIconButton(
                    icon: Icons.search_rounded,
                    onPressed: onSearch,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.space3),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Expanded(
                    child: _FilterDropdownButton(
                      key: sortButtonKey,
                      label: sort == PipeModuleSort.all
                          ? 'Sort By'
                          : _SortDropdownMenu._options
                                .firstWhere((option) => option.$1 == sort)
                                .$2,
                      active: sort != PipeModuleSort.all,
                      onTap: onSortTap,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Expanded(
                    child: _FilterDropdownButton(
                      key: sizeButtonKey,
                      label: selectedSize ?? 'Size',
                      active: selectedSize != null,
                      onTap: onSizeTap,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Expanded(
                    child: _FilterDropdownButton(
                      key: brandButtonKey,
                      label: selectedBrand ?? 'Brand',
                      active: selectedBrand != null,
                      onTap: onBrandTap,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Expanded(
                    child: _FilterDropdownButton(
                      key: classButtonKey,
                      label: selectedClass ?? 'Class',
                      active: selectedClass != null,
                      onTap: onClassTap,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterDropdownButton extends StatelessWidget {
  const _FilterDropdownButton({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.smAll,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.smAll,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space2,
            vertical: AppSpacing.space2,
          ),
          decoration: BoxDecoration(
            borderRadius: AppRadius.smAll,
            border: Border.all(color: AppColors.primary, width: 1.2),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 2),
              Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 16,
                color: AppColors.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SortDropdownMenu extends StatefulWidget {
  const _SortDropdownMenu({
    required this.selectedSort,
    required this.onSelected,
  });

  static const _options = [
    (PipeModuleSort.all, 'All'),
    (PipeModuleSort.discount, 'Discount'),
    (PipeModuleSort.priceLowHigh, 'Price (lowest first)'),
    (PipeModuleSort.whatsNew, 'What’s New'),
    (PipeModuleSort.priceHighLow, 'Price (highest first)'),
    (PipeModuleSort.ratings, 'Ratings'),
  ];

  final PipeModuleSort selectedSort;
  final ValueChanged<PipeModuleSort> onSelected;

  @override
  State<_SortDropdownMenu> createState() => _SortDropdownMenuState();
}

class _SortDropdownMenuState extends State<_SortDropdownMenu> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final options = _SortDropdownMenu._options.where(
      (option) => option.$2.toLowerCase().contains(_query.toLowerCase()),
    );

    return _DropdownMenuChrome(
      searchHint: 'Search sort options...',
      onQueryChanged: (value) => setState(() => _query = value),
      children: [
        for (final option in options)
          _DropdownTile(
            label: option.$2,
            selected: widget.selectedSort == option.$1,
            onTap: () => widget.onSelected(option.$1),
          ),
      ],
    );
  }
}

class _SizeDropdownMenu extends StatefulWidget {
  const _SizeDropdownMenu({
    required this.sizes,
    required this.selectedSize,
    required this.onSelected,
  });

  final List<String> sizes;
  final String? selectedSize;
  final ValueChanged<String?> onSelected;

  @override
  State<_SizeDropdownMenu> createState() => _SizeDropdownMenuState();
}

class _SizeDropdownMenuState extends State<_SizeDropdownMenu> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final sizes = widget.sizes.where(
      (size) => size.toLowerCase().contains(_query.toLowerCase()),
    );

    return _DropdownMenuChrome(
      searchHint: 'Search size...',
      onQueryChanged: (value) => setState(() => _query = value),
      children: [
        if (_query.isEmpty)
          _DropdownTile(
            label: 'All Sizes',
            selected: widget.selectedSize == null,
            onTap: () => widget.onSelected(null),
          ),
        for (final size in sizes)
          _DropdownTile(
            label: size,
            selected: widget.selectedSize == size,
            onTap: () => widget.onSelected(size),
          ),
      ],
    );
  }
}

class _BrandDropdownMenu extends StatefulWidget {
  const _BrandDropdownMenu({
    required this.brands,
    required this.selectedBrand,
    required this.onSelected,
  });

  final List<String> brands;
  final String? selectedBrand;
  final ValueChanged<String?> onSelected;

  @override
  State<_BrandDropdownMenu> createState() => _BrandDropdownMenuState();
}

class _BrandDropdownMenuState extends State<_BrandDropdownMenu> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = widget.brands.where(
      (brand) => brand.toLowerCase().contains(_query.toLowerCase()),
    );

    return _DropdownMenuChrome(
      searchHint: 'Search brand...',
      onQueryChanged: (value) => setState(() => _query = value),
      children: [
        if (_query.isEmpty)
          _DropdownTile(
            label: 'All Brands',
            selected: widget.selectedBrand == null,
            onTap: () => widget.onSelected(null),
          ),
        if (widget.brands.isEmpty && _query.isEmpty)
          _DropdownTile(
            label: 'No brands in catalog',
            selected: false,
            onTap: () {},
          ),
        for (final brand in filtered)
          _DropdownTile(
            label: brand,
            selected:
                widget.selectedBrand != null &&
                widget.selectedBrand!.toLowerCase() == brand.toLowerCase(),
            onTap: () => widget.onSelected(brand),
          ),
      ],
    );
  }
}

class _ClassDropdownMenu extends StatefulWidget {
  const _ClassDropdownMenu({
    required this.classes,
    required this.selectedClass,
    required this.onSelected,
  });

  final List<String> classes;
  final String? selectedClass;
  final ValueChanged<String?> onSelected;

  @override
  State<_ClassDropdownMenu> createState() => _ClassDropdownMenuState();
}

class _ClassDropdownMenuState extends State<_ClassDropdownMenu> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final classes = widget.classes.where(
      (name) => name.toLowerCase().contains(_query.toLowerCase()),
    );

    return _DropdownMenuChrome(
      searchHint: 'Search class...',
      onQueryChanged: (value) => setState(() => _query = value),
      children: [
        if (_query.isEmpty)
          _DropdownTile(
            label: 'All Classes',
            selected: widget.selectedClass == null,
            onTap: () => widget.onSelected(null),
          ),
        for (final name in classes)
          _DropdownTile(
            label: name,
            selected: widget.selectedClass != null &&
                (PipeFilterClasses.matches(widget.selectedClass!, name) ||
                    PipeConfiguratorClasses.matchesCanonical(
                      widget.selectedClass!,
                      name,
                    )),
            onTap: () => widget.onSelected(name),
          ),
      ],
    );
  }
}

/// Shared card chrome + search field wrapper for the header filter dropdowns.
class _DropdownMenuChrome extends StatelessWidget {
  const _DropdownMenuChrome({
    required this.searchHint,
    required this.onQueryChanged,
    required this.children,
  });

  final String searchHint;
  final ValueChanged<String> onQueryChanged;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      elevation: AppElevation.level3,
      shadowColor: AppColors.shadow,
      borderRadius: AppRadius.smAll,
      clipBehavior: Clip.antiAlias,
      child: Container(
        constraints: const BoxConstraints(maxHeight: 360),
        decoration: BoxDecoration(
          borderRadius: AppRadius.smAll,
          border: Border.all(color: AppColors.outlineVariant),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _DropdownSearchField(
              hintText: searchHint,
              onChanged: onQueryChanged,
            ),
            Flexible(
              child: children.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.space4,
                        vertical: AppSpacing.space4,
                      ),
                      child: Text(
                        'No matches found',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    )
                  : ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.space1,
                      ),
                      children: children,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DropdownSearchField extends StatelessWidget {
  const _DropdownSearchField({required this.hintText, required this.onChanged});

  final String hintText;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.space3,
        AppSpacing.space3,
        AppSpacing.space3,
        AppSpacing.space2,
      ),
      child: Container(
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.surfaceContainer,
          borderRadius: AppRadius.smAll,
          border: Border.all(color: AppColors.outlineVariant),
        ),
        child: TextField(
          onChanged: onChanged,
          style: const TextStyle(fontSize: 13),
          decoration: InputDecoration(
            isDense: true,
            filled: false,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            errorBorder: InputBorder.none,
            focusedErrorBorder: InputBorder.none,
            disabledBorder: InputBorder.none,
            hintText: hintText,
            hintStyle: const TextStyle(
              fontSize: 13,
              color: AppColors.onSurfaceVariant,
            ),
            prefixIcon: const Icon(
              Icons.search_rounded,
              size: 18,
              color: AppColors.onSurfaceVariant,
            ),
            prefixIconConstraints: const BoxConstraints(
              minWidth: 36,
              minHeight: 36,
            ),
            contentPadding: const EdgeInsets.symmetric(vertical: 10),
          ),
        ),
      ),
    );
  }
}

class _DropdownTile extends StatelessWidget {
  const _DropdownTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: onTap,
      child: Container(
        color: selected
            ? AppColors.primaryContainer.withValues(alpha: 0.35)
            : null,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.space4,
          vertical: AppSpacing.space3,
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: selected ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(5),
                border: Border.all(
                  color: selected
                      ? AppColors.primary
                      : AppColors.outlineVariant,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? const Icon(
                      Icons.check_rounded,
                      size: 14,
                      color: Colors.white,
                    )
                  : null,
            ),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? AppColors.onBackground
                      : AppColors.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({required this.icon, required this.onPressed});

  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.mdAll,
        side: const BorderSide(color: AppColors.outlineVariant),
      ),
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.mdAll,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 20, color: AppColors.onBackground),
        ),
      ),
    );
  }
}

class _ContentHeading extends StatelessWidget {
  const _ContentHeading({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.space3,
        AppSpacing.space3,
        AppSpacing.space3,
        AppSpacing.space2,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.onBackground,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _CatalogStateMessage extends StatelessWidget {
  const _CatalogStateMessage({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 30, color: AppColors.primary),
            ),
            const SizedBox(height: AppSpacing.space4),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppSpacing.space1),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.space4),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

class _CategorySidebar extends StatefulWidget {
  const _CategorySidebar({
    required this.sections,
    required this.selectedType,
    required this.subCategories,
    required this.selectedSubCategory,
    required this.onSectionSelected,
    required this.onSubCategorySelected,
  });

  final List<_CatSectionMeta> sections;
  final String? selectedType;
  final List<_SubCatMeta> subCategories;
  final String? selectedSubCategory;
  final ValueChanged<String?> onSectionSelected;
  final ValueChanged<String?> onSubCategorySelected;

  @override
  State<_CategorySidebar> createState() => _CategorySidebarState();
}

class _CategorySidebarState extends State<_CategorySidebar> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final allMeta = widget.sections.first;
    final typeMetas = widget.sections.skip(1).toList();

    return ColoredBox(
      color: AppColors.surfaceContainer,
      child: SizedBox(
        width: 96,
        child: Scrollbar(
          controller: _scrollController,
          thickness: 3,
          radius: const Radius.circular(3),
          child: ListView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.space3),
            children: [
              _SidebarSectionLabel(
                label: allMeta.label,
                selected: widget.selectedType == null,
                onTap: () => widget.onSectionSelected(null),
              ),
              const SizedBox(height: AppSpacing.space3),
              const _SidebarSectionLabel(label: 'Type'),
              for (final meta in typeMetas)
                _SidebarImageTile(
                  label: meta.label,
                  selected: widget.selectedType?.toLowerCase() ==
                      meta.typeName?.toLowerCase(),
                  onTap: () => widget.onSectionSelected(meta.typeName),
                  imageUrl: meta.imageUrl,
                  isType: true,
                ),
              if (widget.selectedType != null) ...[
                const SizedBox(height: AppSpacing.space3),
                const _SidebarSectionLabel(label: 'Sub-category'),
                _SidebarAllRow(
                  meta: allMeta,
                  selected: widget.selectedSubCategory == null,
                  onTap: () => widget.onSubCategorySelected(null),
                ),
                for (final sub in widget.subCategories)
                  _SidebarImageTile(
                    label: sub.name,
                    selected: widget.selectedSubCategory?.toLowerCase() ==
                        sub.name.toLowerCase(),
                    onTap: () => widget.onSubCategorySelected(sub.name),
                    imageUrl: sub.imageUrl,
                  ),
              ],
              const SizedBox(height: AppSpacing.space2),
            ],
          ),
        ),
      ),
    );
  }
}

class _SidebarSectionLabel extends StatelessWidget {
  const _SidebarSectionLabel({
    required this.label,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final interactive = onTap != null;
    final fill = selected && interactive
        ? AppColors.primaryContainer.withValues(alpha: 0.55)
        : AppColors.primaryContainer.withValues(alpha: 0.35);

    final labelChild = Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space2,
        vertical: AppSpacing.space1,
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: theme.textTheme.labelSmall?.copyWith(
          color: selected && interactive
              ? AppColors.onBackground
              : AppColors.primary,
          fontWeight: selected && interactive ? FontWeight.w800 : FontWeight.w700,
          fontSize: 11,
          letterSpacing: 0.3,
        ),
      ),
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.space2,
        AppSpacing.space2,
        AppSpacing.space2,
        AppSpacing.space1,
      ),
      child: interactive
          ? Material(
              color: fill,
              borderRadius: AppRadius.smAll,
              child: InkWell(
                onTap: onTap,
                borderRadius: AppRadius.smAll,
                child: labelChild,
              ),
            )
          : DecoratedBox(
              decoration: BoxDecoration(
                color: fill,
                borderRadius: AppRadius.smAll,
              ),
              child: labelChild,
            ),
    );
  }
}

class _SidebarAllRow extends StatelessWidget {
  const _SidebarAllRow({
    required this.meta,
    required this.selected,
    required this.onTap,
  });

  final _CatSectionMeta meta;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space2),
      child: Material(
        color: selected
            ? AppColors.primaryContainer.withValues(alpha: 0.55)
            : Colors.transparent,
        borderRadius: AppRadius.smAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.smAll,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.space2,
              vertical: AppSpacing.space2,
            ),
            child: Text(
              meta.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                color: AppColors.onBackground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SidebarImageTile extends StatelessWidget {
  const _SidebarImageTile({
    required this.label,
    required this.selected,
    required this.onTap,
    this.imageAsset = '',
    this.imageUrl,
    this.isType = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String imageAsset;
  final String? imageUrl;

  /// Type items: neutral placeholder when the Type has no image, and the name
  /// wraps (up to 3 lines) instead of being cut off. Sub-category tiles keep
  /// their existing look.
  final bool isType;

  static const double _circleSize = 52;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space2,
        vertical: 2,
      ),
      child: Material(
        color: selected
            ? AppColors.primarySidebarSelected
            : Colors.transparent,
        borderRadius: AppRadius.smAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.smAll,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.space1,
              vertical: AppSpacing.space2,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: _circleSize,
                  height: _circleSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.surface,
                    border: Border.all(
                      color: selected
                          ? AppColors.primary
                          : AppColors.outlineVariant,
                      width: selected ? 1.5 : 1,
                    ),
                  ),
                  padding: const EdgeInsets.all(2),
                  clipBehavior: Clip.antiAlias,
                  child: CategoryImage(
                    imageAsset: imageAsset,
                    imageUrl: imageUrl,
                    fallbackIcon: 'plumbing',
                    fallbackIconColor: AppColors.outline,
                    fallbackBackground: AppColors.surface,
                    fit: isType ? BoxFit.cover : BoxFit.contain,
                    iconSize: 26,
                    borderRadius: isType ? BorderRadius.circular(_circleSize) : null,
                    placeholder: isType,
                  ),
                ),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: isType ? 3 : 2,
                  softWrap: true,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelMedium?.copyWith(
                    height: 1.15,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    color: selected
                        ? AppColors.onSurface
                        : AppColors.onBackground,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CategoryProductCard extends StatelessWidget {
  const _CategoryProductCard({
    required this.group,
    required this.catalogSectionGroups,
    required this.pipeType,
    required this.catalogModule,
  });

  final _CategoryProductGroup group;
  final List<_CategoryProductGroup> catalogSectionGroups;
  final String? pipeType;
  final CategoryModuleKind catalogModule;

  void _openConfigurator(BuildContext context) {
    if (group.products.isEmpty) return;
    final anchor = group.products.first;
    final lineGroups = splitGroupByProductClass(group);
    final initialGroup = lineGroups.firstWhere(
      (g) => g.products.contains(anchor),
      orElse: () => lineGroups.first,
    );
    final initialProduct = anchor;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _PipeConfiguratorScreen(
          groups: lineGroups,
          catalogSectionGroups: catalogSectionGroups,
          pipeType: pipeType,
          subCategory: group.subCategory,
          initialGroup: initialGroup,
          initialProduct: initialProduct,
          catalogModule: catalogModule,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final catalogCtrl = context.watch<CatalogController>();
    final price = listPriceForProductGroup(group, catalogCtrl);

    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.mdAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openConfigurator(context),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1.02,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: AppRadius.mdAll,
                        border: Border.all(color: AppColors.divider),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.shadow,
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: CategoryImage(
                        imageAsset: '',
                        imageUrl: _representativeImageUrl(group.products),
                        fallbackIcon: catalogModule == CategoryModuleKind.electricals
                            ? 'electrical_services'
                            : 'plumbing',
                        fallbackIconColor: AppColors.outline,
                        fallbackBackground: AppColors.surfaceContainer,
                        fit: BoxFit.contain,
                        borderRadius: AppRadius.mdAll,
                        iconSize: AppSpacing.space8,
                      ),
                    ),
                  ),
                  Positioned(
                    right: AppSpacing.space2,
                    bottom: AppSpacing.space2,
                    child: Material(
                      color: AppColors.accentGreenContainer,
                      borderRadius: BorderRadius.circular(10),
                      elevation: AppElevation.level1,
                      shadowColor: AppColors.shadow,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.space2,
                          vertical: AppSpacing.space1,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'ADD',
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: AppColors.onAccentGreenContainer,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              group.products.length == 1
                                  ? '1 option'
                                  : '${group.products.length} options',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: AppColors.onAccentGreenContainer,
                                fontSize: 10,
                                height: 1.1,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space1,
                AppSpacing.space2,
                AppSpacing.space1,
                AppSpacing.space1,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  RichText(
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    text: TextSpan(
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.onBackground,
                      ),
                      children: [
                        const TextSpan(
                          text: '₹',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        TextSpan(text: price.toStringAsFixed(0)),
                        TextSpan(
                          text: ' /${group.unit}',
                          style: theme.textTheme.labelSmall?.copyWith(
                            fontWeight: FontWeight.w500,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (group.discountLabel.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      group.discountLabel,
                      maxLines: 1,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: AppColors.success,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  const SizedBox(height: 2),
                  Text(
                    group.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      height: 1.15,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Product configurator screen opened when a shopper taps a product card in
/// [PipesFittingCategoryScreen] — shows the tapped product with a size and
/// type picker plus an "Add to Cart" action. The Add to Cart button reverts
/// to the previous (direct add-to-cart with a snackbar) flow, scoped to this
/// screen only; the rest of the module's navigation is unchanged.
class _PipeConfiguratorScreen extends StatefulWidget {
  const _PipeConfiguratorScreen({
    required this.groups,
    required this.catalogSectionGroups,
    required this.pipeType,
    required this.subCategory,
    required this.initialGroup,
    required this.initialProduct,
    required this.catalogModule,
  });

  final List<_CategoryProductGroup> groups;
  final List<_CategoryProductGroup> catalogSectionGroups;
  final String? pipeType;
  final String subCategory;
  final _CategoryProductGroup initialGroup;
  final PipesFittingProduct initialProduct;
  final CategoryModuleKind catalogModule;

  @override
  State<_PipeConfiguratorScreen> createState() =>
      _PipeConfiguratorScreenState();
}

class _PipeConfiguratorScreenState extends State<_PipeConfiguratorScreen> {
  late _CategoryProductGroup _group = widget.initialGroup;
  late PipesFittingProduct _product = widget.initialProduct;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final catalog = context.read<CatalogController>();
      catalog.startPipeCatalogSync();
      catalog.refreshPipeCatalog(showLoading: false);
    });
  }

  List<_CategoryProductGroup> _catalogPool(BuildContext context) {
    final catalog = context
        .read<CatalogController>()
        .catalogFor(widget.catalogModule);
    if (catalog != null) {
      final typeName =
          widget.pipeType ?? resolvePipeTypeForProduct(catalog, _product);
      if (typeName != null) {
        final live = buildPipeCatalogGroupsForSection(
          catalog,
          typeName,
          widget.subCategory,
        );
        if (live.isNotEmpty) return live;
      }
    }
    if (widget.catalogSectionGroups.isNotEmpty) {
      return widget.catalogSectionGroups;
    }
    return widget.groups;
  }

  List<_CategoryProductGroup> _familyGroups(BuildContext context) {
    final familyKey = _productFamilyKey(
      _product,
      subCategory: widget.subCategory,
    );
    return _catalogPool(context).where((g) {
      if (g.subCategory.toLowerCase() != widget.subCategory.toLowerCase()) {
        return false;
      }
      return g.products.any(
        (p) =>
            _productFamilyKey(p, subCategory: widget.subCategory) == familyKey,
      );
    }).toList();
  }

  List<_CategoryProductGroup> _groupsForCurrentClass(BuildContext context) {
    final classFilter = _productClassLabel(_product, _group.className);
    return _familyGroups(context)
        .where(
          (g) => g.products.any(
            (p) => _productMatchesClassSelection(p, g.className, classFilter),
          ),
        )
        .toList();
  }

  void _collectFamilySizesFromCatalog(
    BuildContext context,
    Set<String> sizes,
  ) {
    final catalog = context
        .read<CatalogController>()
        .catalogFor(widget.catalogModule);
    if (catalog == null) return;
    final typeName = _resolvedPipeType(context);
    final familyKey = _productFamilyKey(
      _product,
      subCategory: widget.subCategory,
    );

    for (final type in catalog.types) {
      if (typeName != null &&
          type.type.toLowerCase() != typeName.toLowerCase()) {
        continue;
      }
      for (final sub in type.subCategories) {
        if (sub.subCategory.toLowerCase() != widget.subCategory.toLowerCase()) {
          continue;
        }
        for (final cls in sub.classes) {
          if (!PipeConfiguratorClasses.sameClassBucket(
            cls.className,
            _group.className,
          )) {
            continue;
          }
          for (final p in cls.products) {
            if (_productFamilyKey(p, subCategory: widget.subCategory) !=
                familyKey) {
              continue;
            }
            final size = p.size?.trim();
            if (size != null && size.isNotEmpty) sizes.add(size);
          }
        }
      }
    }
  }

  List<String> _sizeOptions(BuildContext context) {
    final sizes = <String>{};
    _collectFamilySizesFromCatalog(context, sizes);
    for (final g in _groupsForCurrentClass(context)) {
      for (final p in g.products) {
        final size = p.size?.trim();
        if (size != null && size.isNotEmpty) sizes.add(size);
      }
    }
    final list = sizes.toList();
    sortPipeSizesAscending(list);
    return list;
  }

  List<String> _brandOptions(BuildContext context) {
    final brands = <String>{
      for (final g in _familyGroups(context))
        for (final p in g.products)
          if (p.brand.trim().isNotEmpty) p.brand.trim(),
    }.toList();
    brands.sort();
    return brands;
  }

  bool _inStock(PipesFittingProduct product) {
    return CatalogApiMapper.isPurchasableStock(product.stock);
  }



  String? _resolvedPipeType(BuildContext context) {
    if (widget.pipeType != null && widget.pipeType!.trim().isNotEmpty) {
      return widget.pipeType;
    }
    final catalog = context
        .read<CatalogController>()
        .catalogFor(widget.catalogModule);
    if (catalog != null) {
      return resolvePipeTypeForProduct(catalog, _product);
    }
    return null;
  }

  List<String> _classOptions(BuildContext context) {
    return pipeClassOptionsForFamily(
      _familyGroups(context),
      typeName: _resolvedPipeType(context),
    );
  }

  String _selectedClassOption(BuildContext context) {
    final options = _classOptions(context);
    final current = _productClassLabel(_product, _group.className);
    return pipeClassOptionMatchingLabel(options, current);
  }

  double _resolvedProductPrice(BuildContext context) {
    var value = _product.displayPrice;
    if (value > 0) return value;
    final id = _product.id;
    if (id == null) return value;
    final live = context.read<CatalogController>().variantById(id);
    if (live != null && live.price > 0) return live.price;
    return value;
  }

  _CategoryProductGroup? _groupForClass(
    BuildContext context,
    String className,
  ) {
    final familyKey = _productFamilyKey(
      _product,
      subCategory: widget.subCategory,
    );
    _CategoryProductGroup? best;
    var bestScore = -1;

    for (final g in _catalogPool(context)) {
      if (g.subCategory.toLowerCase() != widget.subCategory.toLowerCase()) {
        continue;
      }
      if (!PipeConfiguratorClasses.matchesCanonical(className, g.className)) {
        continue;
      }
      if (!g.products.any(
        (p) =>
            _productFamilyKey(p, subCategory: widget.subCategory) == familyKey,
      )) {
        continue;
      }

      final brandMatches = g.products.where(
        (p) => _pipeBrandMatches(p.brand, _product.brand),
      ).length;
      final score = brandMatches * 1000 + g.products.length;
      if (score > bestScore) {
        bestScore = score;
        best = g;
      }
    }
    if (best != null) return best;

    final titleKey = _normalizeProductFamilyLabel(widget.initialGroup.title);
    for (final g in _catalogPool(context)) {
      if (g.subCategory.toLowerCase() != widget.subCategory.toLowerCase()) {
        continue;
      }
      if (!PipeConfiguratorClasses.matchesCanonical(className, g.className)) {
        continue;
      }
      if (_normalizeProductFamilyLabel(g.title) == titleKey) {
        return g;
      }
    }
    return null;
  }


  PipesFittingProduct? _pickProductForBrand(
    _CategoryProductGroup group,
    String brand,
    String? size,
  ) {
    final candidates =
        group.products.where((p) => _pipeBrandMatches(p.brand, brand)).toList();
    if (candidates.isEmpty) return null;
    if (size != null && size.isNotEmpty) {
      for (final p in candidates) {
        if (_pipeSizeMatches(p.size, size)) return p;
      }
    }
    return candidates.first;
  }

  void _onBrandChanged(BuildContext context, String? brand) {
    if (brand == null || brand.isEmpty) return;
    final currentSize = _product.size;
    var nextGroup = _group;
    var next = _pickProductForBrand(_group, brand, currentSize);
    if (next == null) {
      for (final g in _familyGroups(context)) {
        final candidate = _pickProductForBrand(g, brand, currentSize);
        if (candidate != null) {
          nextGroup = g;
          next = candidate;
          break;
        }
      }
    }
    if (next == null) return;
    setState(() {
      _group = nextGroup;
      _product = next!;
    });
  }

  void _onSizeChanged(BuildContext context, String size) {
    for (final g in _groupsForCurrentClass(context)) {
      for (final p in g.products) {
        if (_pipeBrandMatches(p.brand, _product.brand) &&
            _pipeSizeMatches(p.size, size)) {
          setState(() {
            _group = g;
            _product = p;
          });
          return;
        }
      }
    }
    for (final g in _groupsForCurrentClass(context)) {
      for (final p in g.products) {
        if (_pipeSizeMatches(p.size, size)) {
          setState(() {
            _group = g;
            _product = p;
          });
          return;
        }
      }
    }
  }

  void _onClassChanged(BuildContext context, String className) {
    if (className.isEmpty) return;

    final currentClass = _productClassLabel(_product, _group.className);
    if (_productMatchesClassSelection(_product, _group.className, className) &&
        (PipeConfiguratorClasses.matchesCanonical(className, currentClass) ||
            PipeFilterClasses.matches(className, currentClass))) {
      return;
    }

    final familyKey = _productFamilyKey(
      _product,
      subCategory: widget.subCategory,
    );
    final brand = _product.brand;
    final size = _product.size;

    PipesFittingProduct? best;
    _CategoryProductGroup? bestGroup;
    var bestScore = -1;

    void consider(PipesFittingProduct product, _CategoryProductGroup group) {
      if (_productFamilyKey(product, subCategory: widget.subCategory) !=
          familyKey) {
        return;
      }
      if (!_productMatchesClassSelection(
        product,
        group.className,
        className,
      )) {
        return;
      }

      var score = 0;
      if (_pipeBrandMatches(product.brand, brand)) score += 100;
      if (_pipeSizeMatches(product.size, size)) score += 50;
      if (product.displayPrice > 0) score += 10;
      if (score > bestScore) {
        bestScore = score;
        best = product;
        bestGroup = group;
      }
    }

    for (final group in _familyGroups(context)) {
      for (final product in group.products) {
        consider(product, group);
      }
    }

    final catalog = context
        .read<CatalogController>()
        .catalogFor(widget.catalogModule);
    if (best == null && catalog != null) {
      final dummyGroup = _group;
      for (final product in _catalogProductsForSection(
        catalog,
        _resolvedPipeType(context),
        widget.subCategory,
      )) {
        consider(product, dummyGroup);
      }
    }

    if (best == null || bestGroup == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No $className option for this product line'),
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }

    final nextGroup = _groupWithClassFilter(bestGroup!, className);
    setState(() {
      _group = nextGroup;
      _product = best!;
    });
  }

  void _addToCart() {
    if (!ensureDeliverable(context)) return;
    final catalog = context.read<CatalogController>();
    final categoryId = catalog.pipesCategoryId;
    final live = _product.id != null ? catalog.variantById(_product.id!) : null;
    context.read<CartController>().addVariant(
      live ?? _variantFor(_product, _group, categoryId: categoryId),
    );
    // The snackbar lives on the root messenger and can outlive this screen,
    // so resolve the navigator now instead of using this State's context later.
    final navigator = Navigator.of(context);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            '${_product.brand} ${_product.productName} added to cart',
          ),
          duration: const Duration(seconds: 3),
          // SnackBars with an action persist by default; auto-dismiss instead.
          persist: false,
          action: SnackBarAction(
            label: 'View Cart',
            onPressed: () => navigator.pushNamed(AppRoutes.cart),
          ),
        ),
      );
  }

  String get _title {
    if (_product.productName.trim().isNotEmpty) {
      return _product.productName.trim();
    }
    final code = _product.productCode;
    return (code != null && code.isNotEmpty)
        ? '${code}_${_product.productName}'
        : _product.productName;
  }

  void _reconcileWithLiveCatalog(BuildContext context) {
    final catalog = context
        .read<CatalogController>()
        .catalogFor(widget.catalogModule);
    if (catalog == null) return;

    final productId = _product.id?.trim();
    if (productId == null || productId.isEmpty) return;

    for (final g in _familyGroups(context)) {
      for (final p in g.products) {
        if (p.id?.trim() == productId) {
          if (p.stock != _product.stock ||
              p.mrp != _product.mrp ||
              p.sellingPrice != _product.sellingPrice) {
            setState(() {
              _group = g;
              _product = p;
            });
          }
          return;
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<CatalogController>();
    final theme = Theme.of(context);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _reconcileWithLiveCatalog(context);
    });

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space3,
                vertical: AppSpacing.space2,
              ),
              child: Row(
                children: [
                  Material(
                    color: AppColors.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.mdAll,
                      side: const BorderSide(color: AppColors.outlineVariant),
                    ),
                    child: InkWell(
                      onTap: () => Navigator.of(context).maybePop(),
                      borderRadius: AppRadius.mdAll,
                      child: const SizedBox(
                        width: 44,
                        height: 44,
                        child: Icon(
                          Icons.arrow_back_rounded,
                          size: 22,
                          color: AppColors.onBackground,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Expanded(
                    child: Material(
                      color: AppColors.surface,
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.mdAll,
                        side: const BorderSide(color: AppColors.outlineVariant),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.space3,
                          vertical: AppSpacing.space1,
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.search_rounded,
                              size: 20,
                              color: AppColors.outline,
                            ),
                            const SizedBox(width: AppSpacing.space2),
                            Expanded(
                              child: TextField(
                                textInputAction: TextInputAction.search,
                                style: theme.textTheme.bodyMedium,
                                decoration: InputDecoration(
                                  isDense: true,
                                  filled: false,
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  hintText: 'Search products',
                                  hintStyle: theme.textTheme.bodyMedium
                                      ?.copyWith(color: AppColors.outline),
                                  contentPadding: EdgeInsets.zero,
                                ),
                                onTap: () => Navigator.of(context).pushNamed(
                                  AppRoutes.search,
                                  arguments: const SearchArgs(),
                                ),
                                onSubmitted: (query) =>
                                    Navigator.of(context).pushNamed(
                                      AppRoutes.search,
                                      arguments: SearchArgs(
                                        initialQuery: query,
                                      ),
                                    ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.space4,
                  AppSpacing.space2,
                  AppSpacing.space4,
                  AppSpacing.space4,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      height: 220,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: AppRadius.lgAll,
                        border: Border.all(color: AppColors.divider),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.shadow,
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: CategoryImage(
                        imageAsset: '',
                        imageUrl: _product.imageUrl,
                        fallbackIcon: 'plumbing',
                        fallbackIconColor: AppColors.outline,
                        fallbackBackground: AppColors.surfaceContainer,
                        fit: BoxFit.contain,
                        borderRadius: AppRadius.lgAll,
                        iconSize: AppSpacing.space8,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    Text(
                      _title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space2),
                    Text(
                      'Brand',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space2),
                    ConfiguratorOptionGrid(
                      options: _brandOptions(context),
                      selectedOption: _product.brand,
                      onOptionSelected: (brand) =>
                          _onBrandChanged(context, brand),
                      emptyMessage: 'No brands available',
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    Text(
                      'Class',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space2),
                    ConfiguratorOptionGrid(
                      options: _classOptions(context),
                      selectedOption: _selectedClassOption(context),
                      onOptionSelected: (className) =>
                          _onClassChanged(context, className),
                      isSelected: (option, selected) =>
                          selected != null &&
                          PipeConfiguratorClasses.matchesCanonical(
                            option,
                            selected,
                          ),
                      emptyMessage: 'No classes available',
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    Text(
                      'Size',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space2),
                    ConfiguratorOptionGrid(
                      options: _sizeOptions(context),
                      selectedOption: _product.size,
                      isSelected: (option, selected) =>
                          selected != null &&
                          _pipeSizeMatches(option, selected),
                      subtitleForOption: null,
                      onOptionSelected: (size) =>
                          _onSizeChanged(context, size),
                      emptyMessage: 'No sizes available',
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    _ConfiguratorAddToCartCard(
                      selectedSizeLabel: _product.size ?? '—',
                      price: _resolvedProductPrice(context),
                      unit: _group.unit,
                      onAddToCart: _inStock(_product) && !context.watch<DeliveryController>().blocked ? _addToCart : null,
                    ),
                    const DeliveryBlockedNote(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConfiguratorAddToCartCard extends StatelessWidget {
  const _ConfiguratorAddToCartCard({
    required this.selectedSizeLabel,
    required this.price,
    required this.unit,
    required this.onAddToCart,
  });

  final String selectedSizeLabel;
  final double price;
  final String unit;
  final VoidCallback? onAddToCart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.space3),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AppColors.divider),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Selected Product Size',
                  style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: AppSpacing.space1),
                RichText(
                  text: TextSpan(
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.onBackground,
                    ),
                    children: [
                      const TextSpan(text: '₹'),
                      TextSpan(text: price.toStringAsFixed(0)),
                      TextSpan(
                        text: '/ $unit',
                        style: theme.textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  selectedSizeLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          Flexible(
            child: Material(
              color: onAddToCart == null
                  ? AppColors.disabledContainer
                  : AppColors.accentGreenContainer,
              borderRadius: AppRadius.lgAll,
              child: InkWell(
                onTap: onAddToCart,
                borderRadius: AppRadius.lgAll,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space3,
                    vertical: AppSpacing.space3,
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.add_shopping_cart_rounded,
                          size: 18,
                          color: onAddToCart == null
                              ? AppColors.disabled
                              : AppColors.onAccentGreenContainer,
                        ),
                        const SizedBox(width: AppSpacing.space1),
                        Text(
                          'Add to Cart',
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: onAddToCart == null
                                ? AppColors.disabled
                                : AppColors.onAccentGreenContainer,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
