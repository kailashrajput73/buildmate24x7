import 'package:flutter/material.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/models/catalog_models.dart';
import 'brand_seed_data.dart';
import 'cpvc_pipe_matrix_data.dart';
import 'plumbing_catalog_rows.dart';
import 'pvc_swr_pipe_matrix_data.dart';
import 'upvc_pipe_matrix_data.dart';

/// Local catalog built from Excel seed rows + brand dataset.
/// Replace with repository/API later; keep query APIs stable.
abstract final class CatalogMockData {
  static final _CatalogIndex _index = _CatalogIndex.build();

  /// Generated sub-category id for Pipes & Tubing → UPVC (`_subId` slug).
  static const String upvcPipesSubCategoryId = 'cat-pipes-tubing__upvc';
  /// Generated sub-category id for Pipes & Tubing → CPVC (`_subId` slug).
  static const String cpvcPipesSubCategoryId = 'cat-pipes-tubing__cpvc';
  /// Generated sub-category id for Pipes & Tubing → PVC SWR (`_subId` slug).
  static const String pvcSwrPipesSubCategoryId = 'cat-pipes-tubing__pvc-swr';
  static const String pipesTubingCategoryId = 'cat-pipes-tubing';

  /// All catalog category ids covered by the pipe/product configurator screen —
  /// used so its size/type dropdowns populate for every category, not just pipes.
  static const List<String> plumbingModuleCategoryIds = [
    'cat-pipes-tubing',
    'cat-fittings',
    'cat-valves-controls',
    'cat-sanitary-wares',
    'cat-cp-fittings',
    'cat-drainage-accessories',
    'cat-consumables',
  ];
  static const String pipeSummaryImageAsset =
      'assets/images/pipes/astral_upvc_pipe.jpg';
  static const String pipeAllThumbnailAsset =
      'assets/images/pipes/thumb_all.png';

  static List<Category> get categories => _index.categories;
  static List<SubCategory> get subCategories => _index.subCategories;
  static List<Brand> get brands => _index.brands;
  static List<CatalogProduct> get products => _index.products;
  static List<ProductVariant> get variants => _index.variants;

  static List<CatalogProduct> get featuredProducts =>
      products.where((p) => p.isFeatured).toList();

  static List<CatalogProduct> get popularProducts =>
      products.where((p) => p.isPopular).toList();

  static List<ProductVariant> get featuredVariants =>
      variants.where((v) => v.isFeatured).toList();

  static List<ProductVariant> get popularVariants =>
      variants.where((v) => v.isPopular).toList();

  static List<CatalogProduct> productsByCategory(String categoryId) =>
      products.where((p) => p.categoryId == categoryId).toList();

  static List<CatalogProduct> productsBySubCategory(String subCategoryId) =>
      products.where((p) => p.subCategoryId == subCategoryId).toList();

  static List<ProductVariant> variantsByProduct(String productId) =>
      variants.where((v) => v.productId == productId).toList();

  static List<ProductVariant> variantsByBrand(String brandId) =>
      variants.where((v) => v.brandId == brandId).toList();

  static List<ProductVariant> variantsByCategory(String categoryId) =>
      variants.where((v) => v.categoryId == categoryId).toList();

  static List<ProductVariant> get upvcPipeVariants => upvcPipeMatrixVariants;

  /// Spreadsheet-backed UPVC pipe variants (Brand × Sch 40/80 × Size).
  static List<ProductVariant> get upvcPipeMatrixVariants =>
      UpvcPipeMatrixData.buildVariants();

  /// Mock CPVC pipe variants (Brand × SDR schedule × Size).
  static List<ProductVariant> get cpvcPipeMatrixVariants =>
      CpvcPipeMatrixData.buildVariants();

  /// Mock PVC SWR (drainage) pipe variants (Brand × Type × Size).
  static List<ProductVariant> get pvcSwrPipeMatrixVariants =>
      PvcSwrPipeMatrixData.buildVariants();

  /// Normalizes schedule labels such as `SCH40` → `Sch 40`.
  static String? normalizePipeSchedule(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final text = raw.trim();
    final match =
        RegExp(r'sch\s*(\d+)', caseSensitive: false).firstMatch(text);
    if (match != null) return 'Sch ${match.group(1)}';
    return text;
  }

  static bool isUpvcPipesSubCategory(String? subCategoryId) =>
      subCategoryId == upvcPipesSubCategoryId;

