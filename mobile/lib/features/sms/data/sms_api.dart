import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/sms/data/models/sms_models.dart';

class SmsApi {
  SmsApi(this._dio);

  final Dio _dio;

  Future<SmsConversationsResponse> getConversations() async {
    final response =
        await _dio.get<Map<String, dynamic>>(ApiPaths.smsConversations);
    return parseData(response, SmsConversationsResponse.fromJson);
  }

  Future<SmsMessagesResponse> getMessages({
    required String peer,
    required String line,
    int limit = 200,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiPaths.smsMessages,
      queryParameters: {
        'peer': peer,
        'line': line,
        'limit': limit,
      },
    );
    return parseData(response, SmsMessagesResponse.fromJson);
  }
}
