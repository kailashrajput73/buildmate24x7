import 'package:flutter/material.dart';

import '../constants/app_constants.dart';
import '../../features/auth/presentation/screens/choose_location_screen.dart';
import '../../features/auth/presentation/screens/choose_profession_screen.dart';
import '../../features/auth/presentation/screens/create_account_screen.dart';
import '../../features/auth/presentation/screens/forgot_password_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/otp_verification_screen.dart';
import '../../features/auth/presentation/screens/password_updated_screen.dart';
import '../../features/auth/presentation/screens/reset_password_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/catalog/data/mappers/catalog_api_mapper.dart';
import '../../features/catalog/presentation/screens/brands_screen.dart';
import '../../features/catalog/presentation/screens/cart_screen.dart';
import '../../features/catalog/presentation/screens/electricals_category_screen.dart';
import '../../features/checkout/presentation/screens/add_address_screen.dart';
import '../../features/checkout/presentation/screens/order_confirmation_screen.dart';
import '../../features/checkout/presentation/screens/payment_screen.dart';
import '../../features/checkout/presentation/screens/select_address_screen.dart';
import '../../features/catalog/presentation/screens/category_browse_screen.dart';
import '../../features/catalog/presentation/screens/material_calculator_screen.dart';
import '../../features/catalog/presentation/screens/offers_screen.dart';
import '../../features/catalog/presentation/screens/pipes_fitting_category_screen.dart';
import '../../features/catalog/presentation/screens/product_detail_screen.dart';
import '../../features/catalog/presentation/screens/product_list_screen.dart';
import '../../features/catalog/presentation/screens/search_screen.dart';
import '../../features/catalog/presentation/screens/upvc_pipe_variant_list_screen.dart';
import '../../features/placeholders/presentation/screens/feature_placeholder_screen.dart';
import '../../features/profile/presentation/screens/profile_tab_body.dart';
import '../../features/rewards/presentation/screens/admin_quotation_detail_screen.dart';
import '../../features/rewards/presentation/screens/admin_quotations_screen.dart';
import '../../features/rewards/presentation/screens/my_rewards_screen.dart';
import '../../features/shell/presentation/main_shell.dart';
import '../theme/app_colors.dart';
import 'app_routes.dart';

abstract final class AppRouter {
  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.splash:
        return _fade(const SplashScreen(), settings);
      case AppRoutes.login:
        return _slide(const LoginScreen(), settings);
      case AppRoutes.createAccount:
        final signupArgs = settings.arguments as SignupFlowArgs?;
        return _slide(CreateAccountScreen(args: signupArgs), settings);
      case AppRoutes.chooseLocation:
        final locationArgs = settings.arguments as SignupFlowArgs?;
        return _slide(
          ChooseLocationScreen(
            args: locationArgs ??
                const SignupFlowArgs(mobileNumber: '', fullName: ''),
            isLocationUpdate: locationArgs?.isLocationUpdate ?? false,
          ),
          settings,
        );
      case AppRoutes.chooseProfession:
        final professionArgs = settings.arguments as SignupFlowArgs?;
        return _slide(
          ChooseProfessionScreen(
            args: professionArgs ??
                const SignupFlowArgs(mobileNumber: '', fullName: ''),
          ),
          settings,
        );
      case AppRoutes.otpVerification:
        final args = settings.arguments as OtpVerificationArgs?;
        return _slide(
          OtpVerificationScreen(
            args: args ??
                const OtpVerificationArgs(
                  contactDisplay: '+91 98765 43210',
                  purpose: OtpPurpose.mobileLogin,
                ),
          ),
          settings,
        );
      case AppRoutes.forgotPassword:
        return _slide(const ForgotPasswordScreen(), settings);
      case AppRoutes.resetPassword:
        final args = settings.arguments as ResetPasswordArgs?;
        return _slide(
          ResetPasswordScreen(
            args: args ??
                const ResetPasswordArgs(
                  identifier: '',
                  isEmail: true,
                ),
          ),
          settings,
        );
      case AppRoutes.passwordUpdated:
        return _fade(const PasswordUpdatedScreen(), settings);

      case AppRoutes.homePlaceholder:
      case AppRoutes.main:
        return _fade(const MainShell(), settings);

