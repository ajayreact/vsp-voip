import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/core/network/dio_provider.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/voicemail/data/models/voicemail_message.dart';
import 'package:vsp_voip_mobile/features/voicemail/data/voicemail_api.dart';

final voicemailApiProvider = Provider<VoicemailApi>((ref) {
  return VoicemailApi(ref.watch(dioProvider));
});

class VoicemailRepository {
  VoicemailRepository(this._api);

  final VoicemailApi _api;

  Future<List<VoicemailMessage>> getVoicemails({int limit = 50}) async {
    try {
      final response = await _api.getVoicemails(limit: limit);
      return response.voicemails;
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _api.markRead(id);
    } catch (error) {
      throw mapDioError(error);
    }
  }
}

final voicemailRepositoryProvider = Provider<VoicemailRepository>((ref) {
  return VoicemailRepository(ref.watch(voicemailApiProvider));
});

final voicemailProvider =
    AsyncNotifierProvider<VoicemailController, List<VoicemailMessage>>(
  VoicemailController.new,
);

class VoicemailController extends AsyncNotifier<List<VoicemailMessage>> {
  @override
  Future<List<VoicemailMessage>> build() async {
    return ref.read(voicemailRepositoryProvider).getVoicemails();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(voicemailRepositoryProvider).getVoicemails();
    });
  }

  Future<void> markRead(String id) async {
    await ref.read(voicemailRepositoryProvider).markRead(id);
    final current = state.asData?.value;
    if (current == null) return;
    state = AsyncData(
      current
          .map(
            (item) => item.id == id
                ? VoicemailMessage(
                    id: item.id,
                    from: item.from,
                    to: item.to,
                    recordingUrl: item.recordingUrl,
                    durationSeconds: item.durationSeconds,
                    isRead: true,
                    createdAt: item.createdAt,
                    callSid: item.callSid,
                    recordingSid: item.recordingSid,
                  )
                : item,
          )
          .toList(),
    );
  }
}
