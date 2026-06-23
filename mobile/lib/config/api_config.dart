/// Production API base URL. Override at build/run time if needed:
/// flutter run --dart-define=API_BASE_URL=https://api.vspphone.com
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.vspphone.com',
  );
}
