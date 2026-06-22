import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/auth/data/models/provision_response.dart';

class ProvisionApi {
  ProvisionApi(this._dio);

  final Dio _dio;

  Future<ProvisionResponse> redeemToken({
    required String token,
    required String deviceId,
    required String platform,
    String? deviceName,
    String? appVersion,
    String? pushToken,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiPaths.mobileProvision,
      data: {
        'token': token,
        'deviceId': deviceId,
        'platform': platform,
        if (deviceName != null) 'deviceName': deviceName,
        if (appVersion != null) 'appVersion': appVersion,
        if (pushToken != null) 'pushToken': pushToken,
      },
    );
    return parseData(response, ProvisionResponse.fromJson);
  }
}
