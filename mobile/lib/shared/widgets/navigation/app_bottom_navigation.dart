import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../app_icons.dart';

enum AppNavTab { home, categories, wishlist, quotation, profile }

/// Global bottom navigation — reuse across the entire app shell.
class AppBottomNavigation extends StatelessWidget {
  const AppBottomNavigation({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  static const tabs = [
    (AppNavTab.home, 'home', 'Home'),
    (AppNavTab.categories, 'category', 'Categories'),
    (AppNavTab.wishlist, 'favorite', 'Wishlist'),
    (AppNavTab.quotation, 'request_quote', 'Quotation'),
    (AppNavTab.profile, 'person', 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      height: AppSpacing.space16,
      backgroundColor: AppColors.surface,
      indicatorColor: AppColors.primaryContainer,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      destinations: [
        for (final tab in tabs)
          NavigationDestination(
            icon: Icon(appIcon(tab.$2), color: AppColors.onSurfaceVariant),
            selectedIcon: Icon(appIcon(tab.$2), color: AppColors.primary),
            label: tab.$3,
          ),
      ],
    );
  }
}