  /// Sidebar label for Pipes & Tubing subcategories.
  static String pipeSubCategoryDisplayName(SubCategory sub) => sub.name;

  /// Circular sidebar thumbnail per pipe subcategory.
  static String pipeSubCategoryImageAsset(String subCategoryId) {
    switch (subCategoryId) {
      case upvcPipesSubCategoryId:
        return 'assets/images/pipes/thumb_upvc.png';
      case 'cat-pipes-tubing__cpvc':
        return 'assets/images/pipes/thumb_cpvc.png';
      case 'cat-pipes-tubing__pvc-swr':
        return 'assets/images/pipes/thumb_pvc_swr.png';
      case 'cat-pipes-tubing__hdpe':
        return 'assets/images/pipes/thumb_hdpe.png';
      default:
        return pipeSummaryImageAsset;
    }
  }

  static IconData pipeSubCategoryIcon(String subCategoryId) {
    if (isUpvcPipesSubCategory(subCategoryId)) {
      return Icons.water_rounded;
    }
    switch (subCategoryId) {
      case 'cat-pipes-tubing__cpvc':
        return Icons.plumbing_rounded;
      case 'cat-pipes-tubing__pvc-swr':
        return Icons.waves_rounded;
      case 'cat-pipes-tubing__hdpe':
        return Icons.water_drop_outlined;
      default:
        return Icons.water_rounded;
    }
  }

  static String? pipeScheduleFor(ProductVariant variant) =>
      pipeScheduleLabel(variant);

  static String? pipeScheduleLabel(ProductVariant variant) {
    final attrs = variant.specifications['Attributes'] ?? '';
    final classMatch = RegExp(r'Class \d+').firstMatch(attrs);
    if (classMatch != null) return classMatch.group(0);
    final sdrMatch = RegExp(r'SDR \d+', caseSensitive: false).firstMatch(attrs);
    if (sdrMatch != null) return sdrMatch.group(0);
    return null;
  }

  static List<ProductVariant> pipeVariantsForSubCategory(String? subCategoryId) {
    if (subCategoryId == null) {
      return variants
          .where((v) => v.categoryId == pipesTubingCategoryId)
          .toList();
    }
    return variants.where((v) => v.subCategoryId == subCategoryId).toList();
  }

  static List<ProductVariant> filterPipeVariants({
    required List<ProductVariant> source,
    String? brandId,
    String? size,
    String? pipeType,
    String? scheduleCategory,
  }) {
    return source.where((v) {
      if (brandId != null && brandId.isNotEmpty && v.brandId != brandId) {
        return false;
      }
      if (size != null && size.isNotEmpty) {
        final variantSize = v.specifications['Size'] ?? '';
        if (variantSize != size) return false;
      }
      if (pipeType != null && pipeType.isNotEmpty && v.pipeType != pipeType) {
        return false;
      }
      if (scheduleCategory != null && scheduleCategory.isNotEmpty) {
        if (pipeScheduleLabel(v) != scheduleCategory) return false;
      }
      return true;
    }).toList();
  }

  static List<ProductVariant> filterUpvcPipeVariants({
    String? brandId,
    String? size,
    String? pipeType,
    String? scheduleCategory,
  }) {
    return filterPipeVariants(
      source: upvcPipeVariants,
      brandId: brandId,
      size: size,
      pipeType: pipeType,
      scheduleCategory: scheduleCategory,
    );
  }

  static String pipeConfiguratorTitle(ProductVariant variant) {
    final size = variant.specifications['Size'] ?? '';
    final type = variant.pipeType ?? variant.subCategoryName;
    final schedule = pipeScheduleLabel(variant);
    return [
      variant.productName,
      type,
      if (schedule != null && schedule.isNotEmpty) schedule,
      if (size.isNotEmpty) '($size)',
    ].join(' ');
  }

  static String pipeConfiguratorScreenTitle(String? subCategoryId) {
    if (subCategoryId == null) return 'Pipes & Tubing';
    return '${subCategoryById(subCategoryId)?.name ?? 'Pipe'} Pipes';
  }

  static CatalogProduct? productById(String id) {
    for (final p in products) {
      if (p.id == id) return p;
    }
    return null;
  }

  static ProductVariant? variantById(String id) {
    for (final v in variants) {
      if (v.id == id) return v;
    }
    return null;
  }

