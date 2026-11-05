import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/catalog_filter_sheet.dart';
import '../../../../shared/widgets/catalog_widgets.dart';
import '../../../../shared/widgets/category_image.dart';
import '../../data/mappers/catalog_api_mapper.dart';
import '../../domain/models/catalog_models.dart';

class ProductListScreen extends StatefulWidget {
  const ProductListScreen({
    super.key,
    this.categoryId,
    this.subCategoryId,
    this.brandId,
    this.title,
  });

  final String? categoryId;
  final String? subCategoryId;
  final String? brandId;
  final String? title;

  @override
  State<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends State<ProductListScreen> {
  late CatalogFilterState _filter;

  @override
  void initState() {
    super.initState();
    _filter = CatalogFilterState(subCategoryId: widget.subCategoryId);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final catalog = context.read<CatalogController>();
      if (catalog.pipeVariants.isEmpty) {
        catalog.refreshHomeCatalog(showLoading: false);
      }
    });
  }

  List<CatalogProduct> _baseProducts(CatalogController catalog) {
    if (widget.subCategoryId != null) {
      final variants = catalog.pipeVariants
          .where((v) => v.subCategoryId == widget.subCategoryId)
          .toList();
      return variants.map(CatalogApiMapper.productFromVariant).toList();
    }
    if (widget.categoryId != null) {
      return catalog.productsForCategory(widget.categoryId!);
    }
    if (widget.title == 'Featured Products') {
      return catalog.featuredProducts;
    }
    if (widget.title == 'Popular Products') {
      return catalog.popularProducts;
    }
    if (widget.title == 'Recently Viewed') {
      return const [];
    }
    return catalog.allCatalogProducts;
  }

  Future<void> _openFilters(CatalogController catalog) async {
    final categoryId = widget.categoryId ??
        catalog.pipesCategoryId ??
        (widget.subCategoryId != null
            ? catalog.pipeVariants
                .where((v) => v.subCategoryId == widget.subCategoryId)
                .map((v) => v.categoryId)
                .firstOrNull
            : null);
    final result = await showCatalogFilterSheet(
      context: context,
      initial: _filter,
      categoryId: categoryId,
      subCategories: categoryId == null
          ? const []
          : catalog.subCategoriesFor(categoryId),
      brands: categoryId == null
          ? catalog.catalogBrands
          : catalog.brandsForCategory(categoryId),
    );
    if (result != null && mounted) {
      setState(() => _filter = result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogController>();
    final theme = Theme.of(context);

    if (widget.brandId != null) {
      final variants = catalog.variantsByBrand(widget.brandId!);
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.surface,
          title: Text(widget.title ?? 'Brand products'),
        ),
        body: catalog.isLoading && variants.isEmpty
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : variants.isEmpty
                ? const Center(child: Text('No products found'))
                : ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.space4),
                    itemCount: variants.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.space3),
                    itemBuilder: (context, index) {
                      return _VariantTile(variant: variants[index]);
                    },
                  ),
      );
    }

    final products = catalog.filterCatalogProducts(
      source: _baseProducts(catalog),
      subCategoryId: _filter.subCategoryId,
      brandId: _filter.brandId,
      size: _filter.size,
      material: _filter.material,
      sort: _filter.sort,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Text(widget.title ?? 'Products'),
        actions: [
          IconButton(
            onPressed: () => Navigator.of(context).pushNamed(
              AppRoutes.search,
              arguments: const SearchArgs(),
            ),
            icon: const Icon(Icons.search_rounded),
          ),
          IconButton(
            onPressed: () => Navigator.of(context).pushNamed(AppRoutes.cart),
            icon: const Icon(Icons.shopping_cart_outlined),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openFilters(catalog),
        icon: const Icon(Icons.tune_rounded),
        label: Text(
          _filter.hasActiveFilters ? 'Filter · On' : 'Filter / Sort',
        ),
      ),
      body: catalog.isLoading && products.isEmpty
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : products.isEmpty
              ? const Center(child: Text('No products found'))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.space4,
                    AppSpacing.space4,
                    AppSpacing.space4,
                    AppSpacing.space16,
                  ),
                  itemCount: products.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.space3),
                  itemBuilder: (context, index) {
                    final product = products[index];
                    final variants = catalog.variantsForProduct(product.id);
                    final from = catalog.cheapestVariantFor(product.id);
                    final brandName = from?.brandName ?? product.subCategoryName;
                    final inStock = from?.inStock ?? true;

                    return Material(
                      color: AppColors.surface,
                      borderRadius: AppRadius.lgAll,
                      child: InkWell(
                        borderRadius: AppRadius.lgAll,
                        onTap: () {
                          Navigator.of(context).pushNamed(
                            AppRoutes.productDetail,
                            arguments: ProductDetailArgs(
                              productId: from?.productId ?? product.id,
                              variantId: from?.id,
                            ),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.space3),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  CategoryImage(
                                    imageAsset: product.imageAsset,
                                    imageUrl: product.imageUrl,
                                    fallbackIcon: product.icon,
                                    fallbackIconColor: AppColors.primary,
                                    fallbackBackground:
                                        AppColors.surfaceContainer,
                                    width: AppSpacing.space12,
                                    height: AppSpacing.space12,
                                    borderRadius: AppRadius.mdAll,
                                    fit: BoxFit.cover,
                                  ),
                                  const SizedBox(width: AppSpacing.space3),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          brandName,
                                          style: theme.textTheme.labelMedium
                                              ?.copyWith(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        Text(
                                          product.name,
                                          style: theme.textTheme.titleSmall,
                                        ),
                                        Text(
                                          product.specSummary,
                                          style: theme.textTheme.bodySmall,
                                        ),
                                        const SizedBox(
                                            height: AppSpacing.space1),
                                        Text(
                                          '${variants.length} variant(s)',
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(
                                                  color: AppColors.outline),
                                        ),
                                        const SizedBox(
                                            height: AppSpacing.space2),
                                        Text(
                                          from == null
                                              ? product.priceWithUnit
                                              : 'From ${from.priceWithUnit}',
                                          style: theme.textTheme.titleSmall
                                              ?.copyWith(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        const SizedBox(
                                            height: AppSpacing.space1),
                                        StockStatusChip(inStock: inStock),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.space3),
                              ProductActionBar(product: product, compact: true),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull {
    final it = iterator;
    if (!it.moveNext()) return null;
    return it.current;
  }
}

class _VariantTile extends StatelessWidget {
  const _VariantTile({required this.variant});

  final ProductVariant variant;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.lgAll,
      child: InkWell(
        borderRadius: AppRadius.lgAll,
        onTap: () {
          Navigator.of(context).pushNamed(
            AppRoutes.productDetail,
            arguments: ProductDetailArgs(
              productId: variant.productId,
              variantId: variant.id,
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.space3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CategoryImage(
                    imageAsset: variant.imageAsset,
                    imageUrl: variant.imageUrl,
                    fallbackIcon: variant.icon,
                    fallbackIconColor: AppColors.primary,
                    fallbackBackground: AppColors.surfaceContainer,
                    width: AppSpacing.space12,
                    height: AppSpacing.space12,
                    borderRadius: AppRadius.mdAll,
                    fit: BoxFit.cover,
                  ),
                  const SizedBox(width: AppSpacing.space3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          variant.brandName,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          variant.productName,
                          style: theme.textTheme.titleSmall,
                        ),
                        Text(
                          variant.specSummary,
                          style: theme.textTheme.bodySmall,
                        ),
                        const SizedBox(height: AppSpacing.space2),
                        Row(
                          children: [
                            Text(
                              variant.priceWithUnit,
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.space2),
                            StockStatusChip(inStock: variant.inStock),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.space3),
              VariantActionBar(variant: variant, compact: true),
            ],
          ),
        ),
      ),
    );
  }
}
