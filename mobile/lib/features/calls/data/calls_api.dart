import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/calls/data/models/call_log.dart';

class CallsApi {
  CallsApi(this._dio);

  final Dio _dio;

  Future<CallHistoryResponse> getCalls({int limit = 50}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiPaths.calls,
      queryParameters: {'limit': limit},
    );
    return parseData(response, CallHistoryResponse.fromJson);
  }
}
