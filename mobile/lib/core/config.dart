/// Build-time configuration. Pass with --dart-define, e.g.
///   flutter run --dart-define=API_URL=https://api.buildmate24x7.in --dart-define=CASHFREE_ENV=production
class AppConfig {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:5080');
  /// "sandbox" or "production". The API decides per order; this is the fallback.
  static const cashfreeEnv = String.fromEnvironment('CASHFREE_ENV', defaultValue: 'sandbox');
  static const appVersion = '1.0.0';

  /// localhost / 10.0.2.2 only work on a PC or the Android emulator, never on a real phone.
  static bool get isDeviceUnreachableUrl {
    final h = Uri.tryParse(apiUrl)?.host ?? '';
    return h == '10.0.2.2' || h == 'localhost' || h == '127.0.0.1' || h == '0.0.0.0';
  }

  /// Product/banner images may be relative ("/files/...") — make them absolute.
  static String imageUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http')) return path;
    return '$apiUrl$path';
  }
}
