import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/brand_logo.dart';
import '../../domain/models/home_models.dart';
import 'home_section_header.dart';

class PopularBrandsSection extends StatelessWidget {
  const PopularBrandsSection({
    super.key,
    required this.brands,
    this.onViewAll,
    this.onBrandTap,
  });

  final List<HomeBrand> brands;
  final VoidCallback? onViewAll;
  final void Function(HomeBrand brand)? onBrandTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
          child: HomeSectionHeader(
            title: 'Popular Brands',
            onViewAll: onViewAll,
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        SizedBox(
          height: 140,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
            itemCount: brands.length,
            separatorBuilder: (_, _) =>
                const SizedBox(width: AppSpacing.space3),
            itemBuilder: (context, index) {
              final brand = brands[index];
              return BrandCard(
                brand: brand,
                onTap: () => onBrandTap?.call(brand),
              );
            },
          ),
        ),
      ],
    );
  }
}

class BrandCard extends StatelessWidget {
  const BrandCard({super.key, required this.brand, this.onTap});

  final HomeBrand brand;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = Color(brand.color);

    return SizedBox(
      width: 112,
      height: 140,
      child: Material(
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
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                BrandLogo(
                  logoAsset: brand.logoAsset,
                  abbreviation: brand.abbreviation,
                  color: color,
                  size: AppSpacing.space10,
                ),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  brand.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: AppColors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  '${brand.productCount} products',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: AppTypography.caption(color: AppColors.outline),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
