import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/location/device_location.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/state/location_controller.dart';
import '../../../../core/state/recently_viewed_controller.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../data/mock/home_mock_data.dart';
import '../widgets/current_offers_section.dart';
import '../widgets/featured_banner_carousel.dart';
import '../widgets/featured_products_section.dart';
import '../widgets/home_app_bar.dart';
import '../widgets/home_category_card.dart';
import '../widgets/home_dashboard_categories.dart';
import '../widgets/home_location_bar.dart';
import '../widgets/home_search_bar.dart';
import '../widgets/popular_brands_section.dart';
import '../widgets/popular_products_section.dart';
import '../widgets/quick_action_card.dart';
import '../widgets/recently_viewed_section.dart';
import '../../domain/models/home_models.dart' as legacy;

/// Home tab content for [MainShell].
class HomeDashboardScreen extends StatefulWidget {
  const HomeDashboardScreen({super.key});

  @override
  State<HomeDashboardScreen> createState() => _HomeDashboardScreenState();
}

class _HomeDashboardScreenState extends State<HomeDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final location = context.read<LocationController>();
      if (!location.hasFix && !location.isLoading) {
        location.fetchCurrentLocation();
      }
      final catalog = context.read<CatalogController>();
      catalog.refreshHomeCatalog(
        showLoading: catalog.homeCategories.isEmpty &&
            catalog.pipeVariants.isEmpty,
      );
    });
  }

  void _open(String route, {Object? arguments}) {
    Navigator.of(context).pushNamed(route, arguments: arguments);
  }

  void _openVariant(ProductVariant variant) {
    _open(
      AppRoutes.productDetail,
      arguments: ProductDetailArgs(
        productId: variant.productId,
        variantId: variant.id,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<SessionController>().user;
    final recentlyViewed = context.watch<RecentlyViewedController>().items;
    final location = context.watch<LocationController>();
    final catalog = context.watch<CatalogController>();

    final categories =
        HomeDashboardCategories.forDashboard(catalog.homeCategories);

    final brands = catalog.catalogBrands
        .take(8)
        .map(
          (b) => legacy.HomeBrand(
            id: b.id,
            name: b.name,
            productCount: b.productCount,
            abbreviation: b.abbreviation,
            color: b.color,
            logoAsset: b.logoAsset,
          ),
        )
        .toList();

    final offers = catalog.catalogOffers
        .take(6)
        .map(
          (o) => legacy.HomeOffer(
            id: o.id,
            discountLabel: o.discountText,
            title: o.title,
            subtitle: o.description,
            endsOn: o.validUntil,
            ctaLabel: 'Explore',
            routeName: AppRoutes.offerDetail,
          ),
        )
        .toList();

    final featured = catalog.featuredVariants;
    final popular = catalog.popularVariants;
    final homeLoading = catalog.isHomeLoading;

    return ColoredBox(
      color: AppColors.background,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HomeAppBar(
            user: user,
            onRewards: () => _open(AppRoutes.myRewards),
            onNotifications: () => _open(AppRoutes.notifications),
            onProfile: () => _open(AppRoutes.profile),
            onCart: () => _open(AppRoutes.cart),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () =>
                  context.read<CatalogController>().refreshHomeCatalog(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.space4,
                        AppSpacing.space3,
                        AppSpacing.space4,
                        0,
                      ),
                      child: HomeLocationBar(
                        label: location.hasFix ? 'Home' : 'Location',
                        address: location.fullAddress,
                        isLoading: location.isLoading && !location.hasFix,
                        onTap: () {
                          if (!location.hasFix &&
                              location.error != null &&
                              !location.isLoading) {
                            location.fetchCurrentLocation();
                            return;
                          }
                          _open(
                            AppRoutes.chooseLocation,
                            arguments: SignupFlowArgs(
                              mobileNumber: user.phone ?? '',
                              fullName: user.name,
                              isLocationUpdate: true,
                            ),
                          );
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.space4,
                        AppSpacing.space3,
                        AppSpacing.space4,
                        0,
                      ),
                      child: HomeSearchBar(
                        onSearch: (query) => _open(
                          AppRoutes.search,
                          arguments: SearchArgs(initialQuery: query),
                        ),
                        onVoice: () => _open(AppRoutes.search),
                        onScan: () => _open(AppRoutes.search),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.space4,
                        AppSpacing.space3,
                        AppSpacing.space4,
                        0,
                      ),
                      child: FeaturedBannerCarousel(
                        banners: HomeMockData.banners,
                        onCta: (banner) => _open(banner.routeName),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space5),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.space4,
                      ),
                      child: homeLoading && categories.isEmpty
                          ? const SizedBox(
                              height: 120,
                              child: Center(
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : categories.isEmpty
                              ? const Text(
                                  'No categories from server yet.',
                                  style: TextStyle(
                                    color: AppColors.onSurfaceVariant,
                                  ),
                                )
                              : CategoriesSection(
                                  categories: categories,
                                  onCategoryTap: (category) {
                                    _open(
                                      AppRoutes.categoryBrowse,
                                      arguments: CategoryBrowseArgs(
                                        categoryId: category.id,
                                        categoryName: category.name,
                                      ),
                                    );
                                  },
                                ),
                    ),
                    const SizedBox(height: AppSpacing.space5),
                    const _SectionDivider(),
                    FeaturedProductsSection(
                      variants: featured,
                      isLoading: homeLoading,
                      onViewAll: () => _open(
                        AppRoutes.productList,
                        arguments: const ProductListArgs(
                          title: 'Featured Products',
                        ),
                      ),
                      onVariantTap: _openVariant,
                    ),
                    const SizedBox(height: AppSpacing.space5),
                    const _SectionDivider(),
                    PopularBrandsSection(
                      brands: brands,
                      onViewAll: () => _open(AppRoutes.brands),
                      onBrandTap: (brand) {
                        _open(
                          AppRoutes.brandProducts,
                          arguments: BrandProductsArgs(brandId: brand.id),
                        );
                      },
                    ),
                    const SizedBox(height: AppSpacing.space5),
                    const _SectionDivider(),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.space4,
                      ),
                      child: PopularProductsSection(
                        variants: popular,
                        isLoading: homeLoading,
                        onViewAll: () => _open(
                          AppRoutes.productList,
                          arguments: const ProductListArgs(
                            title: 'Popular Products',
                          ),
                        ),
                        onVariantTap: _openVariant,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space5),
                    const _SectionDivider(),
                    RecentlyViewedSection(
                      products: recentlyViewed,
                      onViewAll: recentlyViewed.isEmpty
                          ? null
                          : () => _open(
                                AppRoutes.productList,
                                arguments: const ProductListArgs(
                                  title: 'Recently Viewed',
                                ),
                              ),
                      onTap: _openVariant,
                    ),
                    const SizedBox(height: AppSpacing.space5),
                    const _SectionDivider(),
                    CurrentOffersSection(
                      offers: offers,
                      onViewAll: () => _open(AppRoutes.offers),
                      onExplore: (offer) {
                        _open(
                          AppRoutes.offerDetail,
                          arguments: OfferDetailArgs(offerId: offer.id),
                        );
                      },
                    ),
                    const SizedBox(
                      height: AppSpacing.space16 + AppSpacing.space12,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionDivider extends StatelessWidget {
  const _SectionDivider();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.space4,
        0,
        AppSpacing.space4,
        AppSpacing.space5,
      ),
      child: Divider(height: 1, thickness: 1, color: AppColors.divider),
    );
  }
}
