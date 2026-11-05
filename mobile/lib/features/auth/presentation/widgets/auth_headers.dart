import 'package:flutter/material.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

class AuthBrandHeader extends StatelessWidget {
  const AuthBrandHeader({
    super.key,
    this.showIcon = true,
  });

  final bool showIcon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (showIcon) ...[
          Container(
            width: AppSpacing.space10,
            height: AppSpacing.space10,
            padding: const EdgeInsets.all(AppSpacing.space1),
            decoration: BoxDecoration(
              color: AppColors.primaryContainer,
              borderRadius: AppRadius.smAll,
            ),
            child: Image.asset(
              AppConstants.appLogoAsset,
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(width: AppSpacing.space3),
        ],
        Text(
          AppConstants.appName,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: AppColors.primary,
              ),
        ),
      ],
    );
  }
}

class AuthPageHeader extends StatelessWidget {
  const AuthPageHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.onBack,
    this.leadingIcon,
  });

  final String title;
  final String subtitle;
  final VoidCallback? onBack;
  final IconData? leadingIcon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (onBack != null || leadingIcon != null)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.space6),
            child: leadingIcon != null
                ? Container(
                    width: AppSpacing.space16,
                    height: AppSpacing.space16,
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer,
                      borderRadius: AppRadius.xlAll,
                    ),
                    child: Icon(
                      leadingIcon,
                      size: AppSpacing.space8,
                      color: AppColors.primary,
                    ),
                  )
                : IconButton(
                    onPressed: onBack,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    icon: const Icon(Icons.arrow_back_rounded, size: AppSpacing.space6),
                  ),
          ),
        Text(title, style: theme.textTheme.headlineMedium),
        const SizedBox(height: AppSpacing.space2),
        Text(subtitle, style: theme.textTheme.bodyMedium),
      ],
    );
  }
}

class AuthTopAccentBar extends StatelessWidget {
  const AuthTopAccentBar({super.key});

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: AppColors.primary,
      child: SizedBox(height: AppSpacing.space2, width: double.infinity),
    );
  }
}

class AuthOrDivider extends StatelessWidget {
  const AuthOrDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: AppColors.divider, height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space3),
          child: Text(
            'OR',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppColors.outline,
                ),
          ),
        ),
        const Expanded(child: Divider(color: AppColors.divider, height: 1)),
      ],
    );
  }
}
