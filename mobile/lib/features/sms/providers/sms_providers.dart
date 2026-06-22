import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/core/network/dio_provider.dart';
import 'package:vsp_voip_mobile/core/network/response_parser.dart';
import 'package:vsp_voip_mobile/features/sms/data/models/sms_models.dart';
import 'package:vsp_voip_mobile/features/sms/data/sms_api.dart';

final smsApiProvider = Provider<SmsApi>((ref) {
  return SmsApi(ref.watch(dioProvider));
});

class SmsRepository {
  SmsRepository(this._api);

  final SmsApi _api;

  Future<List<SmsConversation>> getConversations() async {
    try {
      final response = await _api.getConversations();
      return response.conversations;
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<List<SmsMessage>> getMessages({
    required String peer,
    required String line,
  }) async {
    try {
      final response = await _api.getMessages(peer: peer, line: line);
      return response.messages;
    } catch (error) {
      throw mapDioError(error);
    }
  }
}

final smsRepositoryProvider = Provider<SmsRepository>((ref) {
  return SmsRepository(ref.watch(smsApiProvider));
});

final smsConversationsProvider =
    AsyncNotifierProvider<SmsConversationsController, List<SmsConversation>>(
  SmsConversationsController.new,
);

class SmsConversationsController
    extends AsyncNotifier<List<SmsConversation>> {
  @override
  Future<List<SmsConversation>> build() async {
    return ref.read(smsRepositoryProvider).getConversations();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(smsRepositoryProvider).getConversations();
    });
  }
}

typedef SmsThreadKey = ({String peer, String line});

final smsThreadProvider = AsyncNotifierProvider.family<
    SmsThreadController, List<SmsMessage>, SmsThreadKey>(
  SmsThreadController.new,
);

class SmsThreadController extends FamilyAsyncNotifier<List<SmsMessage>, SmsThreadKey> {
  @override
  Future<List<SmsMessage>> build(SmsThreadKey arg) async {
    return ref.read(smsRepositoryProvider).getMessages(
          peer: arg.peer,
          line: arg.line,
        );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      return ref.read(smsRepositoryProvider).getMessages(
            peer: arg.peer,
            line: arg.line,
          );
    });
  }
}
