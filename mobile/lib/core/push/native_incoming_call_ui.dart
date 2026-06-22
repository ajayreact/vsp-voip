import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_callkit_incoming/entities/android_params.dart';
import 'package:flutter_callkit_incoming/entities/call_kit_params.dart';
import 'package:flutter_callkit_incoming/entities/ios_params.dart';
import 'package:flutter_callkit_incoming/entities/notification_params.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'package:telnyx_webrtc/model/push_notification.dart';
import 'package:vsp_voip_mobile/core/push/push_call_coordinator.dart';
import 'package:vsp_voip_mobile/core/push/telnyx_android_notifications.dart';

/// Telnyx sends this in FCM `data.message` when the caller hung up before answer.
const telnyxMissedCallPushMessage = 'Missed call!';

class NativeIncomingCallUi {
  static bool isMissedCallPush(Map<String, dynamic> data) {
    final message = data['message']?.toString().trim();
    return message == telnyxMissedCallPushMessage;
  }

  /// Stop ringing and show a missed-call notification (Telnyx Android push docs).
  static Future<void> handleMissedCallPush(Map<String, dynamic> data) async {
    await FlutterCallkitIncoming.endAllCalls();
    final metadata = _parseMetadata(data);
    if (metadata == null) return;

    final callId = metadata.callId ?? DateTime.now().millisecondsSinceEpoch.toString();
    final callerName = metadata.callerName?.trim();
    final callerNumber = metadata.callerNumber?.trim() ?? 'Unknown';
    final displayName = (callerName != null && callerName.isNotEmpty)
        ? callerName
        : callerNumber;

    await FlutterCallkitIncoming.showMissCallNotification(
      CallKitParams(
        id: callId,
        nameCaller: displayName,
        appName: 'VSP-VOIP',
        handle: callerNumber,
        type: 0,
        extra: data,
        missedCallNotification: const NotificationParams(
          showNotification: true,
          subtitle: 'Missed call',
          isShowCallback: true,
          callbackText: 'Call back',
        ),
        android: const AndroidParams(
          missedCallNotificationChannelName: 'Missed calls',
        ),
      ),
    );
  }
  static Future<void> showFromRemoteMessage(RemoteMessage message) async {
    await showFromData(Map<String, dynamic>.from(message.data));
  }

  static Future<void> showFromData(Map<String, dynamic> data) async {
    final metadata = _parseMetadata(data);
    if (metadata == null) return;

    final callId = metadata.callId ?? DateTime.now().millisecondsSinceEpoch.toString();
    final callerName = metadata.callerName?.trim();
    final callerNumber = metadata.callerNumber?.trim() ?? 'Unknown';
    final displayName = (callerName != null && callerName.isNotEmpty)
        ? callerName
        : callerNumber;

    final params = CallKitParams(
      id: callId,
      nameCaller: displayName,
      appName: 'VSP-VOIP',
      handle: callerNumber,
      type: 0,
      duration: 45000,
      extra: data,
      textAccept: 'Answer',
      textDecline: 'Decline',
      missedCallNotification: const NotificationParams(
        showNotification: true,
        subtitle: 'Missed call',
        isShowCallback: true,
        callbackText: 'Call back',
      ),
      android: const AndroidParams(
        isCustomNotification: true,
        isShowLogo: false,
        ringtonePath: 'system_ringtone_default',
        backgroundColor: '#10B981',
        actionColor: '#FFFFFF',
        textColor: '#FFFFFF',
        incomingCallNotificationChannelName: TelnyxAndroidNotifications.channelName,
        missedCallNotificationChannelName: 'Missed calls',
        isShowCallID: true,
      ),
      ios: const IOSParams(
        handleType: 'generic',
        supportsVideo: false,
        maximumCallGroups: 1,
        maximumCallsPerCallGroup: 1,
        audioSessionMode: 'voiceChat',
        audioSessionActive: true,
        audioSessionPreferredSampleRate: 44100.0,
        audioSessionPreferredIOBufferDuration: 0.005,
        supportsDTMF: true,
        supportsHolding: false,
        supportsGrouping: false,
        supportsUngrouping: false,
        ringtonePath: 'system_ringtone_default',
      ),
    );

    PushCallCoordinator.instance.beginIncomingCallUi();
    try {
      await FlutterCallkitIncoming.showCallkitIncoming(params);
    } finally {
      PushCallCoordinator.instance.endIncomingCallUi();
    }
  }

  /// Telnyx iOS: start a CallKit session for outbound WebRTC when using manual audio.
  static Future<void> startOutboundCallKit({
    required String callId,
    required String handle,
    required String callerName,
  }) async {
    if (defaultTargetPlatform != TargetPlatform.iOS) return;

    await FlutterCallkitIncoming.startCall(
      CallKitParams(
        id: callId,
        nameCaller: callerName,
        appName: 'VSP-VOIP',
        handle: handle,
        type: 0,
      ),
    );
  }

  static Future<void> endCall(String callId) async {
    await FlutterCallkitIncoming.endCall(callId);
  }

  /// Dismiss all native incoming-call overlays (CallKit / Android notification).
  static Future<void> dismissAll() async {
    await FlutterCallkitIncoming.endAllCalls();
  }

  static PushMetaData? parsePushMetaData(Map<String, dynamic> data) {
    return _parseMetadata(data);
  }

  static PushMetaData? _parseMetadata(Map<String, dynamic> data) {
    try {
      final raw = data['metadata'];
      if (raw is String && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          return PushMetaData.fromJson(Map<String, dynamic>.from(decoded));
        }
      }
      if (raw is Map) {
        return PushMetaData.fromJson(Map<String, dynamic>.from(raw));
      }
      if (data.containsKey('call_id') || data.containsKey('caller_number')) {
        return PushMetaData.fromJson(data);
      }
    } catch (error) {
      debugPrint('Failed to parse Telnyx push metadata: $error');
    }
    return null;
  }
}
