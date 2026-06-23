import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/core/device/device_install_service.dart';
import 'package:vsp_voip_mobile/core/network/dio_provider.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/core/storage/extension_config_storage.dart';
import 'package:vsp_voip_mobile/core/storage/token_storage.dart';
import 'package:vsp_voip_mobile/core/storage/token_storage_provider.dart';
import 'package:vsp_voip_mobile/features/auth/data/auth_api.dart';
import 'package:vsp_voip_mobile/features/auth/data/models/user.dart';
import 'package:vsp_voip_mobile/features/auth/data/provision_api.dart';
import 'package:vsp_voip_mobile/features/calls/providers/calls_providers.dart';
import 'package:vsp_voip_mobile/features/dashboard/providers/dashboard_providers.dart';
import 'package:vsp_voip_mobile/features/profile/providers/profile_providers.dart';
import 'package:vsp_voip_mobile/features/recordings/providers/recordings_providers.dart';
import 'package:vsp_voip_mobile/features/softphone/providers/softphone_controller.dart';

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(dioProvider));
});

final provisionApiProvider = Provider<ProvisionApi>((ref) {
  return ProvisionApi(ref.watch(dioProvider));
});

class AuthRepository {
  AuthRepository(
    this._api,
    this._provisionApi,
    this._tokenStorage,
    this._extensionConfigStorage,
  );

  final AuthApi _api;
  final ProvisionApi _provisionApi;
  final TokenStorage _tokenStorage;
  final ExtensionConfigStorage _extensionConfigStorage;

  Future<User> login(String email, String password) async {
    try {
      final response = await _api.login(email: email, password: password);
      await _tokenStorage.writeToken(response.accessToken);
      return response.user;
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<User> provisionFromQr(String token) async {
    try {
      final deviceId = await DeviceInstallService.deviceId();
      final deviceName = await DeviceInstallService.deviceName();
      final appVersion = await DeviceInstallService.appVersion();
      final response = await _provisionApi.redeemToken(
        token: token,
        deviceId: deviceId,
        platform: 'mobile',
        deviceName: deviceName,
        appVersion: appVersion,
      );
      await _tokenStorage.writeToken(response.accessToken);
      await _extensionConfigStorage.writeProvisionResult(response);
      return response.user;
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<User> getMe() async {
    try {
      return await _api.getMe();
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<void> logout() async {
    await _extensionConfigStorage.clear();
    await _tokenStorage.deleteToken();
  }

  Future<bool> hasStoredToken() async {
    final token = await _tokenStorage.readToken();
    return token != null && token.isNotEmpty;
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(authApiProvider),
    ref.watch(provisionApiProvider),
    ref.watch(tokenStorageProvider),
    ref.watch(extensionConfigStorageProvider),
  );
});

class AuthController extends AsyncNotifier<User?> {
  @override
  Future<User?> build() async {
    final repository = ref.read(authRepositoryProvider);
    final hasToken = await repository.hasStoredToken();
    if (!hasToken) return null;

    try {
      return await repository.getMe();
    } catch (_) {
      await repository.logout();
      return null;
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(authRepositoryProvider).login(email, password);
    });
    if (state.hasError) throw state.error!;
    _refreshAuthenticatedData();
  }

  Future<void> provisionFromQr(String token) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(authRepositoryProvider).provisionFromQr(token);
    });
    if (state.hasError) throw state.error!;
    _refreshAuthenticatedData();
  }

  void _refreshAuthenticatedData() {
    ref.invalidate(dashboardStatsProvider);
    ref.invalidate(callHistoryProvider);
    ref.invalidate(recordingsProvider);
    ref.invalidate(tenantProfileProvider);
  }

  Future<void> logout() async {
    await ref.read(softphoneControllerProvider.notifier).disconnect();
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }

  Future<void> refreshProfile() async {
    final current = state.asData?.value;
    if (current == null) return;

    state = await AsyncValue.guard(() async {
      return ref.read(authRepositoryProvider).getMe();
    });
  }
}

final authControllerProvider =
    AsyncNotifierProvider<AuthController, User?>(AuthController.new);
