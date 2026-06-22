import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/core/network/dio_provider.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/profile/data/models/tenant_profile.dart';
import 'package:vsp_voip_mobile/features/profile/data/profile_api.dart';

final profileApiProvider = Provider<ProfileApi>((ref) {
  return ProfileApi(ref.watch(dioProvider));
});

class ProfileRepository {
  ProfileRepository(this._api);

  final ProfileApi _api;

  Future<TenantProfile> getTenantProfile() async {
    try {
      return await _api.getTenantProfile();
    } catch (error) {
      throw mapDioError(error);
    }
  }
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.watch(profileApiProvider));
});

final tenantProfileProvider =
    AsyncNotifierProvider<TenantProfileController, TenantProfile?>(
  TenantProfileController.new,
);

class TenantProfileController extends AsyncNotifier<TenantProfile?> {
  @override
  Future<TenantProfile?> build() async {
    try {
      return await ref.read(profileRepositoryProvider).getTenantProfile();
    } catch (error) {
      final mapped = mapDioError(error);
      if (mapped.statusCode == 403) return null;
      rethrow;
    }
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      try {
        return await ref.read(profileRepositoryProvider).getTenantProfile();
      } catch (error) {
        final mapped = mapDioError(error);
        if (mapped.statusCode == 403) return null;
        rethrow;
      }
    });
  }
}
