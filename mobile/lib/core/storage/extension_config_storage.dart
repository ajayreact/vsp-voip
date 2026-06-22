import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:vsp_voip_mobile/features/auth/data/models/provision_response.dart';

class ExtensionConfigStorage {
  ExtensionConfigStorage(this._storage);

  static const _configKey = 'vsp_extension_config';
  static const _telephonyKey = 'vsp_extension_telephony';

  final FlutterSecureStorage _storage;

  Future<void> writeProvisionResult(ProvisionResponse response) async {
    await _storage.write(
      key: _configKey,
      value: jsonEncode(response.extension.toJson()),
    );
    if (response.telephony != null) {
      await _storage.write(
        key: _telephonyKey,
        value: jsonEncode({
          'loginToken': response.telephony!.loginToken,
          'sipUsername': response.telephony!.sipUsername,
          'credentialId': response.telephony!.credentialId,
          'expiresInSeconds': response.telephony!.expiresInSeconds,
        }),
      );
    }
  }

  Future<ProvisionExtensionConfig?> readExtensionConfig() async {
    final raw = await _storage.read(key: _configKey);
    if (raw == null || raw.isEmpty) return null;
    return ProvisionExtensionConfig.fromJson(
      Map<String, dynamic>.from(jsonDecode(raw) as Map),
    );
  }

  Future<void> clear() async {
    await _storage.delete(key: _configKey);
    await _storage.delete(key: _telephonyKey);
  }
}
