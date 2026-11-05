import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/category_image.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import 'home_section_header.dart';

class RecentlyViewedSection extends StatelessWidget {
  const RecentlyViewedSection({
    super.key,
    required this.products,
    this.onViewAll,
    this.onTap,
  });

  final List<ProductVariant> products;
  final VoidCallback? onViewAll;
  final void Function(ProductVariant product)? onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
          child: HomeSectionHeader(
            title: 'Recently Viewed',
            onViewAll: products.isEmpty ? null : onViewAll,
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        if (products.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
            child: Material(
              color: AppColors.surface,
              borderRadius: AppRadius.lgAll,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.space4),
                child: Text(
                  'No recently viewed products yet. Browse the catalogue to see them here.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.outline,
                      ),
                ),
              ),
            ),
          )
        else
          SizedBox(
            height: AppSpacing.space16 * 2,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
              itemCount: products.length,
              separatorBuilder: (_, _) =>
                  const SizedBox(width: AppSpacing.space3),
              itemBuilder: (context, index) {
                final product = products[index];
                return RecentlyViewedCard(
                  product: product,
                  onTap: () => onTap?.call(product),
                );
              },
            ),
          ),
      ],
    );
  }
}

class RecentlyViewedCard extends StatelessWidget {
  const RecentlyViewedCard({super.key, required this.product, this.onTap});

  final ProductVariant product;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      elevation: AppElevation.level1,
      shadowColor: AppColors.shadow,
      borderRadius: AppRadius.lgAll,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Container(
          width: 132,
          padding: const EdgeInsets.all(AppSpacing.space3),
          decoration: BoxDecoration(
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: AppColors.divider),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              CategoryImage(
                imageAsset: product.imageAsset,
                fallbackIcon: product.icon,
                fallbackIconColor: AppColors.primary,
                fallbackBackground: AppColors.surfaceContainer,
                height: AppSpacing.space10,
                width: double.infinity,
                borderRadius: AppRadius.mdAll,
                fit: BoxFit.cover,
                iconSize: AppSpacing.space5,
              ),
              const SizedBox(height: AppSpacing.space2),
              Text(
                product.productName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                product.brandName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption(color: AppColors.outline),
              ),
              Text(
                product.priceLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption(color: AppColors.primary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
