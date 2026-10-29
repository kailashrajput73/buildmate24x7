import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'data/providers.dart';
import 'features/account/account_screens.dart';
import 'features/auth/login_screen.dart';
import 'features/cart/cart_screen.dart';
import 'features/cart/checkout_screen.dart';
import 'features/catalog/catalog_screens.dart';
import 'features/catalog/category_browse.dart';
import 'features/quotations/quotation_screens.dart';
import 'features/services/service_screens.dart';
import 'features/home/home_screen.dart';
import 'features/home/shell.dart';
import 'features/kyc/kyc_screens.dart';
import 'features/orders/order_screens.dart';
import 'features/rewards/rewards_screen.dart';
import 'features/scan/scan_screen.dart';

/// Bridges Riverpod auth state to GoRouter's refreshListenable.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

/// Screens a visitor can open without logging in.
const _publicPaths = ['/home', '/shop', '/products', '/product', '/category', '/scan', '/wishlist', '/quotations', '/account'];

final routerProvider = Provider<GoRouter>((ref) {
  final listenable = _AuthListenable(ref);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: listenable,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      if (auth.status == AuthStatus.unknown) return loc == '/splash' ? null : '/splash';
      final signingIn = loc == '/login' || loc.startsWith('/login/') || loc.startsWith('/signup');
      if (auth.status == AuthStatus.loggedOut) {
        if (loc == '/splash') return '/login';
        // Anyone can browse; the cart, checkout and account need a login.
        final public = signingIn || _publicPaths.any((p) => loc == p || loc.startsWith('$p/'));
        return public ? null : '/login?next=${Uri.encodeComponent(state.uri.toString())}';
      }
      // A partner who hasn't filled in business details yet finishes registration first.
      final partnerSetup = auth.user?.userType == 'Partner' && auth.user?.kycStatus == 'NotSubmitted';
      if (loc == '/splash' || (signingIn && !loc.startsWith('/signup'))) return partnerSetup ? '/register' : (state.uri.queryParameters['next'] ?? '/home');
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, s) => LoginScreen(next: s.uri.queryParameters['next'])),
      GoRoute(path: '/login/verify', builder: (_, s) => OtpScreen(args: s.extra! as OtpArgs)),
      GoRoute(path: '/signup', builder: (_, s) => CreateAccountScreen(args: s.extra! as SignupArgs)),
      GoRoute(path: '/signup/profession', builder: (_, s) => ProfessionScreen(args: s.extra! as SignupArgs)),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/kyc', builder: (_, __) => const KycScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, __) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/shop', builder: (_, __) => const CategoriesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/wishlist', builder: (_, __) => const WishlistScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/quotations', builder: (_, __) => const QuotationsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/account', builder: (_, __) => const AccountScreen())]),
        ],
      ),
      GoRoute(path: '/products', builder: (_, s) => ProductListScreen(query: s.extra as CatalogQuery? ?? const CatalogQuery(), title: s.uri.queryParameters['title'])),
      GoRoute(path: '/product/:id', builder: (_, s) => ProductScreen(id: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/cart', builder: (_, __) => const CartScreen()),
      GoRoute(path: '/services', builder: (_, __) => const ServiceRequestsScreen()),
      GoRoute(path: '/scan', builder: (_, __) => const ScanScreen()),
      GoRoute(path: '/category/:id', builder: (_, s) => CategoryBrowseScreen(categoryId: int.parse(s.pathParameters['id']!), title: s.extra as String? ?? 'Products')),
      GoRoute(path: '/quotations/:id', builder: (_, s) => QuotationScreen(id: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/checkout', builder: (_, __) => const CheckoutScreen()),
      GoRoute(path: '/orders', builder: (_, __) => const OrdersScreen()),
      GoRoute(path: '/orders/:id', builder: (_, s) => OrderScreen(id: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/orders/:id/paid', builder: (_, s) => PaymentResultScreen(orderId: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/rewards', builder: (_, __) => const RewardsScreen()),
      GoRoute(path: '/addresses', builder: (_, __) => const AddressesScreen()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/profile', builder: (_, __) => const RegisterScreen(editing: true)),
    ],
  );
});
