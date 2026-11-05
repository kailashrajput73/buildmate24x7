import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.enabled = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final isEnabled = enabled && !loading && onPressed != null;

    return SizedBox(
      width: double.infinity,
      height: AppSpacing.buttonHeight,
      child: ElevatedButton(
        onPressed: isEnabled ? onPressed : null,
        style: ElevatedButton.styleFrom(
          backgroundColor:
              isEnabled ? AppColors.primary : AppColors.disabledContainer,
          foregroundColor:
              isEnabled ? AppColors.onPrimary : AppColors.disabled,
          elevation: isEnabled ? AppElevation.level1 : AppElevation.level0,
          shadowColor: AppColors.shadow,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        child: loading
            ? const SizedBox(
                width: AppSpacing.space5,
                height: AppSpacing.space5,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: AppColors.onPrimary,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: AppSpacing.space5),
                    const SizedBox(width: AppSpacing.space2),
                  ],
                  Text(label),
                ],
              ),
      ),
    );
  }
}
