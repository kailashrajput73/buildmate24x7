/** Site URLs for the screens (mirrors Flutter `lib/core/routes/app_routes.dart`). Product pages are /p/{id}, category pages /c/{id}. */
export const AppRoutes = {
  splash: '/welcome',
  login: '/login',
  createAccount: '/signup',
  chooseLocation: '/signup/location',
  chooseProfession: '/signup/profession',
  otpVerification: '/login/verify',
  /** Post-auth shell (Home + navigation). Flutter keeps both names. */
  homePlaceholder: '/',
  main: '/',

  search: '/search',
  categories: '/categories',
  profile: '/account',
  notifications: '/account/notifications',
  myRewards: '/rewards',
  aiAssistant: '/assistant',
  categoryBrowse: '/c',
  /**
   * Web-only path. Flutter pushes `_PipeConfiguratorScreen` with an anonymous
   * `MaterialPageRoute` (no named route), so a URL is needed for the browser.
   */
  pipeConfigurator: '/p',

  cart: '/cart',
  /** Flutter `AppRoutes.selectAddress` — checkout step 2 (address + delivery option). */
  selectAddress: '/checkout',
  /** Flutter `AppRoutes.payment` — step 3; router state is `PaymentArgs`. */
  payment: '/checkout/payment',
  /** Flutter `AppRoutes.orderConfirmation` — step 4; router state is `OrderConfirmationArgs`. */
  orderConfirmation: '/checkout/confirmation',

  /** Web-only company pages linked from `StorefrontFooter` (stubs for now). */
  about: '/policies#about',
  contact: '/policies#contact',
  privacyPolicy: '/policies#privacy',
  terms: '/policies#terms',
  cancellationRefunds: '/policies#refunds',
  shippingDelivery: '/policies#shipping',
} as const;

/** Flutter `OtpVerificationArgs` — passed as router `state`. */
export interface OtpVerificationArgs {
  contactDisplay: string;
  /** Raw mobile digits for the signup flow after OTP. */
  mobileNumber?: string;
}

/** Flutter `SignupFlowArgs` — passed as router `state`. */
export interface SignupFlowArgs {
  mobileNumber: string;
  fullName: string;
  email?: string;
  /** Optional referral code entered during signup. */
  referralCode?: string;
  /** True when chooseLocation is opened from Home to change the saved address. */
  isLocationUpdate?: boolean;
}

/** Flutter `CategoryBrowseArgs` — passed as router `state`. */
export interface CategoryBrowseArgs {
  categoryId: string;
  categoryName?: string;
}
