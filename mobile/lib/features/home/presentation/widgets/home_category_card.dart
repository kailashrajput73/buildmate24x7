import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/category_image.dart';
import '../../domain/models/home_models.dart';
import 'home_section_header.dart';

class CategoriesSection extends StatelessWidget {
  const CategoriesSection({
    super.key,
    required this.categories,
    this.onViewAll,
    this.onCategoryTap,
  });

  final List<HomeCategory> categories;
  final VoidCallback? onViewAll;
  final void Function(HomeCategory category)? onCategoryTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HomeSectionHeader(title: 'Shop by Categories', onViewAll: onViewAll),
        const SizedBox(height: AppSpacing.space3),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            mainAxisSpacing: AppSpacing.space3,
            crossAxisSpacing: AppSpacing.space3,
            childAspectRatio: 0.68,
          ),
          itemCount: categories.length,
          itemBuilder: (context, index) {
            final category = categories[index];
            return HomeCategoryGridTile(
              category: category,
              onTap: () => onCategoryTap?.call(category),
            );
          },
        ),
      ],
    );
  }
}

/// Title-case API names (e.g. `PIPES & FITTING`) for consistent labels.
String formatHomeCategoryLabel(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  return parts
      .map((part) {
        if (part.isEmpty || part == '&') return part;
        final lower = part.toLowerCase();
        return '${lower[0].toUpperCase()}${lower.substring(1)}';
      })
      .join(' ');
}

TextStyle homeCategoryLabelStyle() {
  return GoogleFonts.dmSans(
    fontSize: 10,
    fontWeight: FontWeight.w500,
    height: 1.2,
    letterSpacing: 0,
    color: AppColors.onSurface,
  );
}

/// Compact category tile for the home dashboard (4-column grid).
class HomeCategoryGridTile extends StatelessWidget {
  const HomeCategoryGridTile({
    super.key,
    required this.category,
    this.onTap,
  });

  final HomeCategory category;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final label = formatHomeCategoryLabel(category.name);

    return LayoutBuilder(
      builder: (context, constraints) {
        final side = constraints.maxWidth;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: side,
              height: side,
              child: Material(
                color: AppColors.surface,
                elevation: AppElevation.level1,
                shadowColor: AppColors.shadow,
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.mdAll,
                  side: const BorderSide(color: AppColors.divider),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: onTap,
                  child: CategoryImage(
                    imageAsset: category.imageAsset,
                    imageUrl: category.imageUrl,
                    fallbackIcon: category.icon,
                    fallbackIconColor: AppColors.outline,
                    fallbackBackground: AppColors.surfaceContainer,
                    width: side,
                    height: side,
                    borderRadius: AppRadius.mdAll,
                    fit: BoxFit.contain,
                    iconSize: AppSpacing.space5,
                    placeholder: true,
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.space2),
            Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: homeCategoryLabelStyle(),
            ),
          ],
        );
      },
    );
  }
}

class HomeCategoryCard extends StatelessWidget {
  const HomeCategoryCard({
    super.key,
    required this.category,
    this.onTap,
  });

  final HomeCategory category;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      elevation: AppElevation.level1,
      shadowColor: AppColors.shadow,
      borderRadius: AppRadius.lgAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: AppColors.divider),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CategoryImage(
                imageAsset: category.imageAsset,
                imageUrl: category.imageUrl,
                fallbackIcon: category.icon,
                fallbackIconColor: AppColors.outline,
                fallbackBackground: AppColors.surfaceContainer,
                height: 88,
                width: double.infinity,
                fit: BoxFit.cover,
                iconSize: AppSpacing.space6,
                placeholder: true,
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.space3),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      category.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: AppColors.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space1),
                    Text(
                      '${category.itemCount} products',
                      style: AppTypography.caption(color: AppColors.outline),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