  static Category? categoryById(String id) {
    for (final c in categories) {
      if (c.id == id) return c;
    }
    return null;
  }

  static Brand? brandById(String id) {
    for (final b in brands) {
      if (b.id == id) return b;
    }
    return null;
  }

  static SubCategory? subCategoryById(String id) {
    for (final s in subCategories) {
      if (s.id == id) return s;
    }
    return null;
  }

  static List<SubCategory> subCategoriesFor(String categoryId) =>
      subCategories.where((s) => s.categoryId == categoryId).toList();

  static List<Brand> brandsForCategory(String categoryId) =>
      brands.where((b) => b.categoryIds.contains(categoryId)).toList();

  /// Lowest-priced in-stock variant for a base product (display only).
  static ProductVariant? cheapestVariantFor(String productId) {
    final list = variantsByProduct(productId);
    if (list.isEmpty) return null;
    list.sort((a, b) => a.price.compareTo(b.price));
    return list.first;
  }

  /// Other products in the same main category (for Complete System).
  static List<CatalogProduct> compatibleProductsFor(
    CatalogProduct product, {
    String? sizeFilter,
  }) {
    var list = products
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
    return list;
  }

  static List<String> sizeOptionsForCategory(String categoryId) {
    final values = <String>{};
    for (final p in productsByCategory(categoryId)) {
      final size = p.specifications['Size']?.trim() ?? '';
      if (size.isNotEmpty) values.add(size);
    }
    final list = values.toList()..sort();
    return list;
  }

  static List<String> attributeOptionsForCategory(
    String categoryId,
    String key,
  ) {
    final values = <String>{};
    for (final p in productsByCategory(categoryId)) {
      final v = p.specifications[key]?.trim() ?? '';
      if (v.isNotEmpty) values.add(v);
    }
    final list = values.toList()..sort();
    return list;
  }

  static List<CatalogProduct> filterProducts({
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
        return variantsByProduct(p.id).any((v) => v.brandId == brandId);
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
        list = list.reversed.toList();
      case ProductSort.brandAz:
        list.sort((a, b) {
          final ba = cheapestVariantFor(a.id)?.brandName ?? a.name;
          final bb = cheapestVariantFor(b.id)?.brandName ?? b.name;
          return ba.compareTo(bb);
        });
    }
    return list;
  }

  static List<CatalogProduct> search(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    return products
        .where(
          (p) =>
              p.name.toLowerCase().contains(q) ||
              p.sku.toLowerCase().contains(q) ||
              p.categoryName.toLowerCase().contains(q) ||
              p.subCategoryName.toLowerCase().contains(q) ||
              variantsByProduct(p.id).any(
                    (v) => v.brandName.toLowerCase().contains(q),
                  ),
        )
        .toList();
  }

  static List<ProductVariant> searchVariants(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    return variants
        .where(
          (v) =>
              v.productName.toLowerCase().contains(q) ||
              v.brandName.toLowerCase().contains(q) ||
              v.categoryName.toLowerCase().contains(q) ||
              v.subCategoryName.toLowerCase().contains(q) ||
              v.sku.toLowerCase().contains(q),
        )
        .toList();
  }

  static List<BannerItem> get banners => [
        BannerItem(
          id: 'banner-pipes',
          eyebrow: 'FEATURED COLLECTION',
          headline: 'Premium Pipes Collection',
          description: 'UPVC, CPVC, HDPE & SWR from top brands',
          ctaLabel: 'Explore Now',
          icon: 'plumbing',
          gradientStart: 0xFF0369A1,
          gradientEnd: 0xFF0891B2,
          categoryId: 'cat-pipes-tubing',
          routeName: AppRoutes.categories,
        ),
        BannerItem(
          id: 'banner-sanitary',
          eyebrow: 'FEATURED COLLECTION',
          headline: 'Sanitary & CP Fittings',
          description: 'Closets, basins, faucets & showers',
          ctaLabel: 'Browse Now',
          icon: 'water_drop',
          gradientStart: 0xFF0F766E,
          gradientEnd: 0xFF14B8A6,
          categoryId: 'cat-sanitary-wares',
        ),
        BannerItem(
          id: 'banner-offers',
          eyebrow: 'FEATURED COLLECTION',
          headline: 'Plumbing Project Offers',
          description: 'Save on bulk pipe & fitting orders',
          ctaLabel: 'View Offers',
          icon: 'local_offer',
          gradientStart: 0xFFB45309,
          gradientEnd: 0xFFD97706,
          routeName: AppRoutes.offers,
        ),
      ];

