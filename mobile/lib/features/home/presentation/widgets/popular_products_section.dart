import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/state/cart_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/catalog_widgets.dart';
import '../../../../shared/widgets/category_image.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import 'home_section_header.dart';

class PopularProductsSection extends StatelessWidget {
  const PopularProductsSection({
    super.key,
    required this.variants,
    this.onViewAll,
    this.onVariantTap,
    this.isLoading = false,
  });

  final List<ProductVariant> variants;
  final VoidCallback? onViewAll;
  final void Function(ProductVariant variant)? onVariantTap;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final visible = variants.take(6).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        HomeSectionHeader(title: 'Popular Products', onViewAll: onViewAll),
        const SizedBox(height: AppSpacing.space3),
        if (isLoading && visible.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.space6),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (visible.isEmpty)
          const Text(
            'No popular products from server yet.',
            style: TextStyle(color: AppColors.onSurfaceVariant),
          )
        else
          for (var i = 0; i < visible.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space3),
            PopularProductCard(
              variant: visible[i],
              onTap: () => onVariantTap?.call(visible[i]),
            ),
          ],
      ],
    );
  }
}

class PopularProductCard extends StatelessWidget {
  const PopularProductCard({
    super.key,
    required this.variant,
    this.onTap,
  });

  final ProductVariant variant;
  final VoidCallback? onTap;

  void _addToCart(BuildContext context) {
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      elevation: AppElevation.level1,
      shadowColor: AppColors.shadow,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: const BorderSide(color: AppColors.divider),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.space3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CategoryImage(
                    imageAsset: '',
                    imageUrl: variant.imageUrl,
                    fallbackIcon: variant.icon,
                    fallbackIconColor: AppColors.primary,
                    fallbackBackground: AppColors.surfaceContainer,
                    width: AppSpacing.space14,
                    height: AppSpacing.space14,
                    borderRadius: AppRadius.mdAll,
                    fit: BoxFit.cover,
                    iconSize: AppSpacing.space6,
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
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall,
                        ),
                        Text(
                          variant.specSummary.isNotEmpty
                              ? variant.specSummary
                              : (variant.pipeType ?? ''),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall,
                        ),
                        const SizedBox(height: AppSpacing.space2),
                        Text(
                          '${variant.priceLabel} / ${variant.unit}',
                          style: theme.textTheme.titleSmall?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.space1),
                        StockStatusChip(inStock: variant.inStock),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.space3),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: variant.inStock ? () => _addToCart(context) : null,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 40),
                  ),
                  child: const Text('Add to cart'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
