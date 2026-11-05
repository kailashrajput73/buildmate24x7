import 'package:share_plus/share_plus.dart';

import '../../../core/constants/app_constants.dart';

/// Opens the platform share sheet with the user's referral code.
Future<void> shareReferralCode(String referralCode) async {
  final code = referralCode.trim();
  if (code.isEmpty) return;

  final message =
      'Join me on ${AppConstants.appName} and earn rewards! '
      'Use my referral code: $code\n'
      'Download the app: ${AppConstants.appDownloadLink}';

  try {
    await Share.share(message);
  } catch (_) {
    // Share cancelled, unavailable, or failed — do not crash.
  }
}
