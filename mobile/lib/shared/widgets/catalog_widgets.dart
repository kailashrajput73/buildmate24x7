import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/routes/app_routes.dart';
import '../../core/state/cart_controller.dart';
import '../../core/state/wishlist_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../core/state/catalog_controller.dart';
import '../../features/catalog/domain/models/catalog_models.dart';

/// Compact stock status chip used across catalog UIs.
class StockStatusChip extends StatelessWidget {
  const StockStatusChip({super.key, this.inStock, this.status})
    : assert(inStock != null || status != null);

  final bool? inStock;
  final StockStatus? status;

  StockStatus get _resolved {
    if (status != null) return status!;
    return inStock == true ? StockStatus.inStock : StockStatus.outOfStock;
  }

  @override
  Widget build(BuildContext context) {
    final resolved = _resolved;
    final label = switch (resolved) {
      StockStatus.inStock => 'In Stock',
      StockStatus.limited => 'Limited Stock',
      StockStatus.outOfStock => 'Out of Stock',
    };
    final color = switch (resolved) {
      StockStatus.inStock => AppColors.success,
      StockStatus.limited => AppColors.warning,
      StockStatus.outOfStock => AppColors.error,
    };
    final background = switch (resolved) {
      StockStatus.inStock => AppColors.successContainer,
      StockStatus.limited => AppColors.warningContainer,
      StockStatus.outOfStock => AppColors.errorContainer,
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space2,
        vertical: AppSpacing.space1,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(label, style: AppTypography.labelSmallMono(color: color)),
    );
  }
}

/// Opens brand selection when a base product has multiple variants.
Future<ProductVariant?> showBrandPicker(
  BuildContext context, {
  required CatalogProduct product,
}) {
  final variants = context.read<CatalogController>().variantsForProduct(product.id);
  if (variants.isEmpty) return Future.value(null);
  if (variants.length == 1) return Future.value(variants.first);

  return showModalBottomSheet<ProductVariant>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (context) {
      final media = MediaQuery.of(context);
      // Keep sheet within available space above bottom nav / safe insets.
      final maxHeight = (media.size.height * 0.45).clamp(220.0, 420.0);

      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.space4,
            AppSpacing.space4,
            AppSpacing.space4,
            AppSpacing.space3,
          ),
          child: SizedBox(
            height: maxHeight,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Select brand',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.outline),
                ),
                const SizedBox(height: AppSpacing.space3),
                Expanded(
                  child: ListView.separated(
                    itemCount: variants.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final v = variants[index];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(v.brandName),
                        subtitle: Text(v.priceWithUnit),
                        trailing: StockStatusChip(inStock: v.inStock),
                        onTap: () => Navigator.of(context).pop(v),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class ProductActionBar extends StatelessWidget {
  const ProductActionBar({
    super.key,
    required this.product,
    this.compact = false,
    this.showQuote = true,
  });

  final CatalogProduct product;
  final bool compact;
  final bool showQuote;

  Future<void> _addToCart(BuildContext context) async {
    final variant = await showBrandPicker(context, product: product);
    if (variant == null || !context.mounted) return;
    if (!variant.inStock) return;
    context.read<CartController>().addVariant(variant);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${variant.displayName} added to cart'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _getQuote(BuildContext context) async {
    final cart = context.read<CartController>();
    final variant = await showBrandPicker(context, product: product);
    if (variant == null || !context.mounted) return;
    if (variant.inStock && cart.quantityOf(variant.id) == 0) {
      cart.addVariant(variant);
    }
    Navigator.of(context).pushNamed(AppRoutes.cart);
  }

  Future<void> _toggleWishlist(BuildContext context) async {
    final wishlist = context.read<WishlistController>();
    final variant = await showBrandPicker(context, product: product);
    if (variant == null || !context.mounted) return;
    wishlist.toggle(variant);
  }

  @override
  Widget build(BuildContext context) {
    final wishlist = context.watch<WishlistController>();
    final inWishlist = wishlist.containsProduct(product.id);

    if (compact) {
      return Row(
        children: [
          IconButton(
            tooltip: 'Wishlist',
            onPressed: () => _toggleWishlist(context),
            style: IconButton.styleFrom(
              minimumSize: const Size(AppSpacing.space8, AppSpacing.space8),
              maximumSize: const Size(AppSpacing.space8, AppSpacing.space8),
              padding: EdgeInsets.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
            ),
            icon: Icon(
              inWishlist
                  ? Icons.favorite_rounded
                  : Icons.favorite_border_rounded,
              color: inWishlist ? AppColors.error : AppColors.onSurfaceVariant,
              size: 20,
            ),
          ),
          const SizedBox(width: AppSpacing.space1),
          Expanded(
            child: OutlinedButton(
              onPressed: () => _addToCart(context),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, AppSpacing.space8),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.space2,
                ),
                visualDensity: VisualDensity.compact,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Add to Cart'),
            ),
          ),
          if (showQuote) ...[
            const SizedBox(width: AppSpacing.space1),
            IconButton.filled(
              tooltip: 'Get Quote',
              onPressed: () => _getQuote(context),
              style: IconButton.styleFrom(
                minimumSize: const Size(AppSpacing.space8, AppSpacing.space8),
                maximumSize: const Size(AppSpacing.space8, AppSpacing.space8),
                padding: EdgeInsets.zero,
              ),
              icon: const Icon(Icons.request_quote_rounded, size: 18),
            ),
          ],
        ],
      );
    }

    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        IconButton(
          tooltip: 'Wishlist',
          onPressed: () => _toggleWishlist(context),
          visualDensity: VisualDensity.compact,
          icon: Icon(
            inWishlist ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            color: inWishlist ? AppColors.error : AppColors.onSurfaceVariant,
            size: 20,
          ),
        ),
        OutlinedButton(
          onPressed: () => _addToCart(context),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, AppSpacing.space10),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space3),
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('Add to Cart'),
        ),
        if (showQuote)
          FilledButton(
            onPressed: () => _getQuote(context),
            style: FilledButton.styleFrom(
              minimumSize: const Size(0, AppSpacing.space10),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space3,
              ),
              visualDensity: VisualDensity.compact,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Get Quote'),
          ),
      ],
    );
  }
}

