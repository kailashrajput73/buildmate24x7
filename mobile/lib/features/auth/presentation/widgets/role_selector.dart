import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/models/auth_models.dart';

IconData roleIcon(UserRole role) {
  return switch (role) {
    UserRole.dealer => Icons.storefront_rounded,
    UserRole.builder => Icons.construction_rounded,
    UserRole.contractor => Icons.handyman_rounded,
    UserRole.individualCustomer => Icons.person_rounded,
  };
}

class RoleSelector extends StatelessWidget {
  const RoleSelector({
    super.key,
    required this.value,
    required this.onChanged,
    this.errorText,
  });

  final UserRole? value;
  final ValueChanged<UserRole> onChanged;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasError = errorText != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PopupMenuButton<UserRole>(
          onSelected: onChanged,
          offset: const Offset(0, AppSpacing.space2),
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.mdAll,
            side: const BorderSide(color: AppColors.outlineVariant, width: 1.5),
          ),
          color: AppColors.surface,
          itemBuilder: (context) => UserRole.values
              .map(
                (role) => PopupMenuItem(
                  value: role,
                  child: Row(
                    children: [
                      Icon(
                        roleIcon(role),
                        size: 18,
                        color: value == role
                            ? AppColors.primary
                            : AppColors.onSurfaceVariant,
                      ),
                      const SizedBox(width: AppSpacing.space3),
                      Expanded(
                        child: Text(
                          role.label,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: value == role
                                ? FontWeight.w600
                                : FontWeight.w400,
                            color: value == role
                                ? AppColors.primary
                                : AppColors.onSurface,
                          ),
                        ),
                      ),
                      if (value == role)
                        const Icon(
                          Icons.check_rounded,
                          size: AppSpacing.space4,
                          color: AppColors.primary,
                        ),
                    ],
                  ),
                ),
              )
              .toList(),
          child: Container(
            height: AppSpacing.inputHeight,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: AppRadius.mdAll,
              border: Border.all(
                color: hasError ? AppColors.error : AppColors.outlineVariant,
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.badge_rounded,
                  size: AppSpacing.space5,
                  color: hasError ? AppColors.error : AppColors.onSurfaceVariant,
                ),
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'I am a',
                        style: AppTypography.caption(
                          color: hasError
                              ? AppColors.error
                              : AppColors.onSurfaceVariant,
                        ).copyWith(fontWeight: FontWeight.w500),
                      ),
                      Text(
                        value?.label ?? 'Select your role',
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: value != null
                              ? AppColors.onSurface
                              : AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.expand_more_rounded,
                  color: AppColors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(
              top: AppSpacing.space1,
              left: AppSpacing.space1,
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.error_rounded,
                  size: 14,
                  color: AppColors.error,
                ),
                const SizedBox(width: AppSpacing.space1),
                Text(
                  errorText!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.error,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
