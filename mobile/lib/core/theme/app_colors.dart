import 'package:flutter/material.dart';

/// Shivani Constructions color tokens — single source of truth.
///
/// Do not introduce arbitrary colors in widgets. Use these tokens
/// (or [ThemeData.colorScheme] derived from them) instead.
abstract final class AppColors {
  // ── Primary (Brand Blue) ──────────────────────────────────────────────
  static const Color primary = Color(0xFF1A56DB);
  static const Color primaryContainer = Color(0xFFD6E4FF);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color onPrimaryContainer = Color(0xFF001B4D);
  static const Color primaryPressed = Color(0xFF1246BE);
  /// Selected-state fill for sidebar rows — a touch darker than
  /// [primaryContainer] so the active item reads clearly against it.
  static const Color primarySidebarSelected = Color(0xFFBFD3F7);

  // ── Secondary (Amber Accent) ──────────────────────────────────────────
  static const Color secondary = Color(0xFFD97706);
  static const Color secondaryContainer = Color(0xFFFFECD0);
  static const Color onSecondary = Color(0xFFFFFFFF);
  static const Color onSecondaryContainer = Color(0xFF3D2000);

  // ── Tertiary (Emerald) ────────────────────────────────────────────────
  static const Color tertiary = Color(0xFF059669);
  static const Color tertiaryContainer = Color(0xFFCCFCE7);
  static const Color onTertiary = Color(0xFFFFFFFF);
  static const Color onTertiaryContainer = Color(0xFF002B1A);

  // ── Accent (Catalog CTA Green) ──────────────────────────────────────────
  // Single source for the "ADD" / "Add to Cart" / selected-state green used
  // across the pipes & fittings catalog module. Reserved for actionable
  // controls only — do not reuse for informational text like discounts.
  static const Color accentGreen = Color(0xFF5FAF2E);
  static const Color accentGreenContainer = Color(0xFFD8EEBF);
  static const Color onAccentGreenContainer = Color(0xFF3D7A1A);

  // ── Semantic / status ─────────────────────────────────────────────────
  static const Color error = Color(0xFFDC2626);
  static const Color errorContainer = Color(0xFFFFE0E0);
  static const Color onError = Color(0xFFFFFFFF);

  static const Color success = Color(0xFF16A34A);
  static const Color successContainer = Color(0xFFDCFCE7);

  static const Color warning = Color(0xFFCA8A04);
  static const Color warningContainer = Color(0xFFFEF9C3);

  static const Color info = Color(0xFF0369A1);
  static const Color infoContainer = Color(0xFFE0F2FE);

  // ── Surface / neutrals ────────────────────────────────────────────────
  static const Color background = Color(0xFFF8FAFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFE8EDF8);
  static const Color surfaceContainer = Color(0xFFF1F3FA);
  static const Color onBackground = Color(0xFF181C24);
  static const Color onSurface = Color(0xFF181C24);
  static const Color onSurfaceVariant = Color(0xFF44484F);

  static const Color outline = Color(0xFF74777F);
  static const Color outlineVariant = Color(0xFFC4C7CF);
  static const Color divider = Color(0xFFE2E5EC);

  static const Color disabled = Color(0xFFBBBEC7);
  static const Color disabledContainer = Color(0xFFF2F3F7);

  static const Color shadow = Color(0x1A000000);
}
