import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/providers.dart';
import '../../main.dart';
import '../../core/api.dart';
import 'dart:io' show Platform;

/// Bottom navigation: Home · Shop · Scan · Cart · Account.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;
  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  @override
  void initState() {
    super.initState();
    // Register this device for order / KYC push notifications (no-op when Firebase isn't configured).
    Future.microtask(() async {
      if (!ref.read(pushReadyProvider) || ref.read(authProvider).status != AuthStatus.loggedIn) return;
      final token = await getPushToken();
      if (token == null) return;
      try {
        await ref.read(apiProvider).post('/api/account/devices', {'token': token, 'platform': Platform.isIOS ? 'Ios' : 'Android'});
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    // The design kit's bottom bar: Home · Categories · Wishlist · Quotation · Profile. The cart is in the top bars.
    final waiting = (ref.watch(authProvider).status == AuthStatus.loggedIn
            ? ref.watch(quotationsProvider).valueOrNull?.where((q) => q.status == 'Quoted').length
            : null) ??
        0;
    return Scaffold(
      body: widget.shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: widget.shell.currentIndex,
        onDestinationSelected: (i) => widget.shell.goBranch(i, initialLocation: i == widget.shell.currentIndex),
        height: AppSpacing.space16,
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.primaryContainer,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          const NavigationDestination(icon: Icon(Icons.home_rounded, color: AppColors.onSurfaceVariant), selectedIcon: Icon(Icons.home_rounded, color: AppColors.primary), label: 'Home'),
          const NavigationDestination(icon: Icon(Icons.category_rounded, color: AppColors.onSurfaceVariant), selectedIcon: Icon(Icons.category_rounded, color: AppColors.primary), label: 'Categories'),
          const NavigationDestination(icon: Icon(Icons.favorite_rounded, color: AppColors.onSurfaceVariant), selectedIcon: Icon(Icons.favorite_rounded, color: AppColors.primary), label: 'Wishlist'),
          NavigationDestination(
            icon: Badge(isLabelVisible: waiting > 0, label: Text('$waiting'), child: const Icon(Icons.request_quote_rounded, color: AppColors.onSurfaceVariant)),
            selectedIcon: Badge(isLabelVisible: waiting > 0, label: Text('$waiting'), child: const Icon(Icons.request_quote_rounded, color: AppColors.primary)),
            label: 'Quotation',
          ),
          const NavigationDestination(icon: Icon(Icons.person_rounded, color: AppColors.onSurfaceVariant), selectedIcon: Icon(Icons.person_rounded, color: AppColors.primary), label: 'Profile'),
        ],
      ),
    );
  }
}