  static List<Offer> get offers => [
        Offer(
          id: 'offer-pipes',
          title: 'Bulk Pipe Discount',
          description: 'Save on UPVC & CPVC pipe project orders.',
          discountText: '12% OFF',
          minimumOrder: 'Min order ₹25,000',
          validUntil: 'Ends 30 Sep 2026',
          categoryId: 'cat-pipes-tubing',
          productIds: productsByCategory('cat-pipes-tubing')
              .take(4)
              .map((p) => p.id)
              .toList(),
        ),
        Offer(
          id: 'offer-sanitary',
          title: 'Sanitaryware Combo',
          description: 'Seasonal discounts on closets & basins.',
          discountText: '10% OFF',
          minimumOrder: 'On selected sanitaryware',
          validUntil: 'Ends 15 Oct 2026',
          categoryId: 'cat-sanitary-wares',
          productIds: productsByCategory('cat-sanitary-wares')
              .take(3)
              .map((p) => p.id)
              .toList(),
        ),
      ];

  static const List<ConstructionTool> tools = [
    ConstructionTool(
      id: 'tool-material',
      title: 'Material Calculator',
      subtitle: 'Estimate costs from your cart materials',
      icon: 'calculate',
      routeName: AppRoutes.materialCalculator,
    ),
    ConstructionTool(
      id: 'tool-converter',
      title: 'Unit Converter',
      subtitle: 'Convert units across standards',
      icon: 'swap_horiz',
      routeName: AppRoutes.unitConverter,
    ),
    ConstructionTool(
      id: 'tool-quantity',
      title: 'Quantity Estimator',
      subtitle: 'Project-based material planning',
      icon: 'architecture',
      routeName: AppRoutes.quantityEstimator,
    ),
  ];

  static List<
          ({
            String id,
            String title,
            String icon,
            String routeName,
            int iconColor,
            int iconBackground
          })> get quickActions =>
      [
        (
          id: 'qa-quotation',
          title: 'Generate\nQuotation',
          icon: 'request_quote',
          routeName: AppRoutes.cart,
          iconColor: AppColors.primary.toARGB32(),
          iconBackground: AppColors.primaryContainer.toARGB32(),
        ),
        (
          id: 'qa-dealer',
          title: 'Find\nDealer',
          icon: 'storefront',
          routeName: AppRoutes.dealers,
          iconColor: AppColors.tertiary.toARGB32(),
          iconBackground: AppColors.tertiaryContainer.toARGB32(),
        ),
        (
          id: 'qa-brands',
          title: 'Top\nBrands',
          icon: 'business',
          routeName: AppRoutes.brands,
          iconColor: AppColors.info.toARGB32(),
          iconBackground: AppColors.infoContainer.toARGB32(),
        ),
        (
          id: 'qa-offers',
          title: 'Current\nOffers',
          icon: 'local_offer',
          routeName: AppRoutes.offers,
          iconColor: AppColors.secondary.toARGB32(),
          iconBackground: AppColors.secondaryContainer.toARGB32(),
        ),
      ];
}

class _CatalogIndex {
  _CatalogIndex({
    required this.categories,
    required this.subCategories,
    required this.brands,
    required this.products,
    required this.variants,
  });

  final List<Category> categories;
  final List<SubCategory> subCategories;
  final List<Brand> brands;
  final List<CatalogProduct> products;
  final List<ProductVariant> variants;

