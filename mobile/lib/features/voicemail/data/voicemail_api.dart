import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/voicemail/data/models/voicemail_message.dart';

class VoicemailApi {
  VoicemailApi(this._dio);

  final Dio _dio;

  Future<VoicemailListResponse> getVoicemails({int limit = 50}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiPaths.tenantVoicemails,
      queryParameters: {'limit': limit},
    );
    return parseData(response, VoicemailListResponse.fromJson);
  }

  Future<void> markRead(String id) async {
    await _dio.patch<Map<String, dynamic>>(ApiPaths.tenantVoicemailRead(id));
  }
}
