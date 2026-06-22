import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/core/network/dio_provider.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/dashboard/data/dashboard_api.dart';
import 'package:vsp_voip_mobile/features/dashboard/data/models/dashboard_stats.dart';

final dashboardApiProvider = Provider<DashboardApi>((ref) {
  return DashboardApi(ref.watch(dioProvider));
});

class DashboardRepository {
  DashboardRepository(this._api);

  final DashboardApi _api;

  Future<DashboardStats> getStats() async {
    try {
      return await _api.getStats();
    } catch (error) {
      throw mapDioError(error);
    }
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepository(ref.watch(dashboardApiProvider));
});

final dashboardStatsProvider =
    AsyncNotifierProvider<DashboardStatsController, DashboardStats>(
  DashboardStatsController.new,
);

class DashboardStatsController extends AsyncNotifier<DashboardStats> {
  @override
  Future<DashboardStats> build() async {
    return ref.read(dashboardRepositoryProvider).getStats();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(dashboardRepositoryProvider).getStats();
    });
  }
}
