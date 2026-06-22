import 'package:dio/dio.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/dashboard/data/models/dashboard_stats.dart';

class DashboardApi {
  DashboardApi(this._dio);

  final Dio _dio;

  Future<DashboardStats> getStats() async {
    final response =
        await _dio.get<Map<String, dynamic>>(ApiPaths.dashboardStats);
    return parseData(response, DashboardStats.fromJson);
  }
}
