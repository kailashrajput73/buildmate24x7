import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/category_image.dart';
import 'product_list_screen.dart';

/// Generic category browse — lists live products for a backend category id.
class CategoryBrowseScreen extends StatelessWidget {
  const CategoryBrowseScreen({super.key, required this.categoryId});

  final String categoryId;

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogController>();
    final category = catalog.categoryById(categoryId);
    return ProductListScreen(
      categoryId: categoryId,
      title: category?.name ?? 'Category',
    );
  }
}

/// Categories tab in [MainShell].
class CategoriesTabBody extends StatelessWidget {
  const CategoriesTabBody({super.key});

  @override
  Widget build(BuildContext context) {
    return const CategoriesGrid();
  }
}

class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Categories'),
      ),
      body: const CategoriesGrid(),
    );
  }
}

class CategoriesGrid extends StatelessWidget {
  const CategoriesGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogController>();
    final categories = catalog.homeCategories;

    if (catalog.isHomeLoading && categories.isEmpty) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    if (categories.isEmpty) {
      return Center(
        child: Text(
          catalog.error ?? 'No categories from server',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(AppSpacing.space4),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.space3,
        crossAxisSpacing: AppSpacing.space3,
        childAspectRatio: 0.92,
      ),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final category = categories[index];
        return Material(
          color: AppColors.surface,
          elevation: AppElevation.level1,
          shadowColor: AppColors.shadow,
          borderRadius: AppRadius.lgAll,
          child: InkWell(
            borderRadius: AppRadius.lgAll,
            onTap: () {
              Navigator.of(context).pushNamed(
                AppRoutes.categoryBrowse,
                arguments: CategoryBrowseArgs(
                  categoryId: category.id,
                  categoryName: category.name,
                ),
              );
            },
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.space3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: CategoryImage(
                      imageAsset: category.imageAsset,
                      imageUrl: category.imageUrl,
                      fallbackIcon: category.icon,
                      fallbackIconColor: Color(category.iconColor),
                      fallbackBackground: Color(category.iconBackground),
                      width: double.infinity,
                      borderRadius: AppRadius.mdAll,
                      fit: BoxFit.cover,
                      iconSize: AppSpacing.space6,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  Text(
                    category.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  Text(
                    '${category.itemCount} products',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
