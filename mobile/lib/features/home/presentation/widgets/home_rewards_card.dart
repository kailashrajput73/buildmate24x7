import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/reward_controller.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

/// Compact Home entry point — does not dominate the dashboard.
class HomeRewardsCard extends StatefulWidget {
  const HomeRewardsCard({super.key});

  @override
  State<HomeRewardsCard> createState() => _HomeRewardsCardState();
}

class _HomeRewardsCardState extends State<HomeRewardsCard> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final userId = context.read<SessionController>().user.id;
      context.read<RewardController>().refreshForUser(userId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final balance = context.watch<RewardController>().balance;
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.lgAll,
      child: InkWell(
        borderRadius: AppRadius.lgAll,
        onTap: () => Navigator.of(context).pushNamed(AppRoutes.myRewards),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.space4),
          decoration: BoxDecoration(
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: AppColors.divider),
          ),
          child: Row(
            children: [
              Container(
                width: AppSpacing.space10,
                height: AppSpacing.space10,
                decoration: BoxDecoration(
                  color: AppColors.secondaryContainer,
                  borderRadius: AppRadius.mdAll,
                ),
                child: const Center(
                  child: Text('⭐', style: TextStyle(fontSize: 20)),
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Reward Points', style: theme.textTheme.titleSmall),
                    Text(
                      '$balance Points',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.outline,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                'View Rewards →',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
