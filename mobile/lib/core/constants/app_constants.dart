abstract final class AppConstants {
  static const String appName = 'BuildMate 24x7';
  static const String appNameLead = 'BuildMate';
  static const String appNameTail = ' 24x7';
  static const String appLogoAsset = 'assets/images/branding/AppLogo.png';

  /// Store listing URL for referral share messages — replace when published.
  static const String appDownloadLink =
      'https://play.google.com/store/apps/details?id=com.buildmate.customerapp';

  /// Home FAB + `/ai-assistant` route — off until the assistant is implemented.
  static const bool aiAssistantEnabled = false;

  static const String appVersion = 'v1.0.0';
  static const String taglinePrefix = 'Everything for Construction.';
  static const String taglineEmphasis = 'One Trusted Platform.';

  static const Duration splashDuration = Duration(milliseconds: 2200);

  static const int otpLength = 6;
  static const int otpResendSeconds = 60;
}
