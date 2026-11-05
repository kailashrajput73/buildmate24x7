/// Central API configuration for the customer mobile app.
///
/// **Source of truth:** `dashboard/backend/server.py` (restore-brand-imports branch),
/// NOT the standalone `Python-API` repo which only exposes a legacy catalog schema
/// (`name`, `category`, `unit`, `standardRate`).
///
/// Configure at build/run time (optional override):
/// `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000`
///
/// Production default: [defaultBaseUrl]. Local dev: emulator → `http://10.0.2.2:8000`.
///
abstract final class ApiConfig {
  static const String defaultBaseUrl = 'https://dash.buildmate24x7.com';

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: defaultBaseUrl,
  );

  static const String apiPrefix = '/api';

  static String get catalogUrl => '$baseUrl$apiPrefix/catalog';

  /// Background catalog refresh while the app is open (avoid hammering the API).
  static const Duration catalogPollInterval = Duration(seconds: 45);
}
