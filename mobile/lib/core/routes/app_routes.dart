import '../../features/checkout/domain/models/address_models.dart';
import '../../features/checkout/domain/models/order_models.dart';

abstract final class AppRoutes {
  static const String splash = '/';
  static const String login = '/login';
  static const String createAccount = '/create-account';
  static const String chooseLocation = '/choose-location';
  static const String chooseProfession = '/choose-profession';
  static const String otpVerification = '/otp-verification';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';
  static const String passwordUpdated = '/password-updated';

  /// Post-auth shell (Home + bottom navigation).
  /// Kept as [homePlaceholder] for auth screens that already navigate here.
  static const String homePlaceholder = '/home-placeholder';
  static const String main = '/main';

  static const String search = '/search';
  static const String categories = '/categories';
  static const String categoryBrowse = '/category-browse';
  static const String productList = '/product-list';
  static const String productDetail = '/product-detail';
  static const String upvcPipeVariants = '/upvc-pipe-variants';
  static const String dealers = '/dealers';
  static const String brands = '/brands';
  static const String brandProducts = '/brand-products';
  static const String offers = '/offers';
  static const String offerDetail = '/offer-detail';
  static const String cart = '/cart';
  static const String selectAddress = '/checkout/address';
  static const String addAddress = '/checkout/address/new';
  static const String payment = '/checkout/payment';
  static const String orderConfirmation = '/checkout/confirmation';
  static const String quotation = '/quotation';
  static const String quotationReview = '/quotation-review';
  static const String wishlist = '/wishlist';
  static const String profile = '/profile';
  static const String notifications = '/notifications';
  static const String materialCalculator = '/material-calculator';
  static const String unitConverter = '/unit-converter';
  static const String quantityEstimator = '/quantity-estimator';
  static const String myRewards = '/my-rewards';
  static const String adminQuotations = '/admin-quotations';
  static const String adminQuotationDetail = '/admin-quotation-detail';
  static const String aiAssistant = '/ai-assistant';
}

/// Arguments for [AppRoutes.otpVerification].
class OtpVerificationArgs {
  const OtpVerificationArgs({
    required this.contactDisplay,
    required this.purpose,
    this.resetIdentifier,
    this.resetIsEmail = false,
    this.mobileNumber,
  });

  final String contactDisplay;
  final OtpPurpose purpose;
  final String? resetIdentifier;
  final bool resetIsEmail;
  /// Raw mobile digits for the signup flow after OTP.
  final String? mobileNumber;
}

/// Arguments passed through signup steps 3 → 4.
class SignupFlowArgs {
  const SignupFlowArgs({
    required this.mobileNumber,
    required this.fullName,
    this.email = '',
    this.referralCode,
    this.isLocationUpdate = false,
  });

  final String mobileNumber;
  final String fullName;
  final String email;

  /// Optional referral code entered during signup.
  final String? referralCode;

  /// True when [AppRoutes.chooseLocation] is opened from Home to change the
  /// saved address rather than as part of the signup flow.
  final bool isLocationUpdate;
}

enum OtpPurpose {
  registration,
  mobileLogin,
  passwordReset,
}

/// Arguments for [AppRoutes.resetPassword].
class ResetPasswordArgs {
  const ResetPasswordArgs({
    required this.identifier,
    required this.isEmail,
  });

  final String identifier;
  final bool isEmail;
}

class SearchArgs {
  const SearchArgs({this.initialQuery});

  final String? initialQuery;
}

class CategoryBrowseArgs {
  const CategoryBrowseArgs({
    required this.categoryId,
    this.categoryName,
  });

  final String categoryId;
  /// Optional display name from live API (used to route pipes categories).
  final String? categoryName;
}

class ProductListArgs {
  const ProductListArgs({
    this.categoryId,
    this.subCategoryId,
    this.brandId,
    this.title,
  });

  final String? categoryId;
  final String? subCategoryId;
  final String? brandId;
  final String? title;
}

class ProductDetailArgs {
  const ProductDetailArgs({
    required this.productId,
    this.variantId,
  });

  final String productId;
  final String? variantId;
}

class UpvcPipeVariantsArgs {
  const UpvcPipeVariantsArgs({
    this.subCategoryId,
    this.productId,
    this.title,
    this.heroImageAsset,
    this.categoryIds,
  });

  /// When null, includes all pipe types under Pipes & Tubing.
  final String? subCategoryId;

  /// When set, limits the configurator to variants of this product.
  final String? productId;

  /// Display name shown on the configurator (e.g. "Pipes").
  final String? title;

  /// Shared hero image for unified section opens.
  final String? heroImageAsset;

  /// When set, limits variants to these category ids.
  final List<String>? categoryIds;
}

/// Arguments for [AppRoutes.payment].
class PaymentArgs {
  const PaymentArgs({required this.address, required this.delivery});

  final DeliveryAddress address;
  final DeliveryOption delivery;
}

/// Arguments for [AppRoutes.orderConfirmation].
class OrderConfirmationArgs {
  const OrderConfirmationArgs({required this.order});

  final PlacedOrder order;
}

class BrandProductsArgs {
  const BrandProductsArgs({required this.brandId});
  final String brandId;
}

class OfferDetailArgs {
  const OfferDetailArgs({required this.offerId});
  final String offerId;
}

class AdminQuotationDetailArgs {
  const AdminQuotationDetailArgs({required this.quotationId});
  final String quotationId;
}
