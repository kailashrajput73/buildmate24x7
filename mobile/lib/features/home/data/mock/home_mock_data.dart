import 'package:flutter/material.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/models/home_models.dart';

/// Local demo data for Home Dashboard. Replace with repository later.
abstract final class HomeMockData {
  static const AppUser currentUser = AppUser(
    id: 'user-demo-1',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@example.com',
    initials: 'RK',
  );

  /// Alias for callers that used [user] previously.
  static AppUser get user => currentUser;

  static const List<HomeBanner> banners = [
    HomeBanner(
      id: 'banner-refer',
      eyebrow: '',
      headline: 'Refer Friend & Earn ₹250!',
      description:
          'Invite your friends to BuildMate. You both get ₹250 cashback '
          'when they place their first order.',
      ctaLabel: 'Invite Friends',
      routeName: AppRoutes.myRewards,
      icon: 'card_giftcard',
      gradientStart: 0xFFE8F5B0,
      gradientEnd: 0xFFE8F5B0,
      referralStyle: true,
    ),
    HomeBanner(
      id: 'banner-pipes',
      eyebrow: 'FEATURED COLLECTION',
      headline: 'Premium Pipes Collection',
      description: 'CPVC, HDPE, UPVC & more from top brands',
      ctaLabel: 'Explore Now',
      routeName: AppRoutes.categories,
      icon: 'plumbing',
      gradientStart: 0xFF0369A1,
      gradientEnd: 0xFF0891B2,
    ),
    HomeBanner(
      id: 'banner-sanitary',
      eyebrow: 'FEATURED COLLECTION',
      headline: 'Top Sanitary Brands',
      description: 'Cera, Hindware, Jaquar & more premium bath fittings',
      ctaLabel: 'Shop Sanitary',
      routeName: AppRoutes.categories,
      icon: 'water_drop',
      gradientStart: 0xFF0E7490,
      gradientEnd: 0xFF0891B2,
    ),
    HomeBanner(
      id: 'banner-offers',
      eyebrow: 'FEATURED COLLECTION',
      headline: 'Seasonal Construction Offers',
      description: 'Save up to 18% on bulk orders this season',
      ctaLabel: 'View Offers',
      routeName: AppRoutes.offers,
      icon: 'local_offer',
      gradientStart: 0xFFB45309,
      gradientEnd: 0xFFD97706,
    ),
  ];

  static final List<QuickAction> quickActions = [
    QuickAction(
      id: 'qa-quotation',
      title: 'Generate\nQuotation',
      icon: 'request_quote',
      routeName: AppRoutes.quotation,
      iconColor: AppColors.primary.toARGB32(),
      iconBackground: AppColors.primaryContainer.toARGB32(),
    ),
    QuickAction(
      id: 'qa-dealer',
      title: 'Find\nDealer',
      icon: 'storefront',
      routeName: AppRoutes.dealers,
      iconColor: AppColors.tertiary.toARGB32(),
      iconBackground: AppColors.tertiaryContainer.toARGB32(),
    ),
    QuickAction(
      id: 'qa-brands',
      title: 'Top\nBrands',
      icon: 'business',
      routeName: AppRoutes.brands,
      iconColor: AppColors.info.toARGB32(),
      iconBackground: AppColors.infoContainer.toARGB32(),
    ),
    QuickAction(
      id: 'qa-offers',
      title: 'Current\nOffers',
      icon: 'local_offer',
      routeName: AppRoutes.offers,
      iconColor: AppColors.secondary.toARGB32(),
      iconBackground: AppColors.secondaryContainer.toARGB32(),
    ),
  ];

  static final List<HomeCategory> categories = [
    _cat('cement', 'Cement', 244, 'inventory_2', AppColors.onSurfaceVariant, AppColors.surfaceVariant),
    _cat('steel', 'Steel & TMT', 57, 'bolt', AppColors.info, AppColors.infoContainer),
    _cat('pipes', 'Pipes & Fittings', 87, 'plumbing', AppColors.primary, AppColors.primaryContainer),
    _cat('tiles', 'Tiles', 124, 'grid_view', AppColors.tertiary, AppColors.tertiaryContainer),
    _cat('sanitary', 'Sanitaryware', 73, 'water_drop', AppColors.info, AppColors.infoContainer),
    _cat('paints', 'Paints', 96, 'palette', AppColors.secondary, AppColors.secondaryContainer),
    _cat('electrical', 'Electrical', 112, 'electrical_services', AppColors.secondary, AppColors.secondaryContainer),
    _cat('hardware', 'Hardware', 148, 'handyman', AppColors.onSurfaceVariant, AppColors.surfaceContainer),
    _cat('chemicals', 'Chemicals', 54, 'science', AppColors.warning, AppColors.warningContainer),
    _cat('roofing', 'Roofing', 41, 'roofing', AppColors.primary, AppColors.primaryContainer),
    _cat('road', 'Road', 39, 'add_road', AppColors.secondary, AppColors.secondaryContainer),
    _cat('safety', 'Safety', 28, 'health_and_safety', AppColors.error, AppColors.errorContainer),
  ];

  static const List<HomeProduct> featuredProducts = [
    HomeProduct(
      id: 'fp1',
      name: 'PPC Cement 50kg Bag',
      brand: 'UltraTech',
      spec: 'Grade 53 · BIS Certified',
      price: '₹380',
      rating: 4.5,
      inStock: true,
      categoryKey: 'cement',
      icon: 'inventory_2',
    ),
    HomeProduct(
      id: 'fp2',
      name: 'CPVC Pipe 1 inch',
      brand: 'Astral',
      spec: '6m length · SDR-11',
      price: '₹145/m',
      rating: 4.3,
      inStock: true,
      categoryKey: 'pipes',
      icon: 'plumbing',
    ),
    HomeProduct(
      id: 'fp3',
      name: 'MS Angle 50×50×5mm',
      brand: 'Tata Steel',
      spec: 'IS:2062 Grade E250',
      price: '₹4,200/pcs',
      rating: 4.7,
      inStock: true,
      categoryKey: 'steel',
      icon: 'bolt',
    ),
  ];

