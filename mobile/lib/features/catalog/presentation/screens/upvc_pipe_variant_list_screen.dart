import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/category_image.dart';
import '../../data/catalog_assets.dart';
import '../../data/mock/catalog_mock_data.dart';
import '../../data/pipe_schedule_util.dart';
import '../../data/mock/upvc_pipe_matrix_data.dart';
import '../../domain/models/catalog_models.dart';
import '../widgets/pipes_filter_panel.dart';

/// Pipe product configurator — wireframe layout with image carousel,
/// product details, add-to-cart card, and bottom filters.
class UpvcPipeVariantListScreen extends StatefulWidget {
  const UpvcPipeVariantListScreen({
    super.key,
    this.subCategoryId,
    this.productId,
    this.title,
    this.heroImageAsset,
    this.categoryIds,
  });

  final String? subCategoryId;
  final String? productId;
  final String? title;
  final String? heroImageAsset;
  final List<String>? categoryIds;

  @override
  State<UpvcPipeVariantListScreen> createState() =>
      _UpvcPipeVariantListScreenState();
}

class _UpvcPipeVariantListScreenState extends State<UpvcPipeVariantListScreen> {
  String? _brandId;
  String? _size;
  String? _pipeType;
  bool _filtersInitialized = false;
  String? _initializedForSubCategory;
  String? _lastCatalogFingerprint;

  PipeFilterTab? _openFilter;
  PipeModuleSort _sort = PipeModuleSort.all;
  String? _selectedBrand;

  final PageController _pageController = PageController();
  int _carouselIndex = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  List<ProductVariant> _moduleVariants(CatalogController catalog) {
    if (catalog.isUsingApi && catalog.pipeVariants.isNotEmpty) {
      return catalog.pipeVariants;
    }
    return CatalogMockData.variants
        .where((variant) => CatalogMockData.plumbingModuleCategoryIds
            .contains(variant.categoryId))
        .toList();
  }

  bool _usesUpvcMatrix(CatalogController catalog) {
    final isUpvcScope =
        widget.subCategoryId == CatalogMockData.upvcPipesSubCategoryId ||
            (widget.categoryIds?.length == 1 &&
                widget.categoryIds!.first ==
                    CatalogMockData.pipesTubingCategoryId);
    if (!isUpvcScope) return false;
    if (!catalog.isUsingApi) return true;

    final apiUpvc = catalog.pipeVariants.where(
      (v) => v.subCategoryId == CatalogMockData.upvcPipesSubCategoryId,
    );
    return !apiUpvc.any(
      (v) => _typeLabel(v).toLowerCase().startsWith('sch'),
    );
  }

  bool _usesCpvcMatrix(CatalogController catalog) {
    final isCpvcScope =
        widget.subCategoryId == CatalogMockData.cpvcPipesSubCategoryId;
    if (!isCpvcScope) return false;
    if (!catalog.isUsingApi) return true;

    final apiCpvc = catalog.pipeVariants.where(
      (v) => v.subCategoryId == CatalogMockData.cpvcPipesSubCategoryId,
    );
    return apiCpvc.isEmpty;
  }

  bool _usesPvcSwrMatrix(CatalogController catalog) {
    final isPvcSwrScope =
        widget.subCategoryId == CatalogMockData.pvcSwrPipesSubCategoryId;
    if (!isPvcSwrScope) return false;
    if (!catalog.isUsingApi) return true;

    final apiPvcSwr = catalog.pipeVariants.where(
      (v) => v.subCategoryId == CatalogMockData.pvcSwrPipesSubCategoryId,
    );
    return apiPvcSwr.isEmpty;
  }

  List<ProductVariant> _all(CatalogController catalog) {
    if (_usesUpvcMatrix(catalog)) {
      return CatalogMockData.upvcPipeMatrixVariants;
    }
    if (_usesCpvcMatrix(catalog)) {
      return CatalogMockData.cpvcPipeMatrixVariants;
    }
    if (_usesPvcSwrMatrix(catalog)) {
      return CatalogMockData.pvcSwrPipeMatrixVariants;
    }

    final categoryIds = widget.categoryIds;
    return categoryIds != null
        ? _moduleVariants(catalog)
            .where((v) => categoryIds.contains(v.categoryId))
            .toList()
        : catalog.pipeVariantsForSubCategory(widget.subCategoryId);
  }

