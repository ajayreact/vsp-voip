import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/core/network/dio_provider.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/calls/data/calls_api.dart';
import 'package:vsp_voip_mobile/features/calls/data/models/call_log.dart';

final callsApiProvider = Provider<CallsApi>((ref) {
  return CallsApi(ref.watch(dioProvider));
});

class CallsRepository {
  CallsRepository(this._api);

  final CallsApi _api;

  Future<List<CallLogEntry>> getCalls({int limit = 50}) async {
    try {
      final response = await _api.getCalls(limit: limit);
      return response.calls;
    } catch (error) {
      throw mapDioError(error);
    }
  }
}

final callsRepositoryProvider = Provider<CallsRepository>((ref) {
  return CallsRepository(ref.watch(callsApiProvider));
});

final callHistoryProvider =
    AsyncNotifierProvider<CallHistoryController, List<CallLogEntry>>(
  CallHistoryController.new,
);

class CallHistoryController extends AsyncNotifier<List<CallLogEntry>> {
  @override
  Future<List<CallLogEntry>> build() async {
    return ref.read(callsRepositoryProvider).getCalls();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(callsRepositoryProvider).getCalls();
    });
  }
}
