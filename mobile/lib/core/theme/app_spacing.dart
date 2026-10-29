/// 8-point spacing scale — single source of truth.
///
/// Prefer these tokens over arbitrary pixel values in layouts.
abstract final class AppSpacing {
  static const double space1 = 4;
  static const double space2 = 8;
  static const double space3 = 12;
  static const double space4 = 16;
  static const double space5 = 20;
  static const double space6 = 24;
  static const double space8 = 32;
  static const double space10 = 40;
  static const double space12 = 48;
  static const double space14 = 56;
  static const double space16 = 64;

  /// Shared control heights (component sizing, not spacing scale).
  static const double buttonHeight = 52;
  static const double inputHeight = 56;
  static const double otpBoxHeight = 56;
}