  List<ProductVariant> _variantsForTappedProduct(List<ProductVariant> all) {
    final productId = widget.productId?.trim();
    if (productId == null || productId.isEmpty) return const [];
    return all.where((v) => v.productId == productId).toList();
  }

  List<ProductVariant> _filteredPool(List<ProductVariant> all) {
    var list = List<ProductVariant>.from(all);

    if (_selectedBrand != null) {
      list = list
          .where((v) => variantMatchesPipeBrand(v, _selectedBrand!))
          .toList();
    }
    if (_size != null && _size!.isNotEmpty) {
      list = list.where((v) => variantMatchesPipeSize(v, _size!)).toList();
    }

    switch (_sort) {
      case PipeModuleSort.all:
        break;
      case PipeModuleSort.discount:
        list.sort(
          (a, b) => (b.effectiveDiscountRate ?? 0)
              .compareTo(a.effectiveDiscountRate ?? 0),
        );
      case PipeModuleSort.priceLowHigh:
        list.sort(
          (a, b) => (a.sellingPrice ?? a.price)
              .compareTo(b.sellingPrice ?? b.price),
        );
      case PipeModuleSort.whatsNew:
        list = list.reversed.toList();
      case PipeModuleSort.priceHighLow:
        list.sort(
          (a, b) => (b.sellingPrice ?? b.price)
              .compareTo(a.sellingPrice ?? a.price),
        );
      case PipeModuleSort.ratings:
        list.sort((a, b) => b.rating.compareTo(a.rating));
    }
    return list;
  }