  static final List<HomeBrand> popularBrands = [
    HomeBrand(id: 'b1', name: 'UltraTech', productCount: 248, abbreviation: 'UT', color: AppColors.primary.toARGB32()),
    HomeBrand(id: 'b2', name: 'ACC', productCount: 112, abbreviation: 'ACC', color: AppColors.secondary.toARGB32()),
    HomeBrand(id: 'b3', name: 'Astral', productCount: 176, abbreviation: 'AST', color: AppColors.tertiary.toARGB32()),
    HomeBrand(id: 'b4', name: 'Ambuja', productCount: 98, abbreviation: 'AMB', color: AppColors.info.toARGB32()),
    HomeBrand(id: 'b5', name: 'Asian Paints', productCount: 312, abbreviation: 'AP', color: AppColors.error.toARGB32()),
    HomeBrand(id: 'b6', name: 'Supreme', productCount: 134, abbreviation: 'SUP', color: AppColors.onSurfaceVariant.toARGB32()),
  ];

  static const List<HomeProduct> popularProducts = [
    HomeProduct(
      id: 'pp1',
      name: 'OPC Cement 53 Grade',
      brand: 'ACC',
      spec: '50kg · IS:269',
      price: '₹410',
      rating: 4.4,
      inStock: true,
      categoryKey: 'cement',
      icon: 'inventory_2',
    ),
    HomeProduct(
      id: 'pp2',
      name: 'HDPE Pipe 2 inch',
      brand: 'Supreme',
      spec: 'PN10 · ISI Marked',
      price: '₹95/m',
      rating: 4.2,
      inStock: true,
      categoryKey: 'pipes',
      icon: 'plumbing',
    ),
    HomeProduct(
      id: 'pp3',
      name: 'Primer Sealer 20L',
      brand: 'Berger',
      spec: 'Interior · Water-based',
      price: '₹1,850',
      rating: 4.1,
      inStock: false,
      categoryKey: 'paint',
      icon: 'palette',
    ),
    HomeProduct(
      id: 'pp4',
      name: 'MS Angle 50×50×5mm',
      brand: 'Tata Steel',
      spec: 'IS:2062 Grade E250',
      price: '₹4,200/pcs',
      rating: 4.6,
      inStock: true,
      categoryKey: 'steel',
      icon: 'bolt',
    ),
  ];

  static const List<HomeProduct> recentlyViewed = [
    HomeProduct(
      id: 'rv1',
      name: 'PPC Cement 50kg',
      brand: 'UltraTech',
      spec: 'Grade 53',
      price: '₹380',
      rating: 4.5,
      inStock: true,
      categoryKey: 'cement',
      icon: 'inventory_2',
    ),
    HomeProduct(
      id: 'rv2',
      name: 'CPVC Pipe 1 inch',
      brand: 'Astral',
      spec: 'SDR-11',
      price: '₹145/m',
      rating: 4.3,
      inStock: true,
      categoryKey: 'pipes',
      icon: 'plumbing',
    ),
    HomeProduct(
      id: 'rv3',
      name: 'TMT Bar 12mm',
      brand: 'Tata Steel',
      spec: 'Fe-500D',
      price: '₹62,500/t',
      rating: 4.7,
      inStock: true,
      categoryKey: 'steel',
      icon: 'bolt',
    ),
    HomeProduct(
      id: 'rv4',
      name: 'Apex Wall Putty 20kg',
      brand: 'Asian Paints',
      spec: 'Interior',
      price: '₹680',
      rating: 4.2,
      inStock: true,
      categoryKey: 'paint',
      icon: 'palette',
    ),
  ];

  static const List<HomeOffer> currentOffers = [
    HomeOffer(
      id: 'o1',
      discountLabel: '15% OFF',
      title: 'Bulk Cement Discount',
      subtitle: 'Min order 500 bags',
      endsOn: 'Ends 31 Aug 2024',
      ctaLabel: 'Explore',
      routeName: AppRoutes.offers,
    ),
    HomeOffer(
      id: 'o2',
      discountLabel: '20% OFF',
      title: 'Monsoon Paint Sale',
      subtitle: 'On selected paint products',
      endsOn: 'Ends 15 Sep 2024',
      ctaLabel: 'Explore',
      routeName: AppRoutes.offers,
    ),
  ];

  static const List<ConstructionTool> constructionTools = [
    ConstructionTool(
      id: 't1',
      title: 'Material Calculator',
      subtitle: 'Estimate cement, steel & aggregate',
      icon: 'calculate',
      routeName: AppRoutes.search,
    ),
    ConstructionTool(
      id: 't2',
      title: 'Unit Converter',
      subtitle: 'Convert units across standards',
      icon: 'swap_horiz',
      routeName: AppRoutes.search,
    ),
    ConstructionTool(
      id: 't3',
      title: 'Quantity Estimator',
      subtitle: 'Project-based material planning',
      icon: 'architecture',
      routeName: AppRoutes.search,
    ),
  ];

  static HomeCategory _cat(
    String id,
    String name,
    int count,
    String icon,
    Color color,
    Color bg,
  ) {
    return HomeCategory(
      id: 'cat-$id',
      name: name,
      itemCount: count,
      icon: icon,
      iconColor: color.toARGB32(),
      iconBackground: bg.toARGB32(),
    );
  }
}
