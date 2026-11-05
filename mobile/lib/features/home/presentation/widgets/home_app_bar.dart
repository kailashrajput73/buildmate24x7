import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/state/reward_controller.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icons.dart';
import '../../../catalog/domain/models/catalog_models.dart';

/// Top bar for Home — plain widget (not [AppBar]) so it works inside [MainShell]
/// without nesting another [Scaffold].
class HomeAppBar extends StatefulWidget {
  const HomeAppBar({
    super.key,
    required this.user,
    this.notificationCount = 3,
    this.onNotifications,
    this.onProfile,
    this.onCart,
    this.onRewards,
  });

  final AppUserProfile user;
  final int notificationCount;
  final VoidCallback? onNotifications;
  final VoidCallback? onProfile;
  final VoidCallback? onCart;
  final VoidCallback? onRewards;

  @override
  State<HomeAppBar> createState() => _HomeAppBarState();
}

class _HomeAppBarState extends State<HomeAppBar> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final userId = context.read<SessionController>().user.id;
      context.read<RewardController>().refreshForUser(userId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cartCount = context.watch<CartController>().totalQuantity;
    final rewardPoints = context.watch<RewardController>().balance;

    return Material(
      color: AppColors.surface,
      elevation: 0,
      child: SafeArea(
        bottom: false,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSpacing.space14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final actions = Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      onPressed: widget.onRewards,
                      tooltip: 'My Rewards',
                      icon: Badge(
                        isLabelVisible: rewardPoints > 0,
                        backgroundColor: AppColors.secondary,
                        label: Text(
                          rewardPoints > 999 ? '999+' : '$rewardPoints',
                          style: const TextStyle(
                            fontSize: 10,
                            color: Colors.white,
                          ),
                        ),
                        child: Icon(
                          Icons.stars_rounded,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: widget.onCart,
                      tooltip: 'Cart',
                      icon: Badge(
                        isLabelVisible: cartCount > 0,
                        backgroundColor: AppColors.primary,
                        label: Text(
                          cartCount > 99 ? '99+' : '$cartCount',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.onPrimary,
                          ),
                        ),
                        child: Icon(
                          appIcon('shopping_cart'),
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: widget.onNotifications,
                      tooltip: 'Notifications',
                      icon: Badge(
                        isLabelVisible: widget.notificationCount > 0,
                        backgroundColor: AppColors.error,
                        label: Text(
                          widget.notificationCount > 99
                              ? '99+'
                              : '${widget.notificationCount}',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.onPrimary,
                          ),
                        ),
                        child: Icon(
                          appIcon('notifications'),
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: widget.onProfile,
                      customBorder: const CircleBorder(),
                      child: CircleAvatar(
                        radius: AppSpacing.space4,
                        backgroundColor: AppColors.primaryContainer,
                        child: Text(
                          widget.user.initials,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                );

                // Too narrow for brand + actions (e.g. tiny browser window):
                // drop the brand and scale the actions down instead of overflowing.
                if (constraints.maxWidth < 240) {
                  return Align(
                    alignment: Alignment.centerRight,
                    child: FittedBox(fit: BoxFit.scaleDown, child: actions),
                  );
                }

                return Row(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          SizedBox(
                            width: AppSpacing.space6,
                            height: AppSpacing.space6,
                            child: Image.asset(
                              AppConstants.appLogoAsset,
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stackTrace) {
                                return Icon(
                                  Icons.home_work_rounded,
                                  size: AppSpacing.space6,
                                  color: AppColors.primary,
                                );
                              },
                            ),
                          ),
                          const SizedBox(width: AppSpacing.space2),
                          Flexible(
                            child: Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: 'BuildMate',
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  TextSpan(
                                    text: ' 24x7',
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(
                                      color: AppColors.onSurface,
                                      fontWeight: FontWeight.w400,
                                    ),
                                  ),
                                ],
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    actions,
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}