  static _CatalogIndex build() {
    final rows = PlumbingCatalogRows.all;
    final categoryMeta = <String, _CatMeta>{
      'Pipes & Tubing': _CatMeta(
        id: 'cat-pipes-tubing',
        icon: 'plumbing',
        description: 'UPVC, CPVC, HDPE and SWR pipes',
        iconColor: AppColors.primary.toARGB32(),
        iconBackground: AppColors.primaryContainer.toARGB32(),
        unit: 'pcs',
        imageAsset: 'assets/images/categories/pipes_tubing.png',
      ),
      'Fittings': _CatMeta(
        id: 'cat-fittings',
        icon: 'build',
        description: 'Elbows, tees, couplers and transitions',
        iconColor: AppColors.info.toARGB32(),
        iconBackground: AppColors.infoContainer.toARGB32(),
        unit: 'pcs',
        imageAsset: 'assets/images/categories/fittings.png',
      ),
      'Valves & Controls': _CatMeta(
        id: 'cat-valves-controls',
        icon: 'tune',
        description: 'Ball, gate, check, float and butterfly valves',
        iconColor: AppColors.secondary.toARGB32(),
        iconBackground: AppColors.secondaryContainer.toARGB32(),
        unit: 'pcs',
        imageAsset: 'assets/images/categories/valves_controls.png',
      ),
      'Sanitary Wares': _CatMeta(
        id: 'cat-sanitary-wares',
        icon: 'water_drop',
        description: 'Closets, basins, urinals and cisterns',
        iconColor: AppColors.tertiary.toARGB32(),
        iconBackground: AppColors.tertiaryContainer.toARGB32(),
        unit: 'pcs',
        imageAsset: 'assets/images/categories/sanitary_wares.png',
      ),
      'CP Fittings': _CatMeta(
        id: 'cat-cp-fittings',
        icon: 'shower',
        description: 'Faucets, showers and chrome fittings',
        iconColor: 0xFF0F766E,
        iconBackground: 0xFFCCFBF1,
        unit: 'pcs',
        imageAsset: 'assets/images/categories/cp_fittings.png',
      ),
      'Drainage & Accessories': _CatMeta(
        id: 'cat-drainage-accessories',
        icon: 'grid_view',
        description: 'Floor drains, traps and covers',
        iconColor: AppColors.onSurfaceVariant.toARGB32(),
        iconBackground: AppColors.surfaceVariant.toARGB32(),
        unit: 'pcs',
        imageAsset: 'assets/images/categories/drainage_accessories.png',
      ),
      'Consumables': _CatMeta(
        id: 'cat-consumables',
        icon: 'science',
        description: 'Solvent cement, sealing and mounting',
        iconColor: AppColors.warning.toARGB32(),
        iconBackground: AppColors.warningContainer.toARGB32(),
        unit: 'pcs',
        imageAsset: 'assets/images/categories/consumables.png',
      ),
    };

    final categoryOrder = <String>[];
    final subOrder = <String, List<String>>{};
    final productCounts = <String, int>{};
    final subCounts = <String, int>{};

    for (final row in rows) {
      if (!categoryOrder.contains(row.mainCategory)) {
        categoryOrder.add(row.mainCategory);
      }
      subOrder.putIfAbsent(row.mainCategory, () => <String>[]);
      if (!subOrder[row.mainCategory]!.contains(row.subCategory)) {
        subOrder[row.mainCategory]!.add(row.subCategory);
      }
      final meta = categoryMeta[row.mainCategory]!;
      productCounts[meta.id] = (productCounts[meta.id] ?? 0) + 1;
      final subId = _subId(meta.id, row.subCategory);
      subCounts[subId] = (subCounts[subId] ?? 0) + 1;
    }

    final categories = <Category>[];
    final subCategories = <SubCategory>[];
    for (final main in categoryOrder) {
      final meta = categoryMeta[main]!;
      final subIds = subOrder[main]!
          .map((s) => _subId(meta.id, s))
          .toList(growable: false);
      categories.add(
        Category(
          id: meta.id,
          name: main,
          icon: meta.icon,
          itemCount: productCounts[meta.id] ?? 0,
          iconColor: meta.iconColor,
          iconBackground: meta.iconBackground,
          imageAsset: meta.imageAsset,
          description: meta.description,
          subCategoryIds: subIds,
        ),
      );
      for (final subName in subOrder[main]!) {
        final sid = _subId(meta.id, subName);
        subCategories.add(
          SubCategory(
            id: sid,
            categoryId: meta.id,
            name: subName,
            productCount: subCounts[sid] ?? 0,
          ),
        );
      }
    }

    final products = <CatalogProduct>[];
    final rowByProductId = {
      for (final row in rows) row.productId: row,
    };
    for (final row in rows) {
      final meta = categoryMeta[row.mainCategory]!;
      final subId = _subId(meta.id, row.subCategory);
      final specs = <String, String>{
        'SKU': row.sku,
        'Material': row.material,
        'Size': row.size,
        if (row.attributes.trim().isNotEmpty) 'Attributes': row.attributes,
      };
      products.add(
        CatalogProduct(
          id: row.productId,
          sku: row.sku,
          name: row.name,
          categoryId: meta.id,
          categoryName: row.mainCategory,
          subCategoryId: subId,
          subCategoryName: row.subCategory,
          description: _descriptionFor(row),
          basePrice: row.priceInr,
          unit: _unitFor(row, meta.unit),
          icon: meta.icon,
          imageAsset: meta.imageAsset,
          specifications: specs,
          specSummary: _specSummary(row),
          isFeatured: row.isFeatured,
          isPopular: row.isPopular,
        ),
      );
    }

    final variants = <ProductVariant>[];
    final brandVariantCounts = <String, int>{};

    for (final product in products) {
      final brandList = BrandSeedData.brandsForCategory(product.categoryId);
      final selected = brandList.isEmpty
          ? BrandSeedData.brands.take(2).toList()
          : brandList.take(4).toList();

      for (var i = 0; i < selected.length; i++) {
        final brand = selected[i];
        final row = rowByProductId[product.id];
        final isUpvcPipe =
            product.subCategoryId == CatalogMockData.upvcPipesSubCategoryId;
        final isPipesTubing =
            product.categoryId == CatalogMockData.pipesTubingCategoryId;

        late final double price;
        String? pipeType;
        double? mrp;
        double? purchasePrice;
        double? discountRate;

        if (isUpvcPipe && row?.mrp != null && row?.discountRate != null) {
          final brandFactor = _upvcBrandPriceFactor(brand.id, i);
          mrp = (row!.mrp! * brandFactor.mrpMultiplier)
              .roundToDouble()
              .clamp(1.0, 999999999.0);
          purchasePrice = (row.purchasePrice! * brandFactor.ppMultiplier)
              .roundToDouble()
              .clamp(1.0, 999999999.0);
          discountRate = (row.discountRate! + brandFactor.discountDelta)
              .clamp(0.0, 0.5);
          pipeType = row.pipeType;
          price = mrp - (mrp * discountRate);
        } else if (isPipesTubing) {
          final brandFactor = _upvcBrandPriceFactor(brand.id, i);
          final delta = _priceDelta(i, selected.length);
          final baseMrp = product.basePrice * (1 + delta) * brandFactor.mrpMultiplier;
          mrp = baseMrp.roundToDouble().clamp(1.0, 999999999.0);
          purchasePrice = (product.basePrice * (0.84 + delta.abs() * 0.02) *
                  brandFactor.ppMultiplier)
              .roundToDouble()
              .clamp(1.0, 999999999.0);
          discountRate =
              (0.07 + brandFactor.discountDelta + (i * 0.004)).clamp(0.0, 0.5);
          pipeType = row?.pipeType ?? product.subCategoryName;
          price = mrp - (mrp * discountRate);
        } else {
          final delta = _priceDelta(i, selected.length);
          final brandFactor = _upvcBrandPriceFactor(brand.id, i);
          mrp = (product.basePrice * (1 + delta) * (1.08 + i * 0.02) *
                  brandFactor.mrpMultiplier)
              .roundToDouble()
              .clamp(1.0, 999999999.0);
          discountRate = (0.06 + brandFactor.discountDelta + (i * 0.005))
              .clamp(0.0, 0.35);
          purchasePrice = (product.basePrice * 0.82 * brandFactor.ppMultiplier)
              .roundToDouble()
              .clamp(1.0, 999999999.0);
          price = mrp - (mrp * discountRate);
          pipeType = row?.pipeType ?? product.subCategoryName;
        }

        final stock = isPipesTubing
            ? (i % 3 == 2
                ? StockStatus.outOfStock
                : StockStatus.inStock)
            : i == selected.length - 1 && selected.length > 2
                ? StockStatus.limited
                : StockStatus.inStock;
        final rating = 4.0 + ((i % 5) * 0.1);
        final variantId = '${product.id}__${brand.id}';
        variants.add(
          ProductVariant(
            id: variantId,
            productId: product.id,
            productName: product.name,
            sku: '${product.sku}-${brand.abbreviation}',
            brandId: brand.id,
            brandName: brand.name,
            categoryId: product.categoryId,
            categoryName: product.categoryName,
            subCategoryId: product.subCategoryId,
            subCategoryName: product.subCategoryName,
            description: product.description,
            price: price,
            unit: product.unit,
            icon: product.icon,
            imageAsset: product.imageAsset,
            rating: double.parse(rating.toStringAsFixed(1)),
            reviewCount: 40 + (i * 37) + (product.id.hashCode % 200).abs(),
            stockStatus: stock,
            specifications: {
              ...product.specifications,
              'Brand': brand.name,
            },
            specSummary: product.specSummary,
            minimumOrderQuantity: 1,
            isFeatured: product.isFeatured && i == 0,
            isPopular: product.isPopular && i <= 1,
            pipeType: pipeType,
            mrp: mrp,
            purchasePrice: purchasePrice,
            discountRate: discountRate,
          ),
        );
        brandVariantCounts[brand.id] =
            (brandVariantCounts[brand.id] ?? 0) + 1;
      }
    }

    final brands = BrandSeedData.brands
        .map(
          (b) => Brand(
            id: b.id,
            name: b.name,
            abbreviation: b.abbreviation,
            color: b.color,
            productCount: brandVariantCounts[b.id] ?? 0,
            logoAsset: b.logoAsset,
            description: b.description,
            categoryIds: b.categoryIds,
          ),
        )
        .where((b) => b.productCount > 0)
        .toList();

    return _CatalogIndex(
      categories: categories,
      subCategories: subCategories,
      brands: brands,
      products: products,
      variants: variants,
    );
  }

