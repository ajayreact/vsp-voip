/// API base URL — override at run time:
/// flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
}
