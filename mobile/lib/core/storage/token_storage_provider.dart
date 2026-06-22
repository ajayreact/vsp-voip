import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:vsp_voip_mobile/core/storage/extension_config_storage.dart';
import 'package:vsp_voip_mobile/core/storage/token_storage.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final extensionConfigStorageProvider = Provider<ExtensionConfigStorage>((ref) {
  return ExtensionConfigStorage(
    const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  );
});