import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/core/network/dio_provider.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/softphone/data/models/softphone_config.dart';
import 'package:vsp_voip_mobile/features/softphone/data/softphone_api.dart';

final softphoneApiProvider = Provider<SoftphoneApi>((ref) {
  return SoftphoneApi(ref.watch(dioProvider));
});

class SoftphoneRepository {
  SoftphoneRepository(this._api);

  final SoftphoneApi _api;

  Future<SoftphoneConfig> getConfig() async {
    try {
      return await _api.getConfig();
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<SoftphoneTokenResponse> createToken() async {
    try {
      return await _api.createToken();
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<void> setPresence({required bool online}) async {
    try {
      await _api.setPresence(online: online);
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<void> logCall({
    String? callSid,
    required String from,
    required String to,
    String status = 'completed',
    String direction = 'outbound',
    int? durationSeconds,
  }) async {
    try {
      await _api.logCall(
        callSid: callSid,
        from: from,
        to: to,
        status: status,
        direction: direction,
        durationSeconds: durationSeconds,
      );
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<void> registerPushToken({
    required String token,
    required String platform,
    required String deviceId,
    String? deviceName,
    String? appVersion,
  }) async {
    try {
      await _api.registerPushToken(
        token: token,
        platform: platform,
        deviceId: deviceId,
        deviceName: deviceName,
        appVersion: appVersion,
      );
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<void> unregisterDevice(String deviceId) async {
    try {
      await _api.unregisterDevice(deviceId);
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<bool> startRecording({
    required String callControlId,
    required String from,
    required String to,
  }) async {
    try {
      return await _api.startRecording(
        callControlId: callControlId,
        from: from,
        to: to,
      );
    } catch (error) {
      throw mapDioError(error);
    }
  }
}

final softphoneRepositoryProvider = Provider<SoftphoneRepository>((ref) {
  return SoftphoneRepository(ref.watch(softphoneApiProvider));
});
