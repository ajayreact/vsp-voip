import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/profile/data/models/tenant_profile.dart';

class ProfileApi {
  ProfileApi(this._dio);

  final Dio _dio;

  Future<TenantProfile> getTenantProfile() async {
    final response =
        await _dio.get<Map<String, dynamic>>(ApiPaths.tenantProfile);
    final parsed = parseData(response, TenantProfileResponse.fromJson);
    return parsed.profile;
  }
}
