import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../catalog/domain/models/catalog_models.dart';

class HomeGreeting extends StatelessWidget {
  const HomeGreeting({super.key, required this.user});

  final AppUserProfile user;

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(_greeting, style: theme.textTheme.bodyMedium),
        const SizedBox(height: AppSpacing.space1),
        Text(
          '${user.name} 👋',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.onBackground,
          ),
        ),
        const SizedBox(height: AppSpacing.space1),
        Text(
          'What are you looking for today?',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}
