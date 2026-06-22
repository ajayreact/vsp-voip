import 'package:flutter_callkit_incoming/entities/call_event.dart';
import 'package:telnyx_webrtc/telnyx_client.dart';

enum PushCallAction {
  incoming,
  accept,
  decline,
  ended,
  timeout,
  missed,
  appResumed,
  appBackground,
}

class PushCallEvent {
  const PushCallEvent({
    required this.action,
    this.data,
    this.callId,
  });

  final PushCallAction action;
  final Map<String, dynamic>? data;
  final String? callId;
}

typedef PushCallListener = void Function(PushCallEvent event);

class PushCallCoordinator {
  PushCallCoordinator._();

  static final PushCallCoordinator instance = PushCallCoordinator._();

  PushCallListener? listener;

  /// True when the Telnyx WebSocket is connected (foreground softphone ready).
  /// Foreground inbound uses socket INVITE only — skip duplicate CallKit UI from FCM.
  bool socketConnectedForInbound = false;

  /// Telnyx: do not disconnect while showing full-screen incoming CallKit UI.
  bool suppressBackgroundDisconnect = false;
  int _incomingUiSuppressCount = 0;

  void beginIncomingCallUi() {
    _incomingUiSuppressCount += 1;
    suppressBackgroundDisconnect = true;
  }

  void endIncomingCallUi({Duration releaseAfter = const Duration(seconds: 3)}) {
    _incomingUiSuppressCount = (_incomingUiSuppressCount - 1).clamp(0, 999);
    if (_incomingUiSuppressCount > 0) return;
    Future<void>.delayed(releaseAfter, () {
      if (_incomingUiSuppressCount == 0) {
        suppressBackgroundDisconnect = false;
      }
    });
  }

  void notifyAppBackground() {
    listener?.call(const PushCallEvent(action: PushCallAction.appBackground));
  }

  void notifyAppResumed() {
    listener?.call(const PushCallEvent(action: PushCallAction.appResumed));
  }

  void dispatchCallKitEvent(CallEvent event) {
    final extra = event.body['extra'];
    final data = extra is Map
        ? Map<String, dynamic>.from(extra)
        : null;
    final callId = event.body['id']?.toString();

    switch (event.event) {
      case Event.actionCallIncoming:
        if (data != null) {
          TelnyxClient.setPushMetaData(data);
        }
        listener?.call(PushCallEvent(
          action: PushCallAction.incoming,
          data: data,
          callId: callId,
        ));
      case Event.actionCallAccept:
        if (data != null) {
          TelnyxClient.setPushMetaData(
            data,
            isAnswer: true,
            isDecline: false,
          );
        }
        listener?.call(PushCallEvent(
          action: PushCallAction.accept,
          data: data,
          callId: callId,
        ));
      case Event.actionCallDecline:
      case Event.actionCallEnded:
        if (data != null) {
          TelnyxClient.setPushMetaData(
            data,
            isAnswer: false,
            isDecline: event.event == Event.actionCallDecline,
          );
        }
        listener?.call(PushCallEvent(
          action: event.event == Event.actionCallDecline
              ? PushCallAction.decline
              : PushCallAction.ended,
          data: data,
          callId: callId,
        ));
      case Event.actionCallTimeout:
        listener?.call(PushCallEvent(
          action: PushCallAction.timeout,
          data: data,
          callId: callId,
        ));
      default:
        break;
    }
  }

  void dispatchForegroundPush(Map<String, dynamic> data) {
    TelnyxClient.setPushMetaData(data);
    listener?.call(PushCallEvent(
      action: PushCallAction.incoming,
      data: data,
    ));
  }

  void dispatchMissedCallPush(Map<String, dynamic> data) {
    TelnyxClient.clearPushMetaData();
    listener?.call(PushCallEvent(
      action: PushCallAction.missed,
      data: data,
    ));
  }
}
