import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/state/recently_viewed_controller.dart';
import '../../../../core/state/wishlist_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/catalog_widgets.dart';
import '../../../../shared/widgets/category_image.dart';
import '../../data/mappers/catalog_api_mapper.dart';
import '../../domain/models/catalog_models.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({
    super.key,
    required this.productId,
    this.initialVariantId,
  });

  final String productId;
  final String? initialVariantId;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _qty = 1;
  String? _selectedVariantId;
  bool _recorded = false;
  String? _systemSizeFilter;

  @override
  void initState() {
    super.initState();
    _selectedVariantId = widget.initialVariantId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final catalog = context.read<CatalogController>();
      if (catalog.pipeVariants.isEmpty) {
        catalog.refreshHomeCatalog(showLoading: false);
      }
    });
  }

  List<ProductVariant> _resolveVariants(CatalogController catalog) {
    final byProduct = catalog.variantsForProduct(widget.productId);
    if (byProduct.isNotEmpty) return byProduct;

    final initialId = widget.initialVariantId;
    if (initialId != null) {
      final byId = catalog.variantById(initialId);
      if (byId != null) {
        final group = catalog.variantsForProduct(byId.productId);
        return group.isNotEmpty ? group : [byId];
      }
    }
    return const [];
  }

  CatalogProduct? _resolveProduct(
    CatalogController catalog,
    List<ProductVariant> variants,
  ) {
    if (variants.isEmpty) return null;
    ProductVariant? preferred;
    if (_selectedVariantId != null) {
      for (final v in variants) {
        if (v.id == _selectedVariantId) {
          preferred = v;
          break;
        }
      }
    }
    return CatalogApiMapper.productFromVariant(preferred ?? variants.first);
  }

  ProductVariant? _selectedFrom(List<ProductVariant> variants) {
    if (variants.isEmpty) return null;
    if (_selectedVariantId != null) {
      for (final v in variants) {
        if (v.id == _selectedVariantId) return v;
      }
    }
    // Live API products are often single-variant — auto-select.
    if (variants.length == 1) return variants.first;
    return null;
  }

  void _recordView(ProductVariant variant) {
    if (_recorded) return;
    _recorded = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<RecentlyViewedController>().add(variant);
    });
  }

  Future<void> _openSystemFilter(
    CatalogController catalog,
    CatalogProduct product,
  ) async {
    final sizes = catalog.sizeOptionsForCategory(product.categoryId);
    if (sizes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No size filters available for this category'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final selected = await showModalBottomSheet<String?>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (context) {
        final maxHeight = MediaQuery.of(context).size.height * 0.55;
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxHeight),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.space4,
                    AppSpacing.space4,
                    AppSpacing.space4,
                    AppSpacing.space2,
                  ),
                  child: Text(
                    'Filter System (Size)',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const Divider(height: 1),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      ListTile(
                        title: const Text('All sizes'),
                        trailing: _systemSizeFilter == null
                            ? const Icon(
                                Icons.check_rounded,
                                color: AppColors.primary,
                              )
                            : null,
                        onTap: () => Navigator.pop(context, ''),
                      ),
                      for (final size in sizes)
                        ListTile(
                          title: Text(size),
                          trailing: _systemSizeFilter == size
                              ? const Icon(
                                  Icons.check_rounded,
                                  color: AppColors.primary,
                                )
                              : null,
                          onTap: () => Navigator.pop(context, size),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (!mounted || selected == null) return;
    setState(() {
      _systemSizeFilter = selected.isEmpty ? null : selected;
    });
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogController>();
    final variants = _resolveVariants(catalog);
    final product = _resolveProduct(catalog, variants);

    if (product == null || variants.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Product')),
        body: Center(
          child: Text(
            catalog.isLoading || catalog.isHomeLoading
                ? 'Loading product…'
                : 'Product not found',
          ),
        ),
      );
    }

    final selected = _selectedFrom(variants);
    if (selected != null) _recordView(selected);
    final theme = Theme.of(context);
    final wishlist = context.watch<WishlistController>();
    final cart = context.watch<CartController>();
    final compatible = catalog.compatibleProductsFor(
      product,
      sizeFilter: _systemSizeFilter,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (selected != null)
            IconButton(
              onPressed: () => wishlist.toggle(selected),
              icon: Icon(
                wishlist.contains(selected.id)
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                color: wishlist.contains(selected.id) ? AppColors.error : null,
              ),
            ),
          IconButton(
            onPressed: () => Navigator.of(context).pushNamed(AppRoutes.cart),
            icon: Badge(
              isLabelVisible: cart.totalQuantity > 0,
              label: Text('${cart.totalQuantity}'),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.space4),
        children: [
          CategoryImage(
            imageAsset: product.imageAsset,
            imageUrl: selected?.imageUrl ?? product.imageUrl,
            fallbackIcon: product.icon,
            fallbackIconColor: AppColors.primary,
            fallbackBackground: AppColors.surfaceContainer,
            height: 180,
            width: double.infinity,
            borderRadius: AppRadius.lgAll,
            fit: BoxFit.cover,
            iconSize: 64,
          ),
          const SizedBox(height: AppSpacing.space4),
          Text(
            product.categoryName,
            style: theme.textTheme.labelMedium?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(product.name, style: theme.textTheme.headlineSmall),
          Text(
            '${product.subCategoryName} · SKU ${product.sku}',
            style: theme.textTheme.bodySmall?.copyWith(color: AppColors.outline),
          ),
          if (product.specSummary.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space2),
            Text(product.specSummary, style: theme.textTheme.bodyMedium),
          ],
          const SizedBox(height: AppSpacing.space4),
          Text('Select brand', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.space2),
          ...variants.map((v) {
            final isSelected = selected?.id == v.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.space2),
              child: Material(
                color: isSelected
                    ? AppColors.primaryContainer
                    : AppColors.surface,
                borderRadius: AppRadius.lgAll,
                child: InkWell(
                  borderRadius: AppRadius.lgAll,
                  onTap: () {
                    setState(() {
                      _selectedVariantId = v.id;
                      _qty = v.minimumOrderQuantity;
                      _recorded = false;
                    });
                    _recordView(v);
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.space3),
                    child: Row(
                      children: [
                        Icon(
                          isSelected
                              ? Icons.radio_button_checked
                              : Icons.radio_button_off,
                          color: AppColors.primary,
                          size: 20,
                        ),
                        const SizedBox(width: AppSpacing.space3),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(v.brandName, style: theme.textTheme.titleSmall),
                              Text(
                                v.specSummary,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              v.priceWithUnit,
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            StockStatusChip(inStock: v.inStock),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
          if (selected == null) ...[
            const SizedBox(height: AppSpacing.space3),
            Text(
              'Choose a brand to view details, set quantity, and add to cart.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.outline,
              ),
            ),
          ] else ...[
            const SizedBox(height: AppSpacing.space4),
            Row(
              children: [
                ...List.generate(5, (i) {
                  final filled = i < selected.rating.round();
                  return Icon(
                    Icons.star_rounded,
                    size: 18,
                    color: filled
                        ? AppColors.secondary
                        : AppColors.outlineVariant,
                  );
                }),
                const SizedBox(width: AppSpacing.space2),
                Text(
                  '${selected.rating} (${selected.reviewCount})',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space3),
            Text(
              selected.priceWithUnit,
              style: theme.textTheme.headlineSmall?.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.space2),
            Text(selected.description, style: theme.textTheme.bodyMedium),
            const SizedBox(height: AppSpacing.space4),
            Text('Specifications', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.space2),
            ...selected.specifications.entries.map(
              (e) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.space1),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 110,
                      child: Text(
                        e.key,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.outline,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(e.value, style: theme.textTheme.bodyMedium),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.space4),
            Text(
              'Minimum order: ${selected.minimumOrderQuantity} ${selected.unit}',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.space3),
            Row(
              children: [
                Text('Quantity', style: theme.textTheme.titleSmall),
                const Spacer(),
                IconButton(
                  onPressed: _qty > selected.minimumOrderQuantity
                      ? () => setState(() => _qty--)
                      : null,
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('$_qty', style: theme.textTheme.titleMedium),
                IconButton(
                  onPressed: selected.inStock
                      ? () => setState(() => _qty++)
                      : null,
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space4),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: selected.inStock
                        ? () {
                            cart.addVariant(selected, quantity: _qty);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  '${selected.displayName} added to cart',
                                ),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        : null,
                    child: const Text('Add to Cart'),
                  ),
                ),
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      if (selected.inStock &&
                          cart.quantityOf(selected.id) == 0) {
                        cart.addVariant(selected, quantity: _qty);
                      }
                      Navigator.of(context).pushNamed(AppRoutes.cart);
                    },
                    child: const Text('Get Quote'),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.space6),
          Row(
            children: [
              Expanded(
                child: Text('Complete System', style: theme.textTheme.titleMedium),
              ),
              TextButton.icon(
                onPressed: () => _openSystemFilter(catalog, product),
                icon: const Icon(Icons.tune_rounded, size: 18),
                label: Text(
                  _systemSizeFilter == null
                      ? 'Filter System'
                      : _systemSizeFilter!,
                ),
              ),
            ],
          ),
          Text(
            'Compatible products for building a complete system. The main product above stays unchanged.',
            style: theme.textTheme.bodySmall?.copyWith(color: AppColors.outline),
          ),
          const SizedBox(height: AppSpacing.space3),
          if (compatible.isEmpty)
            Text(
              'No compatible products found for this filter.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.outline,
              ),
            )
          else
            ...compatible.take(12).map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.space2),
                    child: _CompatibleProductTile(
                      product: item,
                      onOpen: () {
                        Navigator.of(context).pushNamed(
                          AppRoutes.productDetail,
                          arguments: ProductDetailArgs(productId: item.id),
                        );
                      },
                    ),
                  ),
                ),
          const SizedBox(height: AppSpacing.space8),
        ],
      ),
    );
  }
}

class _CompatibleProductTile extends StatelessWidget {
  const _CompatibleProductTile({
    required this.product,
    required this.onOpen,
  });

  final CatalogProduct product;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final catalog = context.watch<CatalogController>();
    final from = catalog.cheapestVariantFor(product.id);
    final brandName = from?.brandName ?? product.subCategoryName;

    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.lgAll,
      child: InkWell(
        borderRadius: AppRadius.lgAll,
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.space3),
          child: Row(
            children: [
              CategoryImage(
                imageAsset: product.imageAsset,
                fallbackIcon: product.icon,
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
                      brandName,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall,
                    ),
                    Text(
                      product.specifications['Size'] ?? product.specSummary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall,
                    ),
                    Text(
                      from?.priceWithUnit ?? product.priceWithUnit,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              OutlinedButton(
                onPressed: () async {
                  final variant =
                      await showBrandPicker(context, product: product);
                  if (variant == null || !context.mounted) return;
                  if (!variant.inStock) return;
                  context.read<CartController>().addVariant(variant);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('${variant.displayName} added to cart'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  minimumSize: const Size(0, AppSpacing.space8),
                ),
                child: const Text('Add'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
