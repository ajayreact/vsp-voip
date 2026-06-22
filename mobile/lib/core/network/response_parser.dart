import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/errors/api_exception.dart';

ApiException mapDioError(Object error) {
  if (error is ApiException) return error;

  if (error is DioException) {
    final response = error.response;
    final data = response?.data;

    if (data is Map && data['error'] != null) {
      return ApiException(
        data['error'].toString(),
        statusCode: response?.statusCode,
      );
    }

    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const ApiException('Request timed out');
    }

    if (error.type == DioExceptionType.connectionError) {
      return const ApiException('Cannot reach the API server');
    }

    final raw = response?.data;
    if (raw is String &&
        (raw.contains('ngrok') || raw.contains('<!DOCTYPE html>'))) {
      return const ApiException(
        'API returned an HTML page instead of JSON. '
        'Ensure ngrok is running (ngrok http 3000) and the API server is up.',
      );
    }

    return ApiException(
      'Request failed (${response?.statusCode ?? 'unknown'})',
      statusCode: response?.statusCode,
    );
  }

  return ApiException(error.toString());
}

T parseData<T>(
  Response<dynamic> response,
  T Function(Map<String, dynamic> json) fromJson,
) {
  final data = response.data;
  if (data is! Map<String, dynamic>) {
    throw const ApiException('Unexpected response format');
  }
  return fromJson(data);
}

List<T> parseList<T>(
  dynamic value,
  T Function(Map<String, dynamic> json) fromJson,
) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((item) => fromJson(Map<String, dynamic>.from(item)))
      .toList();
}
