import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icons.dart';
import '../../domain/models/home_models.dart';

class QuickActionsRow extends StatelessWidget {
  const QuickActionsRow({
    super.key,
    required this.actions,
    required this.onTap,
  });

  final List<QuickAction> actions;
  final void Function(QuickAction action) onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < actions.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.space2),
          Expanded(
            child: QuickActionCard(
              action: actions[i],
              onTap: () => onTap(actions[i]),
            ),
          ),
        ],
      ],
    );
  }
}

class QuickActionCard extends StatelessWidget {
  const QuickActionCard({
    super.key,
    required this.action,
    this.onTap,
  });

  final QuickAction action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      elevation: AppElevation.level1,
      shadowColor: AppColors.shadow,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space1,
            vertical: AppSpacing.space2,
          ),
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: AppColors.divider),
          ),
          child: Column(
            children: [
              Container(
                width: AppSpacing.space10,
                height: AppSpacing.space10,
                decoration: BoxDecoration(
                  color: Color(action.iconBackground),
                  borderRadius: AppRadius.smAll,
                ),
                child: Icon(
                  appIcon(action.icon),
                  color: Color(action.iconColor),
                  size: AppSpacing.space5,
                ),
              ),
              const SizedBox(height: AppSpacing.space1),
              Text(
                action.title,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: AppColors.onSurface,
                  fontWeight: FontWeight.w600,
                  height: 1.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
