import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/wishlist_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/catalog_widgets.dart';

class WishlistScreenBody extends StatelessWidget {
  const WishlistScreenBody({super.key});

  @override
  Widget build(BuildContext context) {
    final wishlist = context.watch<WishlistController>();
    final theme = Theme.of(context);

    if (wishlist.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.space6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.favorite_border_rounded,
                size: 48,
                color: AppColors.outline,
              ),
              const SizedBox(height: AppSpacing.space4),
              Text('No saved products', style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.space2),
              Text(
                'Tap the heart on any product to save it here.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.space4),
      itemCount: wishlist.items.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.space3),
      itemBuilder: (context, index) {
        final variant = wishlist.items[index];
        return Material(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
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
                  Text(
                    variant.brandName,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(variant.productName, style: theme.textTheme.titleSmall),
                  Text(variant.priceWithUnit, style: theme.textTheme.bodySmall),
                  const SizedBox(height: AppSpacing.space2),
                  VariantActionBar(variant: variant, compact: true),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
