import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/routes/app_router.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/state/cart_controller.dart';
import '../../../core/state/quotation_controller.dart';
import '../../../core/state/reward_controller.dart';
import '../../../core/state/session_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/widgets/navigation/app_bottom_navigation.dart';
import '../../catalog/presentation/screens/category_browse_screen.dart';
import '../../catalog/presentation/screens/wishlist_screen.dart';
import '../../home/presentation/screens/home_dashboard_screen.dart';
import '../../profile/presentation/screens/profile_tab_body.dart';

/// Root shell after authentication.
///
/// Owns a nested [Navigator] for feature screens so the bottom navigation
/// stays visible and Home is always one tap away.
class MainShell extends StatefulWidget {
  const MainShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  final GlobalKey<NavigatorState> _shellNavKey = GlobalKey<NavigatorState>();
  late final ValueNotifier<int> _tabIndex;
  late final _ShellNavObserver _navObserver;
  bool _hasPushedRoute = false;

  @override
  void initState() {
    super.initState();
    _tabIndex = ValueNotifier<int>(widget.initialIndex);
    _navObserver = _ShellNavObserver(
      onDepthChanged: (hasPushedRoute) {
        if (!mounted || hasPushedRoute == _hasPushedRoute) return;
        setState(() => _hasPushedRoute = hasPushedRoute);
      },
    );
  }

  @override
  void dispose() {
    _tabIndex.dispose();
    super.dispose();
  }

  void _onTabTap(int i) {
    // Clear any pushed screens so the selected tab is visible immediately.
    _shellNavKey.currentState?.popUntil((route) => route.isFirst);
    _tabIndex.value = i;
    setState(() {});
  }

  void _openInShell(String route, {Object? arguments}) {
    _shellNavKey.currentState?.pushNamed(route, arguments: arguments);
  }

  @override
  Widget build(BuildContext context) {
    final rewardMessage = context
        .watch<RewardController>()
        .lastCustomerRewardMessage;
    final index = _tabIndex.value;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || rewardMessage == null) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(rewardMessage),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.success,
        ),
      );
      context.read<RewardController>().clearCustomerRewardMessage();
    });

    return PopScope<void>(
      canPop: !_hasPushedRoute,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _hasPushedRoute) {
          _shellNavKey.currentState?.maybePop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Navigator(
          key: _shellNavKey,
          initialRoute: '/',
          observers: [_navObserver],
          onGenerateRoute: (settings) {
            if (settings.name == '/' ||
                settings.name == AppRoutes.homePlaceholder ||
                settings.name == AppRoutes.main ||
                settings.name == null) {
              return MaterialPageRoute<void>(
                settings: settings,
                builder: (_) => _ShellTabs(tabIndex: _tabIndex),
              );
            }

            // Escalate auth routes to the root navigator so sign-out / login
            // never remount the shell tabs by mistake.
            if (settings.name == AppRoutes.splash ||
                settings.name == AppRoutes.login ||
                settings.name == AppRoutes.createAccount) {
              final routeName = settings.name!;
              final args = settings.arguments;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) return;
                Navigator.of(
                  context,
                  rootNavigator: true,
                ).pushNamedAndRemoveUntil(
                  routeName,
                  (_) => false,
                  arguments: args,
                );
              });
              return MaterialPageRoute<void>(
                settings: settings,
                builder: (_) => const SizedBox.shrink(),
              );
            }

            return AppRouter.onGenerateRoute(settings);
          },
        ),
        floatingActionButton:
            AppConstants.aiAssistantEnabled && index == 0 && !_hasPushedRoute
            ? FloatingActionButton(
                onPressed: () => _openInShell(AppRoutes.aiAssistant),
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.onPrimary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                tooltip: 'AI Assistant',
                child: const Icon(Icons.auto_awesome_rounded),
              )
            : null,
        floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
        // bottomNavigationBar: AppBottomNavigation(
        //   currentIndex: index,
        //   onTap: _onTabTap,
        // ),
      ),
    );
  }
}

