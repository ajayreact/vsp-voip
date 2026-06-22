import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/core/network/dio_provider.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/recordings/data/models/call_recording.dart';
import 'package:vsp_voip_mobile/features/recordings/data/recordings_api.dart';

final recordingsApiProvider = Provider<RecordingsApi>((ref) {
  return RecordingsApi(ref.watch(dioProvider));
});

class RecordingsRepository {
  RecordingsRepository(this._api);

  final RecordingsApi _api;

  Future<List<CallRecording>> getRecordings({int limit = 50}) async {
    try {
      final response = await _api.getRecordings(limit: limit);
      return response.recordings;
    } catch (error) {
      throw mapDioError(error);
    }
  }
}

final recordingsRepositoryProvider = Provider<RecordingsRepository>((ref) {
  return RecordingsRepository(ref.watch(recordingsApiProvider));
});

final recordingsProvider =
    AsyncNotifierProvider<RecordingsController, List<CallRecording>>(
  RecordingsController.new,
);

class RecordingsController extends AsyncNotifier<List<CallRecording>> {
  @override
  Future<List<CallRecording>> build() async {
    return ref.read(recordingsRepositoryProvider).getRecordings();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(recordingsRepositoryProvider).getRecordings();
    });
  }
}