class VariantActionBar extends StatelessWidget {
  const VariantActionBar({
    super.key,
    required this.variant,
    this.compact = false,
  });

  final ProductVariant variant;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final wishlist = context.watch<WishlistController>();
    final inWishlist = wishlist.contains(variant.id);
    final qty = cart.quantityOf(variant.id);

    return Row(
      children: [
        IconButton(
          onPressed: () => wishlist.toggle(variant),
          style: IconButton.styleFrom(
            minimumSize: const Size(AppSpacing.space8, AppSpacing.space8),
            maximumSize: const Size(AppSpacing.space8, AppSpacing.space8),
            padding: EdgeInsets.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            visualDensity: VisualDensity.compact,
          ),
          icon: Icon(
            inWishlist ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            color: inWishlist ? AppColors.error : AppColors.onSurfaceVariant,
            size: 20,
          ),
        ),
        const SizedBox(width: AppSpacing.space1),
        if (qty > 0) ...[
          _QtyBtn(
            icon: Icons.remove_rounded,
            onTap: () => cart.decrease(variant.id),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space1),
            child: Text('$qty', style: Theme.of(context).textTheme.labelLarge),
          ),
          _QtyBtn(
            icon: Icons.add_rounded,
            onTap: variant.inStock ? () => cart.increase(variant.id) : null,
          ),
        ] else
          Expanded(
            child: OutlinedButton(
              onPressed: variant.inStock
                  ? () {
                      cart.addVariant(variant);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${variant.displayName} added to cart'),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  : null,
              style: OutlinedButton.styleFrom(
                minimumSize: Size(
                  0,
                  compact ? AppSpacing.space8 : AppSpacing.space10,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.space2,
                ),
                visualDensity: VisualDensity.compact,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Add to Cart'),
            ),
          ),
        const SizedBox(width: AppSpacing.space1),
        IconButton.filled(
          onPressed: () {
            if (qty == 0 && variant.inStock) {
              cart.addVariant(variant);
            }
            Navigator.of(context).pushNamed(AppRoutes.cart);
          },
          style: IconButton.styleFrom(
            minimumSize: const Size(AppSpacing.space8, AppSpacing.space8),
            maximumSize: const Size(AppSpacing.space8, AppSpacing.space8),
            padding: EdgeInsets.zero,
          ),
          icon: const Icon(Icons.request_quote_rounded, size: 18),
        ),
      ],
    );
  }
}

class _QtyBtn extends StatelessWidget {
  const _QtyBtn({required this.icon, this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primaryContainer,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: AppSpacing.space8,
          height: AppSpacing.space8,
          child: Icon(icon, size: 16, color: AppColors.primary),
        ),
      ),
    );
  }
}