  static String _subId(String categoryId, String subName) {
    final slug = subName
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    return '${categoryId}__$slug';
  }

  static double _priceDelta(int index, int total) {
    // Spread brand prices around Excel base (± ~6%).
    if (total <= 1) return 0;
    const step = 0.04;
    return (index - (total - 1) / 2) * step;
  }

  static ({double mrpMultiplier, double ppMultiplier, double discountDelta})
      _upvcBrandPriceFactor(String brandId, int index) {
    switch (brandId) {
      case 'brand-astral':
        return (mrpMultiplier: 1.0, ppMultiplier: 1.0, discountDelta: 0.0);
      case 'brand-supreme':
        return (mrpMultiplier: 0.97, ppMultiplier: 0.96, discountDelta: 0.005);
      case 'brand-finolex':
        return (mrpMultiplier: 1.03, ppMultiplier: 1.02, discountDelta: -0.005);
      case 'brand-ashirvad':
        return (mrpMultiplier: 1.06, ppMultiplier: 1.04, discountDelta: -0.01);
      default:
        return (
          mrpMultiplier: 1.0 + (index * 0.01),
          ppMultiplier: 1.0 + (index * 0.008),
          discountDelta: 0.0,
        );
    }
  }

  static String _unitFor(PlumbingCatalogRow row, String fallback) {
    final attrs = row.attributes.toLowerCase();
    if (attrs.contains('6m') || attrs.contains('3m') || attrs.contains('coil')) {
      return 'pcs';
    }
    if (row.mainCategory == 'Consumables') {
      if (row.subCategory == 'Solvent Cement') return 'can';
      if (row.subCategory == 'Sealing') return 'roll';
      if (row.subCategory == 'Hardware') return 'pack';
      if (row.subCategory == 'Tools') return 'pcs';
    }
    return fallback;
  }

  static String _specSummary(PlumbingCatalogRow row) {
    final parts = <String>[
      if (row.size.trim().isNotEmpty) row.size,
      if (row.material.trim().isNotEmpty) row.material,
    ];
    if (row.attributes.trim().isNotEmpty) {
      final first = row.attributes.split(',').first.trim();
      if (first.isNotEmpty) parts.add(first);
    }
    return parts.take(3).join(' · ');
  }

  static String _descriptionFor(PlumbingCatalogRow row) {
    final buffer = StringBuffer(row.name);
    if (row.material.isNotEmpty) {
      buffer.write(' in ${row.material}');
    }
    if (row.size.isNotEmpty) {
      buffer.write(', size ${row.size}');
    }
    if (row.attributes.isNotEmpty) {
      buffer.write('. ${row.attributes}');
    }
    buffer.write('. Choose from available brands before adding to cart.');
    return buffer.toString();
  }
}

class _CatMeta {
  const _CatMeta({
    required this.id,
    required this.icon,
    required this.description,
    required this.iconColor,
    required this.iconBackground,
    required this.unit,
    required this.imageAsset,
  });

  final String id;
  final String icon;
  final String description;
  final int iconColor;
  final int iconBackground;
  final String unit;
  final String imageAsset;
}