  void _ensureDefaultFilters(
    List<ProductVariant> all,
    CatalogController catalog,
  ) {
    final key =
        '${widget.subCategoryId ?? '__all__'}:${widget.productId ?? ''}:${widget.categoryIds?.join(',') ?? ''}';
    final fingerprint =
        '${catalog.isUsingApi}:${catalog.pipeCatalogFingerprint}:$key';
    if (_lastCatalogFingerprint != fingerprint) {
      _lastCatalogFingerprint = fingerprint;
      _filtersInitialized = false;
      _initializedForSubCategory = null;
      _brandId = null;
      _size = null;
      _pipeType = null;
      _selectedBrand = null;
    }

    _sanitizeFilters(all, catalog);

    if (_filtersInitialized && _initializedForSubCategory == key) return;
    if (all.isEmpty) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_filtersInitialized && _initializedForSubCategory == key) return;
      final tapped = _variantsForTappedProduct(all);
      final initial = _cheapestVariant(tapped) ??
          _defaultVariant(all) ??
          _cheapestVariant(all);
      if (initial == null) return;
      setState(() {
        _brandId = _nonEmpty(initial.brandId);
        _selectedBrand = _nonEmpty(initial.brandName);
        _size = _nonEmpty(initial.specifications['Size']);
        _pipeType = _typeLabel(initial);
        _filtersInitialized = true;
        _initializedForSubCategory = key;
      });
    });
  }

  String? _nonEmpty(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    return value.trim();
  }

  void _sanitizeFilters(List<ProductVariant> all, CatalogController catalog) {
    final brands = _brandOptions(all, catalog);
    final types = _typeOptions(all);
    final sizes = _sizeOptions(all);

    _brandId = _nonEmpty(_brandId);
    _size = _nonEmpty(_size);
    _pipeType = _nonEmpty(_pipeType);
    _selectedBrand = _nonEmpty(_selectedBrand);

    if (_brandId != null && !brands.contains(_brandId)) _brandId = null;
    if (_selectedBrand != null &&
        !all.any((v) => variantMatchesPipeBrand(v, _selectedBrand!))) {
      _selectedBrand = null;
    }
    if (_pipeType != null && !types.contains(_pipeType)) {
      _pipeType = null;
    }
    if (_size != null && !sizes.contains(_size) &&
        !PipeFilterSizes.all.contains(_size)) {
      _size = null;
    }
  }

  List<String> _sizeOptions(List<ProductVariant> all) {
    final sizes = all
        .map((v) => v.specifications['Size'] ?? '')
        .where((s) => s.isNotEmpty)
        .toSet()
        .toList();
    sizes.sort(UpvcPipeMatrixData.compareSizeLabels);
    return sizes;
  }

  List<String> _brandOptions(List<ProductVariant> all, CatalogController catalog) =>
      all
      .map((v) => v.brandId)
      .toSet()
      .toList()
    ..sort((a, b) => _brandName(a, catalog).compareTo(_brandName(b, catalog)));

  String _typeLabel(ProductVariant variant) =>
      PipeScheduleUtil.normalizePipeSchedule(variant.pipeType) ??
      PipeScheduleUtil.normalizePipeSchedule(variant.specifications['Type']) ??
      '';

  List<String> _typeOptions(List<ProductVariant> all) => all
      .map(_typeLabel)
      .where((t) => t.isNotEmpty)
      .toSet()
      .toList()
    ..sort();

  String _brandName(String brandId, CatalogController catalog) =>
      catalog.brandById(brandId)?.name ?? brandId;

  List<ProductVariant> _selectionPool(List<ProductVariant> all) {
    var list = List<ProductVariant>.from(all);
    if (_selectedBrand != null) {
      list = list
          .where((v) => variantMatchesPipeBrand(v, _selectedBrand!))
          .toList();
    }
    return list;
  }

  bool _matchesSize(ProductVariant variant, String size) {
    final specSize = variant.specifications['Size'] ?? '';
    return specSize == size || variantMatchesPipeSize(variant, size);
  }

  List<ProductVariant> _applySelections(
    List<ProductVariant> source, {
    String? brandId,
    String? size,
    String? type,
  }) {
    var list = source;
    if (brandId != null && brandId.isNotEmpty) {
      list = list.where((v) => v.brandId == brandId).toList();
    }
    if (size != null && size.isNotEmpty) {
      list = list.where((v) => _matchesSize(v, size)).toList();
    }
    if (type != null && type.isNotEmpty) {
      list = list.where((v) => _typeLabel(v) == type).toList();
    }
    return list;
  }

  List<String> _availableSizes(
    List<ProductVariant> pool, {
    String? forType,
  }) {
    final filtered = forType == null
        ? pool
        : pool.where((v) => _typeLabel(v) == forType).toList();
    return _sizeOptions(filtered);
  }

  List<String> _availableTypes(
    List<ProductVariant> pool, {
    String? forSize,
  }) {
    final filtered = forSize == null
        ? pool
        : pool.where((v) => _matchesSize(v, forSize)).toList();
    return _typeOptions(filtered);
  }

  void _syncFromVariant(ProductVariant variant) {
    _brandId = variant.brandId;
    _selectedBrand = variant.brandName;
    _size = _nonEmpty(variant.specifications['Size']);
    _pipeType = _typeLabel(variant);
  }

  ProductVariant? _resolvedVariant(
    List<ProductVariant> all,
    CatalogController catalog,
  ) {
    if (all.isEmpty) return null;

    final pool = _filteredPool(all);
    if (pool.isNotEmpty) {
      final exact = _applySelections(
        pool,
        brandId: _brandId,
        size: _size,
        type: _pipeType,
      );
      if (exact.isNotEmpty) return exact.first;
      return pool.first;
    }

    final exact = _applySelections(
      all,
      brandId: _brandId,
      size: _size,
      type: _pipeType,
    );
    if (exact.isNotEmpty) return exact.first;

    if (_pipeType != null && _pipeType!.isNotEmpty) {
      if (_brandId != null && _brandId!.isNotEmpty) {
        final match = _applySelections(
          all,
          brandId: _brandId,
          type: _pipeType,
        );
        if (match.isNotEmpty) return match.first;
      }
      if (_size != null && _size!.isNotEmpty) {
        final match = _applySelections(
          all,
          size: _size,
          type: _pipeType,
        );
        if (match.isNotEmpty) return match.first;
      }
      final byType = _applySelections(all, type: _pipeType);
      if (byType.isNotEmpty) return byType.first;
    }

    if (_brandId != null && _size != null) {
      final match = _applySelections(all, brandId: _brandId, size: _size);
      if (match.isNotEmpty) return match.first;
    }
    if (_brandId != null) {
      final match = _applySelections(all, brandId: _brandId);
      if (match.isNotEmpty) return match.first;
    }
    if (_size != null) {
      final match = _applySelections(all, size: _size);
      if (match.isNotEmpty) return match.first;
    }

    return all.first;
  }

  ProductVariant? _defaultVariant(List<ProductVariant> variants) {
    for (final variant in variants) {
      if (variant.brandName == 'Astral' &&
          _typeLabel(variant) == 'Sch 40' &&
          _matchesSize(variant, '15 MM (1/2")')) {
        return variant;
      }
    }
    return null;
  }

  ProductVariant? _cheapestVariant(List<ProductVariant> variants) {
    if (variants.isEmpty) return null;
    final inStock = variants.where((v) => v.inStock).toList();
    final pool = inStock.isNotEmpty ? inStock : variants;
    return pool.reduce(
      (a, b) => a.price <= b.price ? a : b,
    );
  }

  List<_CarouselSlide> _carouselSlides(
    List<ProductVariant> all,
    ProductVariant? variant,
  ) {
    final slides = <_CarouselSlide>[];
    final seen = <String>{};

    for (final item in all) {
      final url = item.imageUrl;
      if (url != null && url.isNotEmpty && seen.add(url)) {
        slides.add(_CarouselSlide(imageUrl: url));
      }
      final asset = item.imageAsset;
      if (asset.isNotEmpty && seen.add(asset)) {
        slides.add(_CarouselSlide(imageAsset: asset));
      }
    }

    if (slides.isEmpty && widget.heroImageAsset != null) {
      slides.add(_CarouselSlide(imageAsset: widget.heroImageAsset!));
    } else if (slides.isEmpty) {
      slides.add(
        _CarouselSlide(
          imageAsset: variant?.imageAsset.isNotEmpty == true
              ? variant!.imageAsset
              : CatalogAssets.pipeSummary,
          imageUrl: variant?.imageUrl,
        ),
      );
    }

    return slides;
  }

  void _onSizeFilterChanged(String? size) {
    setState(() {
      _size = size;
      if (size == null) return;
      final catalog = context.read<CatalogController>();
      final all = _all(catalog);
      final pool = _selectionPool(all);
      var matches = pool.where((v) => _matchesSize(v, size)).toList();
      if (_pipeType != null) {
        final typed =
            matches.where((v) => _typeLabel(v) == _pipeType).toList();
        if (typed.isNotEmpty) matches = typed;
      }
      if (matches.isEmpty) return;
      _syncFromVariant(matches.first);
    });
  }

  void _onSizeDropdownChanged(String? size) => _onSizeFilterChanged(size);

  void _onTypeDropdownChanged(String? type) {
    setState(() {
      _pipeType = type;
      if (type == null) return;
      final catalog = context.read<CatalogController>();
      final all = _all(catalog);
      final pool = _selectionPool(all);
      var matches = pool.where((v) => _typeLabel(v) == type).toList();
      if (_size != null) {
        final sized = matches.where((v) => _matchesSize(v, _size!)).toList();
        if (sized.isNotEmpty) matches = sized;
      }
      if (matches.isEmpty) return;
      _syncFromVariant(matches.first);
    });
  }

  void _onBrandFilterChanged(String? brandName) {
    setState(() {
      _selectedBrand = brandName;
      if (brandName == null) {
        _brandId = null;
        return;
      }
      final catalog = context.read<CatalogController>();
      final all = _all(catalog);
      final pool = _selectionPool(all);
      var matches =
          pool.where((v) => variantMatchesPipeBrand(v, brandName)).toList();
      if (_size != null) {
        final sized = matches.where((v) => _matchesSize(v, _size!)).toList();
        if (sized.isNotEmpty) matches = sized;
      }
      if (_pipeType != null) {
        final typed =
            matches.where((v) => _typeLabel(v) == _pipeType).toList();
        if (typed.isNotEmpty) matches = typed;
      }
      if (matches.isEmpty) return;
      _syncFromVariant(matches.first);
    });
  }

  void _addToCart(ProductVariant variant) {
    context.read<CartController>().addVariant(variant);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: AppColors.onPrimary, size: 20),
            const SizedBox(width: AppSpacing.space2),
            Expanded(child: Text('${variant.displayName} added to cart')),
          ],
        ),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final catalog = context.watch<CatalogController>();
    final all = _all(catalog);
    _ensureDefaultFilters(all, catalog);
    final variant = _resolvedVariant(all, catalog);
    final slides = _carouselSlides(all, variant);
    final selectionPool = _selectionPool(all);
    final sizeOptions = _availableSizes(selectionPool, forType: _pipeType);
    final typeOptions = _availableTypes(selectionPool, forSize: _size);
    final productName =
        variant?.productName ?? widget.title ?? 'Pipe configurator';
    final selectedSize = _size ?? variant?.specifications['Size'];
    final selectedType = _pipeType ?? (variant == null ? null : _typeLabel(variant));
    final price = variant?.sellingPrice ?? variant?.price;
    final unit = variant?.unit ?? 'piece';

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          _PipeConfiguratorHeader(
            onBack: () => Navigator.of(context).maybePop(),
            onSearch: () => Navigator.of(context).pushNamed(
              AppRoutes.search,
              arguments: const SearchArgs(),
            ),
          ),
          Expanded(
            child: Stack(
              children: [
                SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.space4,
                    AppSpacing.space3,
                    AppSpacing.space4,
                    AppSpacing.space4,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _ProductImageCarousel(
                        slides: slides,
                        pageController: _pageController,
                        currentIndex: _carouselIndex,
                        onPageChanged: (index) =>
                            setState(() => _carouselIndex = index),
                      ),
                      const SizedBox(height: AppSpacing.space4),
                      Text(
                        productName,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.space2),
                      _ProductOptionDropdown(
                        value: selectedSize,
                        options: sizeOptions,
                        hint: 'Select size',
                        onChanged: sizeOptions.isEmpty ? null : _onSizeDropdownChanged,
                      ),
                      const SizedBox(height: AppSpacing.space2),
                      _ProductOptionDropdown(
                        value: selectedType,
                        options: typeOptions,
                        hint: 'Select type',
                        onChanged:
                            typeOptions.isEmpty ? null : _onTypeDropdownChanged,
                      ),
                      const SizedBox(height: AppSpacing.space4),
                      _AddToCartCard(
                        selectedSizeLabel: selectedSize ?? '—',
                        price: price,
                        unit: unit,
                        enabled: variant != null && variant.inStock,
                        onAddToCart: variant == null
                            ? null
                            : () => _addToCart(variant),
                      ),
                      if (catalog.isLoading && all.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: AppSpacing.space3),
                          child: LinearProgressIndicator(color: AppColors.primary),
                        ),
                      if (!catalog.isLoading && all.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpacing.space4),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.info_outline_rounded,
                                size: 18,
                                color: AppColors.onSurfaceVariant,
                              ),
                              const SizedBox(width: AppSpacing.space2),
                              Expanded(
                                child: Text(
                                  'No products available.',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: AppColors.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                if (_openFilter != null)
                  Positioned.fill(
                    child: GestureDetector(
                      onTap: () => setState(() => _openFilter = null),
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.25),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          PipesFilterChrome(
            activeTab: _openFilter,
            onTabSelected: (tab) => setState(() => _openFilter = tab),
            onClose: () => setState(() => _openFilter = null),
            sort: _sort,
            selectedSize: _size,
            selectedBrand: _selectedBrand,
            availableBrands: PipeFilterBrands.fromVariants(all),
            onSortChanged: (value) => setState(() => _sort = value),
            onSizeChanged: _onSizeFilterChanged,
            onBrandChanged: _onBrandFilterChanged,
          ),
        ],
      ),
    );
  }
}

