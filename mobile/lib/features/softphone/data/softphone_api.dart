import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/softphone/data/models/softphone_config.dart';

class SoftphoneApi {
  SoftphoneApi(this._dio);

  final Dio _dio;

  Future<SoftphoneConfig> getConfig() async {
    final response =
        await _dio.get<Map<String, dynamic>>(ApiPaths.softphoneConfig);
    return parseData(response, SoftphoneConfig.fromJson);
  }

  Future<SoftphoneTokenResponse> createToken() async {
    final response =
        await _dio.post<Map<String, dynamic>>(ApiPaths.softphoneToken);
    return parseData(response, SoftphoneTokenResponse.fromJson);
  }

  Future<void> setPresence({required bool online}) async {
    await _dio.post<Map<String, dynamic>>(
      ApiPaths.softphonePresence,
      data: {'online': online},
    );
  }

  Future<void> logCall({
    String? callSid,
    required String from,
    required String to,
    String status = 'completed',
    String direction = 'outbound',
    int? durationSeconds,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      ApiPaths.softphoneCallLog,
      data: {
        if (callSid != null) 'callSid': callSid,
        'from': from,
        'to': to,
        'status': status,
        'direction': direction,
        if (durationSeconds != null) 'durationSeconds': durationSeconds,
      },
    );
  }

  Future<void> registerPushToken({
    required String token,
    required String platform,
    required String deviceId,
    String? deviceName,
    String? appVersion,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      ApiPaths.softphonePushToken,
      data: {
        'token': token,
        'platform': platform,
        'deviceId': deviceId,
        if (deviceName != null) 'deviceName': deviceName,
        if (appVersion != null) 'appVersion': appVersion,
      },
    );
  }

  Future<void> unregisterDevice(String deviceId) async {
    await _dio.delete<Map<String, dynamic>>(
      ApiPaths.softphoneDevice(deviceId),
    );
  }

  Future<bool> startRecording({
    required String callControlId,
    required String from,
    required String to,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiPaths.softphoneRecordStart,
      data: {
        'callControlId': callControlId,
        'from': from,
        'to': to,
      },
    );
    final data = response.data;
    return data?['started'] as bool? ?? data?['success'] as bool? ?? false;
  }
}
