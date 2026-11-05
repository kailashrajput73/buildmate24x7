import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigate();
  }

  Future<void> _navigate() async {
    final session = context.read<SessionController>();
    await Future<void>.delayed(AppConstants.splashDuration);
    await session.restore();
    if (!mounted) return;

    final nextRoute = session.isLoggedIn
        ? AppRoutes.homePlaceholder
        : AppRoutes.login;

    Navigator.of(context).pushReplacementNamed(nextRoute);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space8,
            vertical: AppSpacing.space10,
          ),
          child: Column(
            children: [
              const Spacer(),
              Image.asset(
                AppConstants.appLogoAsset,
                width: 220,
                fit: BoxFit.contain,
              ),
              const SizedBox(height: AppSpacing.space2),
              Text.rich(
                TextSpan(
                  style: theme.textTheme.bodyMedium,
                  children: [
                    const TextSpan(text: '${AppConstants.taglinePrefix} '),
                    TextSpan(
                      text: AppConstants.taglineEmphasis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.onBackground,
                      ),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              const SizedBox(
                width: AppSpacing.space8,
                height: AppSpacing.space8,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: AppColors.primary,
                  backgroundColor: AppColors.primaryContainer,
                ),
              ),
              const SizedBox(height: AppSpacing.space4),
              Text(
                AppConstants.appVersion,
                style: AppTypography.labelSmallMono(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
