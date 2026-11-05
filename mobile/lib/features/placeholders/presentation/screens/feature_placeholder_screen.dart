import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

/// Lightweight placeholder for screens not yet implemented.
class FeaturePlaceholderScreen extends StatelessWidget {
  const FeaturePlaceholderScreen({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.showSignOut = false,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool showSignOut;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space6),
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
              child: Icon(icon, size: AppSpacing.space8, color: AppColors.primary),
            ),
            const SizedBox(height: AppSpacing.space6),
            Text(title, style: theme.textTheme.headlineSmall),
            const SizedBox(height: AppSpacing.space2),
            Text(subtitle, style: theme.textTheme.bodyMedium),
            const Spacer(),
            if (showSignOut)
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
    );
  }
}

/// Standalone placeholder used when pushed as a named route (outside shell tabs).
class StandalonePlaceholderScreen extends StatelessWidget {
  const StandalonePlaceholderScreen({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: AppColors.surface,
      ),
      body: FeaturePlaceholderScreen(
        title: title,
        subtitle: subtitle,
        icon: icon,
      ),
    );
  }
}
