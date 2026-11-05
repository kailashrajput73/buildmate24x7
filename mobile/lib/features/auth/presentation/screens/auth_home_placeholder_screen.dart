import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

/// Temporary authenticated destination until the dashboard is implemented.
class AuthHomePlaceholderScreen extends StatelessWidget {
  const AuthHomePlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.space8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.space6),
              Container(
                width: AppSpacing.space16,
                height: AppSpacing.space16,
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer,
                  borderRadius: AppRadius.xlAll,
                ),
                child: const Icon(
                  Icons.verified_user_rounded,
                  size: AppSpacing.space8,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: AppSpacing.space6),
              Text(
                'You are signed in',
                style: theme.textTheme.headlineMedium,
              ),
              const SizedBox(height: AppSpacing.space2),
              Text(
                'Authentication succeeded. The home dashboard will replace this placeholder in a later step.',
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.space8),
              Container(
                padding: const EdgeInsets.all(AppSpacing.space4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(color: AppColors.outlineVariant),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppConstants.appName,
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: AppSpacing.space2),
                    Text(
                      'Route: ${AppRoutes.homePlaceholder}',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: () async {
                  await context.read<SessionController>().logout();
                  if (!context.mounted) return;
                  Navigator.of(context, rootNavigator: true)
                      .pushNamedAndRemoveUntil(
                    AppRoutes.login,
                    (_) => false,
                  );
                },
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Sign out'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
