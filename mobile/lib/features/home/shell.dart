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
    final current = widget.shell.currentIndex;
    void go(int i) => widget.shell.goBranch(i, initialLocation: i == current);
    return Scaffold(
      body: widget.shell,
      bottomNavigationBar: _BottomBar(
        current: current,
        onTap: go,
        items: [
          const _NavItem(Icons.home_rounded, 'Home'),
          const _NavItem(Icons.category_rounded, 'Categories'),
          const _NavItem(Icons.favorite_rounded, 'Wishlist'),
          _NavItem(Icons.request_quote_rounded, 'Quotation', badge: waiting),
          const _NavItem(Icons.person_rounded, 'Profile'),
        ],
      ),
    );
  }
}


class _NavItem {
  const _NavItem(this.icon, this.label, {this.badge = 0});
  final IconData icon;
  final String label;
  final int badge;
}

/// Five equal slots. Labels stay on one line (they shrink on narrow phones or large system fonts instead of
/// wrapping), and the bar sits above Android's gesture / 3-button navigation area on every device.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.current, required this.onTap, required this.items});
  final int current;
  final ValueChanged<int> onTap;
  final List<_NavItem> items;

  @override
  Widget build(BuildContext context) {
    // Cap very large accessibility font sizes inside the bar so five tabs always fit.
    final mq = MediaQuery.of(context);
    final scaler = mq.textScaler.clamp(minScaleFactor: 0.85, maxScaleFactor: 1.15);
    return MediaQuery(
      data: mq.copyWith(textScaler: scaler),
      child: Material(
        color: AppColors.surface,
        elevation: 8,
        shadowColor: AppColors.shadow,
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.only(bottom: 4),
          child: SizedBox(
            height: 64,
            child: Row(children: [
              for (var i = 0; i < items.length; i++)
                Expanded(child: _BottomBarButton(item: items[i], selected: i == current, onTap: () => onTap(i))),
            ]),
          ),
        ),
      ),
    );
  }
}

class _BottomBarButton extends StatelessWidget {
  const _BottomBarButton({required this.item, required this.selected, required this.onTap});
  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : AppColors.onSurfaceVariant;
    Widget icon = Icon(item.icon, color: color, size: 24);
    if (item.badge > 0) icon = Badge(label: Text('${item.badge}'), child: icon);
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 56,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? AppColors.primaryContainer : Colors.transparent,
                borderRadius: BorderRadius.circular(15),
              ),
              child: icon,
            ),
            const SizedBox(height: 4),
            SizedBox(
              height: 16,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  item.label,
                  maxLines: 1,
                  softWrap: false,
                  style: TextStyle(fontSize: 12, height: 1.2, color: color, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
