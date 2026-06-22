import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/recordings/data/models/call_recording.dart';

class RecordingsApi {
  RecordingsApi(this._dio);

  final Dio _dio;

  Future<RecordingsResponse> getRecordings({int limit = 50}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiPaths.tenantRecordings,
      queryParameters: {'limit': limit},
    );
    return parseData(response, RecordingsResponse.fromJson);
  }
}
