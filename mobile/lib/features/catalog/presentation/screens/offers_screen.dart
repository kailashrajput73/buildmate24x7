import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/models/catalog_models.dart';

class OffersScreen extends StatelessWidget {
  const OffersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogController>();
    final offers = catalog.catalogOffers;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Current Offers'),
      ),
      body: catalog.isLoading && offers.isEmpty
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : offers.isEmpty
              ? const Center(
                  child: Text('No discounted products on the server right now'),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.space4),
                  itemCount: offers.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.space3),
                  itemBuilder: (context, index) {
                    final offer = offers[index];
                    return Material(
                      color: AppColors.surface,
                      elevation: AppElevation.level1,
                      shadowColor: AppColors.shadow,
                      borderRadius: AppRadius.lgAll,
                      child: InkWell(
                        borderRadius: AppRadius.lgAll,
                        onTap: () {
                          Navigator.of(context).pushNamed(
                            AppRoutes.offerDetail,
                            arguments: OfferDetailArgs(offerId: offer.id),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.space4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.space2,
                                  vertical: AppSpacing.space1,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.secondaryContainer,
                                  borderRadius: AppRadius.pillAll,
                                ),
                                child: Text(
                                  offer.discountText,
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelMedium
                                      ?.copyWith(
                                        color: AppColors.secondary,
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.space2),
                              Text(
                                offer.title,
                                style:
                                    Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: AppSpacing.space1),
                              Text(
                                offer.description,
                                style:
                                    Theme.of(context).textTheme.bodyMedium,
                              ),
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

class OfferDetailScreen extends StatelessWidget {
  const OfferDetailScreen({super.key, required this.offerId});

  final String offerId;

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogController>();
    final offer = catalog.offerById(offerId);
    if (offer == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Offer')),
        body: const Center(child: Text('Offer not found')),
      );
    }

    final products = offer.productIds
        .map(catalog.productById)
        .whereType<CatalogProduct>()
        .toList();
    final categoryId = offer.categoryId;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Text(offer.title),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.space4),
        children: [
          Text(
            offer.discountText,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: AppColors.secondary,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(offer.description, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: AppSpacing.space5),
          Text(
            'Eligible products',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.space3),
          ...products.map(
            (p) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(p.name),
              subtitle: Text(
                '${catalog.variantsForProduct(p.id).length} variant(s) · ${p.priceWithUnit}',
              ),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () {
                Navigator.of(context).pushNamed(
                  AppRoutes.productDetail,
                  arguments: ProductDetailArgs(
                    productId: p.id,
                    variantId: p.id,
                  ),
                );
              },
            ),
          ),
          if (categoryId != null) ...[
            const SizedBox(height: AppSpacing.space4),
            FilledButton(
              onPressed: () {
                Navigator.of(context).pushNamed(
                  AppRoutes.categoryBrowse,
                  arguments: CategoryBrowseArgs(categoryId: categoryId),
                );
              },
              child: const Text('Browse category'),
            ),
          ],
        ],
      ),
    );
  }
}
