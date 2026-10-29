import 'package:flutter/material.dart';

import 'theme/app_colors.dart';
import 'theme/app_theme.dart';

export 'theme/app_colors.dart';
export 'theme/app_elevation.dart';
export 'theme/app_radius.dart';
export 'theme/app_spacing.dart';
export 'theme/app_typography.dart';

/// Short names used across the screens, mapped onto the design kit's tokens (theme/app_colors.dart):
/// brand blue #1A56DB, navy #1B2A47, flat white surfaces. Change colours in AppColors, not here.
class BM {
  static const ink = AppColors.onSurface;
  static const inkSoft = AppColors.onSurfaceVariant;
  static const inkFaint = AppColors.outline;
  static const pipe = AppColors.primary;
  static const pipeDark = Color(0xFF1B2A47); // navy header
  static const pipeLight = AppColors.primaryContainer;
  static const leaf = AppColors.success;
  static const leafLight = AppColors.successContainer;
  static const green = AppColors.accentGreen; // "ADD" / add-to-cart
  static const greenLight = AppColors.accentGreenContainer;
  static const tape = AppColors.secondary;
  static const tapeLight = AppColors.secondaryContainer;
  static const brick = AppColors.error;
  static const line = AppColors.divider;
  static const paper = AppColors.surfaceContainer;
}

ThemeData buildTheme() {
  final t = AppTheme.light();
  // Inner screens use white app bars with a medium title, as in the kit's catalogue and cart screens.
  return t.copyWith(
    appBarTheme: t.appBarTheme.copyWith(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: t.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      shape: const Border(bottom: BorderSide(color: AppColors.divider)),
    ),
  );
}
