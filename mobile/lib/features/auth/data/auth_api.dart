import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/auth/data/models/user.dart';

class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  Future<LoginResponse> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiPaths.authLogin,
      data: {'email': email, 'password': password},
    );
    return parseData(response, LoginResponse.fromJson);
  }

  Future<User> getMe() async {
    final response = await _dio.get<Map<String, dynamic>>(ApiPaths.authMe);
    return parseData(response, User.fromJson);
  }
}
