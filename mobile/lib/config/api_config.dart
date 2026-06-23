/// Production API base URL. Override at build/run time if needed:
/// flutter run --dart-define=API_BASE_URL=http://vspphone.com:3000
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://vspphone.com:3000',
  );
}