class _ShellTabs extends StatelessWidget {
  const _ShellTabs({required this.tabIndex});

  final ValueNotifier<int> tabIndex;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: tabIndex,
      builder: (context, index, _) {
        return IndexedStack(
          index: index,
          children: const [
            HomeDashboardScreen(),
            CategoriesTabBody(),
            _TabScaffold(title: 'Wishlist', child: WishlistScreenBody()),
            _QuotationTab(),
            ProfileTabBody(),
          ],
        );
      },
    );
  }
}

/// Simple titled tab without nesting another [Scaffold].
class _TabScaffold extends StatelessWidget {
  const _TabScaffold({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.background,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Material(
            color: AppColors.surface,
            child: SafeArea(
              bottom: false,
              child: SizedBox(
                height: AppSpacing.space14,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space4,
                  ),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _QuotationTab extends StatelessWidget {
  const _QuotationTab();

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final session = context.watch<SessionController>();
    final quotations = context.watch<QuotationController>().forRequester(
      session.user.id,
    );
    final theme = Theme.of(context);

    return _TabScaffold(
      title: 'Quotation',
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.space4),
        children: [
          if (!cart.isEmpty) ...[
            Text(
              'Cart ready · ${cart.totalQuantity} items · ₹${cart.estimatedTotal.toStringAsFixed(0)}',
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: AppSpacing.space2),
            FilledButton(
              onPressed: () {
                Navigator.of(context).pushNamed(AppRoutes.quotationReview);
              },
              child: const Text('Generate Quotation'),
            ),
            const SizedBox(height: AppSpacing.space2),
            OutlinedButton(
              onPressed: () {
                Navigator.of(context).pushNamed(AppRoutes.cart);
              },
              child: const Text('Review Cart'),
            ),
            const SizedBox(height: AppSpacing.space5),
          ] else ...[
            Text(
              'Add materials to cart to create a new quotation.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.space3),
            OutlinedButton(
              onPressed: () {
                Navigator.of(context).pushNamed(AppRoutes.cart);
              },
              child: const Text('Open Cart'),
            ),
            const SizedBox(height: AppSpacing.space5),
          ],
          Text('My quotations', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.space1),
          Text(
            'Pending quotations do not earn reward points.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.outline,
            ),
          ),
          const SizedBox(height: AppSpacing.space3),
          if (quotations.isEmpty)
            Text('No quotations yet.', style: theme.textTheme.bodyMedium)
          else
            ...quotations.map(
              (q) => Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.space2),
                padding: const EdgeInsets.all(AppSpacing.space3),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(color: AppColors.divider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(q.quotationLabel, style: theme.textTheme.titleSmall),
                    Text(
                      '₹${q.grandTotal.toStringAsFixed(0)} · ${q.status.toUpperCase()}',
                      style: theme.textTheme.bodySmall,
                    ),
                    if (q.isSold)
                      Text(
                        'Sold — rewards credited when admin confirmed sale',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: AppColors.success,
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Tracks whether the shell's nested [Navigator] has anything pushed on top
/// of its root tab route, so chrome owned by [MainShell] (like the AI
/// assistant FAB) can hide itself while a full-screen route is showing.
class _ShellNavObserver extends NavigatorObserver {
  _ShellNavObserver({required this.onDepthChanged});

  final ValueChanged<bool> onDepthChanged;
  int _depth = 0;

  void _report() => onDepthChanged(_depth > 0);

  @override
  void didPush(Route route, Route? previousRoute) {
    if (previousRoute != null) _depth++;
    _report();
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    if (previousRoute != null) _depth = (_depth - 1).clamp(0, 1 << 30);
    _report();
  }

  @override
  void didRemove(Route route, Route? previousRoute) {
    if (previousRoute != null) _depth = (_depth - 1).clamp(0, 1 << 30);
    _report();
  }
}