      case AppRoutes.search:
        final searchArgs = settings.arguments as SearchArgs?;
        return _slide(
          SearchScreen(initialQuery: searchArgs?.initialQuery),
          settings,
        );
      case AppRoutes.categories:
        return _slide(const CategoriesScreen(), settings);
      case AppRoutes.categoryBrowse:
        final args = settings.arguments as CategoryBrowseArgs?;
        final categoryId = args?.categoryId ?? '';
        final categoryName = args?.categoryName ?? '';
        final isElectricalCategory =
            categoryId.toLowerCase().contains('electrical') ||
            categoryId.toLowerCase().contains('electric') ||
            categoryName.toLowerCase().contains('electrical') ||
            categoryName.toLowerCase().contains('electric');
        if (isElectricalCategory) {
          return _slide(const ElectricalsCategoryScreen(), settings);
        }
        final isPipesCategory = categoryId == 'pipes' ||
            CatalogApiMapper.isPipesCategory(categoryName) ||
            (categoryName.isEmpty &&
                RegExp(r'^[0-9a-f-]{36}$', caseSensitive: false)
                    .hasMatch(categoryId));
        if (isPipesCategory) {
          return _slide(const PipesFittingCategoryScreen(), settings);
        }
        return _slide(CategoryBrowseScreen(categoryId: categoryId), settings);
      case AppRoutes.productList:
        final args = settings.arguments as ProductListArgs?;
        return _slide(
          ProductListScreen(
            categoryId: args?.categoryId,
            subCategoryId: args?.subCategoryId,
            brandId: args?.brandId,
            title: args?.title,
          ),
          settings,
        );
      case AppRoutes.productDetail:
        final args = settings.arguments as ProductDetailArgs?;
        return _slide(
          ProductDetailScreen(
            productId: args?.productId ?? '',
            initialVariantId: args?.variantId,
          ),
          settings,
        );
      case AppRoutes.upvcPipeVariants:
        final args = settings.arguments as UpvcPipeVariantsArgs?;
        return _slide(
          UpvcPipeVariantListScreen(
            subCategoryId: args?.subCategoryId,
            productId: args?.productId,
            title: args?.title,
            heroImageAsset: args?.heroImageAsset,
            categoryIds: args?.categoryIds,
          ),
          settings,
        );
      case AppRoutes.dealers:
        return _slide(
          const StandalonePlaceholderScreen(
            title: 'Find Dealer',
            subtitle: 'Locate trusted dealers near you.',
            icon: Icons.storefront_rounded,
          ),
          settings,
        );
      case AppRoutes.brands:
        return _slide(const BrandsScreen(), settings);
      case AppRoutes.brandProducts:
        final args = settings.arguments as BrandProductsArgs?;
        return _slide(
          BrandProductsScreen(brandId: args?.brandId ?? ''),
          settings,
        );
      case AppRoutes.offers:
        return _slide(const OffersScreen(), settings);
      case AppRoutes.offerDetail:
        final args = settings.arguments as OfferDetailArgs?;
        return _slide(
          OfferDetailScreen(offerId: args?.offerId ?? ''),
          settings,
        );
      case AppRoutes.cart:
        return _slide(const CartScreen(), settings);
      case AppRoutes.selectAddress:
        return _slide(const SelectAddressScreen(), settings);
      case AppRoutes.addAddress:
        return _slide(const AddAddressScreen(), settings);
      case AppRoutes.payment:
        final args = settings.arguments;
        if (args is! PaymentArgs) return _slide(const CartScreen(), settings);
        return _slide(PaymentScreen(args: args), settings);
      case AppRoutes.orderConfirmation:
        final args = settings.arguments;
        if (args is! OrderConfirmationArgs) {
          return _slide(const CartScreen(), settings);
        }
        return _fade(OrderConfirmationScreen(order: args.order), settings);
      case AppRoutes.quotation:
      case AppRoutes.quotationReview:
        return _slide(const QuotationReviewScreen(), settings);
      case AppRoutes.wishlist:
        return _slide(
          const StandalonePlaceholderScreen(
            title: 'Wishlist',
            subtitle: 'Use the Wishlist tab in bottom navigation.',
            icon: Icons.favorite_rounded,
          ),
          settings,
        );
      case AppRoutes.profile:
        return _slide(
          const Scaffold(
            backgroundColor: AppColors.background,
            body: ProfileTabBody(showBackButton: true),
          ),
          settings,
        );
      case AppRoutes.notifications:
        return _slide(
          const StandalonePlaceholderScreen(
            title: 'Notifications',
            subtitle: 'Alerts and enquiry updates.',
            icon: Icons.notifications_rounded,
          ),
          settings,
        );
      case AppRoutes.materialCalculator:
        return _slide(const MaterialCalculatorScreen(), settings);
      case AppRoutes.unitConverter:
        return _slide(
          const StandalonePlaceholderScreen(
            title: 'Unit Converter',
            subtitle: 'Convert units across standards (coming soon).',
            icon: Icons.swap_horiz_rounded,
          ),
          settings,
        );
      case AppRoutes.quantityEstimator:
        return _slide(
          const StandalonePlaceholderScreen(
            title: 'Quantity Estimator',
            subtitle: 'Project-based material planning (coming soon).',
            icon: Icons.architecture_rounded,
          ),
          settings,
        );
      case AppRoutes.myRewards:
        return _slide(const MyRewardsScreen(), settings);
      case AppRoutes.adminQuotations:
        return _slide(const AdminQuotationsScreen(), settings);
      case AppRoutes.adminQuotationDetail:
        final args = settings.arguments as AdminQuotationDetailArgs?;
        return _slide(
          AdminQuotationDetailScreen(
            quotationId: args?.quotationId ?? '',
          ),
          settings,
        );
      case AppRoutes.aiAssistant:
        if (!AppConstants.aiAssistantEnabled) {
          return _aiAssistantDisabledRoute(settings);
        }
        return _slide(
          const StandalonePlaceholderScreen(
            title: 'AI Assistant',
            subtitle:
                'Ask about products, materials, and quotations. Full assistant coming soon.',
            icon: Icons.auto_awesome_rounded,
          ),
          settings,
        );
      default:
        return _fade(const SplashScreen(), settings);
    }
  }

  static PageRouteBuilder<dynamic> _fade(Widget page, RouteSettings settings) {
    return PageRouteBuilder(
      settings: settings,
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (_, animation, _, child) {
        return FadeTransition(opacity: animation, child: child);
      },
    );
  }

  static PageRouteBuilder<dynamic> _slide(Widget page, RouteSettings settings) {
    return PageRouteBuilder(
      settings: settings,
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (_, animation, _, child) {
        final offset = Tween<Offset>(
          begin: const Offset(0.04, 0),
          end: Offset.zero,
        ).animate(
          CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
        );
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: offset, child: child),
        );
      },
    );
  }

  /// No-op route when [AppConstants.aiAssistantEnabled] is false.
  static MaterialPageRoute<void> _aiAssistantDisabledRoute(
    RouteSettings settings,
  ) {
    return MaterialPageRoute<void>(
      settings: settings,
      builder: (context) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Navigator.of(context).maybePop();
        });
        return const SizedBox.shrink();
      },
    );
  }
}