class _CarouselSlide {
  const _CarouselSlide({this.imageAsset, this.imageUrl});

  final String? imageAsset;
  final String? imageUrl;
}

class _PipeConfiguratorHeader extends StatelessWidget {
  const _PipeConfiguratorHeader({
    required this.onBack,
    required this.onSearch,
  });

  final VoidCallback onBack;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFEAF0FF),
            AppColors.surface,
          ],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.space3,
            AppSpacing.space2,
            AppSpacing.space3,
            AppSpacing.space3,
          ),
          child: Row(
            children: [
              _HeaderIconButton(
                icon: Icons.arrow_back_rounded,
                onPressed: onBack,
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
                            style: Theme.of(context).textTheme.bodyMedium,
                            decoration: InputDecoration(
                              isDense: true,
                              filled: false,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              hintText: 'Search products',
                              hintStyle: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: AppColors.outline),
                              contentPadding: EdgeInsets.zero,
                            ),
                            onTap: onSearch,
                            onSubmitted: (query) {
                              Navigator.of(context).pushNamed(
                                AppRoutes.search,
                                arguments: SearchArgs(initialQuery: query),
                              );
                            },
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
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    required this.onPressed,
  });

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
          width: 44,
          height: 44,
          child: Icon(icon, size: 22, color: AppColors.onBackground),
        ),
      ),
    );
  }
}

