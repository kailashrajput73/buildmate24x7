import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icons.dart';
import '../../domain/models/home_models.dart';
import 'home_section_header.dart';

class ConstructionToolsSection extends StatelessWidget {
  const ConstructionToolsSection({
    super.key,
    required this.tools,
    this.onViewAll,
    this.onToolTap,
  });

  final List<ConstructionTool> tools;
  final VoidCallback? onViewAll;
  final void Function(ConstructionTool tool)? onToolTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HomeSectionHeader(title: 'Construction Tools', onViewAll: onViewAll),
        const SizedBox(height: AppSpacing.space3),
        for (var i = 0; i < tools.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space2),
          ConstructionToolTile(
            tool: tools[i],
            onTap: () => onToolTap?.call(tools[i]),
          ),
        ],
      ],
    );
  }
}

class ConstructionToolTile extends StatelessWidget {
  const ConstructionToolTile({super.key, required this.tool, this.onTap});

  final ConstructionTool tool;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      elevation: AppElevation.level1,
      shadowColor: AppColors.shadow,
      borderRadius: AppRadius.lgAll,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.space3),
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
                  color: AppColors.primaryContainer,
                  borderRadius: AppRadius.mdAll,
                ),
                child: Icon(
                  appIcon(tool.icon),
                  color: AppColors.primary,
                  size: AppSpacing.space5,
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tool.title, style: theme.textTheme.titleSmall),
                    Text(tool.subtitle, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.outlineVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
