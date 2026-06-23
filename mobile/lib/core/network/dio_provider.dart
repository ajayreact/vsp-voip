import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/config/api_config.dart';
import 'package:vsp_voip_mobile/core/storage/token_storage_provider.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._ref);

  final Ref _ref;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _ref.read(tokenStorageProvider).readToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final alreadyRetried = err.requestOptions.extra['auth_retry'] == true;

    if (response?.statusCode == 401 &&
        !alreadyRetried &&
        !err.requestOptions.path.contains('/auth/login')) {
      final token = await _ref.read(tokenStorageProvider).readToken();
      if (token != null && token.isNotEmpty) {
        final retryOptions = err.requestOptions.copyWith(
          extra: {...err.requestOptions.extra, 'auth_retry': true},
          headers: {
            ...err.requestOptions.headers,
            'Authorization': 'Bearer $token',
          },
        );
        try {
          final retryDio = Dio(
            BaseOptions(
              baseUrl: retryOptions.baseUrl,
              connectTimeout: retryOptions.connectTimeout,
              receiveTimeout: retryOptions.receiveTimeout,
              headers: retryOptions.headers,
            ),
          );
          final retryResponse = await retryDio.fetch(retryOptions);
          handler.resolve(retryResponse);
          return;
        } catch (_) {
          // Fall through to original error.
        }
      }
    }

    handler.next(err);
  }
}

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      headers: const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    ),
  );

  dio.interceptors.add(AuthInterceptor(ref));
  return dio;
});