class _ProductImageCarousel extends StatelessWidget {
  const _ProductImageCarousel({
    required this.slides,
    required this.pageController,
    required this.currentIndex,
    required this.onPageChanged,
  });

  final List<_CarouselSlide> slides;
  final PageController pageController;
  final int currentIndex;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
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
          child: PageView.builder(
            controller: pageController,
            itemCount: slides.length,
            onPageChanged: onPageChanged,
            itemBuilder: (context, index) {
              final slide = slides[index];
              return CategoryImage(
                imageAsset: slide.imageAsset ?? '',
                imageUrl: slide.imageUrl,
                fallbackIcon: 'plumbing',
                fallbackIconColor: AppColors.outline,
                fallbackBackground: AppColors.surfaceContainer,
                fit: BoxFit.contain,
                borderRadius: AppRadius.lgAll,
                iconSize: AppSpacing.space8,
              );
            },
          ),
        ),
        if (slides.length > 1) ...[
          const SizedBox(height: AppSpacing.space2),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < slides.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: i == currentIndex ? 18 : 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    color: i == currentIndex
                        ? AppColors.primary
                        : AppColors.outlineVariant,
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _AddToCartCard extends StatelessWidget {
  const _AddToCartCard({
    required this.selectedSizeLabel,
    required this.price,
    required this.unit,
    required this.enabled,
    required this.onAddToCart,
  });

  final String selectedSizeLabel;
  final double? price;
  final String unit;
  final bool enabled;
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
                if (price != null)
                  RichText(
                    text: TextSpan(
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.onBackground,
                      ),
                      children: [
                        const TextSpan(text: '₹'),
                        TextSpan(text: price!.toStringAsFixed(0)),
                        TextSpan(
                          text: '/ $unit',
                          style: theme.textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w500,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Text(
                    '—',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                Text(
                  enabled ? selectedSizeLabel : 'Out of stock',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: enabled ? AppColors.onSurfaceVariant : AppColors.error,
                    fontWeight: enabled ? FontWeight.w400 : FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          Material(
            color: enabled ? AppColors.accentGreenContainer : AppColors.disabledContainer,
            borderRadius: AppRadius.lgAll,
            child: InkWell(
              onTap: enabled ? onAddToCart : null,
              borderRadius: AppRadius.lgAll,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.space4,
                  vertical: AppSpacing.space3,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.add_shopping_cart_rounded,
                      size: 18,
                      color: enabled
                          ? AppColors.onAccentGreenContainer
                          : AppColors.disabled,
                    ),
                    const SizedBox(width: AppSpacing.space1),
                    Text(
                      'Add to Cart',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: enabled
                            ? AppColors.onAccentGreenContainer
                            : AppColors.disabled,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductOptionDropdown extends StatelessWidget {
  const _ProductOptionDropdown({
    required this.value,
    required this.options,
    required this.hint,
    required this.onChanged,
  });

  final String? value;
  final List<String> options;
  final String hint;
  final ValueChanged<String?>? onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final selected = value != null && options.contains(value) ? value : null;
    final enabled = onChanged != null;
    final textStyle = theme.textTheme.titleSmall?.copyWith(
      fontWeight: FontWeight.w700,
      color: enabled ? AppColors.onBackground : AppColors.disabled,
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space3),
      decoration: BoxDecoration(
        color: enabled ? AppColors.surface : AppColors.disabledContainer,
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: enabled ? AppColors.outlineVariant : AppColors.divider,
        ),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: selected,
          hint: Text(hint, style: textStyle),
          icon: Icon(
            Icons.keyboard_arrow_down_rounded,
            color: enabled ? AppColors.onSurfaceVariant : AppColors.disabled,
          ),
          style: textStyle,
          items: [
            for (final option in options)
              DropdownMenuItem<String>(
                value: option,
                child: Text(option),
              ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }
}
