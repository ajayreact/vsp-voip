import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  TokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _tokenKey = 'vsp_access_token';

  /// In-memory cache avoids a race where tab screens fire API calls before
  /// secure storage finishes persisting a token right after login.
  String? _cachedToken;

  Future<String?> readToken() async {
    if (_cachedToken != null && _cachedToken!.isNotEmpty) {
      return _cachedToken;
    }
    final stored = await _storage.read(key: _tokenKey);
    if (stored != null && stored.isNotEmpty) {
      _cachedToken = stored;
    }
    return stored;
  }

  Future<void> writeToken(String token) async {
    _cachedToken = token;
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<void> deleteToken() async {
    _cachedToken = null;
    await _storage.delete(key: _tokenKey);
  }
}
