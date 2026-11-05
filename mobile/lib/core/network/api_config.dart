/// Central API configuration for the customer mobile app.
///
/// Source of truth: the ASP.NET Core API under `api/src/BuildMate.Api`.
///
/// Configure at build/run time (optional override):
/// `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000`
///
/// Production default: [defaultBaseUrl]. For a local Android API, use
/// `http://10.0.2.2:<port>`; for Flutter Web, use the local same-origin proxy.
///
abstract final class ApiConfig {
  static const String defaultBaseUrl = 'https://api.buildmate24x7.com';

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: defaultBaseUrl,
  );

  static const String apiPrefix = '/api';

  static String get catalogUrl => '$baseUrl$apiPrefix/catalog/products';

  /// Background catalog refresh while the app is open (avoid hammering the API).
  static const Duration catalogPollInterval = Duration(seconds: 45);
}
