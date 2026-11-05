import 'package:flutter/material.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../widgets/auth_primary_button.dart';
import '../widgets/password_success_illustration.dart';

class PasswordUpdatedScreen extends StatelessWidget {
  const PasswordUpdatedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.space8,
            AppSpacing.space8,
            AppSpacing.space8,
            AppSpacing.space14,
          ),
          child: Column(
            children: [
              const Spacer(),
              const PasswordSuccessIllustration(),
              Transform.translate(
                offset: const Offset(0, -AppSpacing.space4),
                child: Container(
                  width: AppSpacing.space16,
                  height: AppSpacing.space16,
                  decoration: BoxDecoration(
                    color: AppColors.tertiaryContainer,
                    borderRadius: AppRadius.xlAll,
                  ),
                  child: const Icon(
                    Icons.check_circle_rounded,
                    size: AppSpacing.space8,
                    color: AppColors.tertiary,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.space2),
              Text(
                'Password Updated\nSuccessfully',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineMedium,
              ),
              const SizedBox(height: AppSpacing.space3),
              Text(
                'Your password has been changed successfully. You can now sign in with your new password.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.space10),
              AuthPrimaryButton(
                label: 'Go to Login',
                icon: Icons.login_rounded,
                onPressed: () {
                  Navigator.of(context).pushNamedAndRemoveUntil(
                    AppRoutes.login,
                    (_) => false,
                  );
                },
              ),
              const SizedBox(height: AppSpacing.space5),
              Text(
                'SHIVANI CONSTRUCTIONS · SECURE ✓',
                style: AppTypography.labelSmallMono(),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
