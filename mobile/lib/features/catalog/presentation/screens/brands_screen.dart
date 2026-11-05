import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/brand_logo.dart';
import 'product_list_screen.dart';

class BrandsScreen extends StatelessWidget {
  const BrandsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogController>();
    final brands = catalog.catalogBrands;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Top Brands'),
      ),
      body: catalog.isLoading && brands.isEmpty
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : brands.isEmpty
              ? const Center(child: Text('No brands from server yet'))
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.space4),
                  itemCount: brands.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.space3),
                  itemBuilder: (context, index) {
                    final brand = brands[index];
                    final color = Color(brand.color);
                    return Material(
                      color: AppColors.surface,
                      elevation: AppElevation.level1,
                      shadowColor: AppColors.shadow,
                      borderRadius: AppRadius.lgAll,
                      child: ListTile(
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadius.lgAll,
                        ),
                        leading: BrandLogo(
                          logoAsset: brand.logoAsset,
                          abbreviation: brand.abbreviation,
                          color: color,
                          size: 44,
                        ),
                        title: Text(brand.name),
                        subtitle: Text('${brand.productCount} products'),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () {
                          Navigator.of(context).pushNamed(
                            AppRoutes.brandProducts,
                            arguments: BrandProductsArgs(brandId: brand.id),
                          );
                        },
                      ),
                    );
                  },
                ),
    );
  }
}

class BrandProductsScreen extends StatelessWidget {
  const BrandProductsScreen({super.key, required this.brandId});

  final String brandId;

  @override
  Widget build(BuildContext context) {
    final brand = context.watch<CatalogController>().brandById(brandId);
    return ProductListScreen(
      brandId: brandId,
      title: brand?.name ?? 'Brand Products',
    );
  }
}
