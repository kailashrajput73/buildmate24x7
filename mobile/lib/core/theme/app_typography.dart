import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Typography scale — single source of truth.
///
/// Use via [Theme.of(context).textTheme] for Material slots.
/// Use [AppTypography.caption] for caption text (not a Material TextTheme slot).
/// Use [AppTypography.labelSmallMono] for monospace labels (codes, versions).
abstract final class AppTypography {
  static TextTheme textTheme({Color? onSurface, Color? onSurfaceVariant}) {
    final ink = onSurface ?? AppColors.onSurface;
    final muted = onSurfaceVariant ?? AppColors.onSurfaceVariant;

    // Brand UI uses DM Sans for display/headline/title/label;
    // Inter for body — matching the Figma Material 3 system.
    final display = GoogleFonts.dmSansTextTheme();
    final body = GoogleFonts.interTextTheme();

    return body.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        fontSize: 57,
        fontWeight: FontWeight.w300,
        height: 64 / 57,
        letterSpacing: -0.25,
        color: ink,
      ),
      displayMedium: display.displayMedium?.copyWith(
        fontSize: 45,
        fontWeight: FontWeight.w400,
        height: 52 / 45,
        color: ink,
      ),
      displaySmall: display.displaySmall?.copyWith(
        fontSize: 36,
        fontWeight: FontWeight.w400,
        height: 44 / 36,
        color: ink,
      ),
      headlineLarge: display.headlineLarge?.copyWith(
        fontSize: 32,
        fontWeight: FontWeight.w600,
        height: 40 / 32,
        color: ink,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        fontSize: 28,
        fontWeight: FontWeight.w600,
        height: 36 / 28,
        color: ink,
      ),
      headlineSmall: display.headlineSmall?.copyWith(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        height: 32 / 24,
        color: ink,
      ),
      titleLarge: display.titleLarge?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w500,
        height: 28 / 22,
        color: ink,
      ),
      titleMedium: display.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        height: 24 / 16,
        letterSpacing: 0.15,
        color: ink,
      ),
      titleSmall: display.titleSmall?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        height: 20 / 14,
        letterSpacing: 0.1,
        color: ink,
      ),
      bodyLarge: body.bodyLarge?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 24 / 16,
        letterSpacing: 0.5,
        color: ink,
      ),
      bodyMedium: body.bodyMedium?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 20 / 14,
        letterSpacing: 0.25,
        color: muted,
      ),
      bodySmall: body.bodySmall?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 16 / 12,
        letterSpacing: 0.4,
        color: muted,
      ),
      labelLarge: display.labelLarge?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        height: 20 / 14,
        letterSpacing: 0.1,
        color: ink,
      ),
      labelMedium: display.labelMedium?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 16 / 12,
        letterSpacing: 0.5,
        color: muted,
      ),
      labelSmall: labelSmallMono(color: AppColors.outline),
    );
  }

  /// Caption — 11px Regular (design-system extension beyond Material slots).
  static TextStyle caption({Color? color}) {
    return GoogleFonts.inter(
      fontSize: 11,
      fontWeight: FontWeight.w400,
      height: 16 / 11,
      letterSpacing: 0.4,
      color: color ?? AppColors.onSurfaceVariant,
    );
  }

  /// Label Small Mono — 11px Medium monospace (codes, versions, refs).
  static TextStyle labelSmallMono({Color? color}) {
    return GoogleFonts.jetBrainsMono(
      fontSize: 11,
      fontWeight: FontWeight.w500,
      height: 16 / 11,
      letterSpacing: 0.5,
      color: color ?? AppColors.outline,
    );
  }
}

/// Convenient access to design-system caption via theme.
@immutable
class AppTextStyles extends ThemeExtension<AppTextStyles> {
  const AppTextStyles({
    required this.caption,
    required this.labelSmallMono,
  });

  final TextStyle caption;
  final TextStyle labelSmallMono;

  static AppTextStyles light() => AppTextStyles(
        caption: AppTypography.caption(),
        labelSmallMono: AppTypography.labelSmallMono(),
      );

  @override
  AppTextStyles copyWith({
    TextStyle? caption,
    TextStyle? labelSmallMono,
  }) {
    return AppTextStyles(
      caption: caption ?? this.caption,
      labelSmallMono: labelSmallMono ?? this.labelSmallMono,
    );
  }

  @override
  AppTextStyles lerp(ThemeExtension<AppTextStyles>? other, double t) {
    if (other is! AppTextStyles) return this;
    return AppTextStyles(
      caption: TextStyle.lerp(caption, other.caption, t) ?? caption,
      labelSmallMono:
          TextStyle.lerp(labelSmallMono, other.labelSmallMono, t) ??
              labelSmallMono,
    );
  }
}

extension AppTextStylesX on ThemeData {
  AppTextStyles get appTextStyles =>
      extension<AppTextStyles>() ?? AppTextStyles.light();
}
