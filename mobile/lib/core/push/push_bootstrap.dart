import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_callkit_incoming/entities/call_event.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'package:telnyx_webrtc/telnyx_client.dart';
import 'package:vsp_voip_mobile/core/notifications/missed_call_notifier.dart';
import 'package:vsp_voip_mobile/core/push/native_incoming_call_ui.dart';
import 'package:vsp_voip_mobile/core/push/push_call_coordinator.dart';
import 'package:vsp_voip_mobile/core/push/telnyx_android_notifications.dart';

bool pushBootstrapComplete = false;

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  if (defaultTargetPlatform == TargetPlatform.android) {
    await TelnyxAndroidNotifications.initialize();
  }
  final data = Map<String, dynamic>.from(message.data);
  if (NativeIncomingCallUi.isMissedCallPush(data)) {
    await NativeIncomingCallUi.handleMissedCallPush(data);
    return;
  }
  await NativeIncomingCallUi.showFromRemoteMessage(message);
}

Future<void> bootstrapPushServices() async {
  if (pushBootstrapComplete) return;

  await MissedCallNotifier.initialize();

  if (defaultTargetPlatform == TargetPlatform.android) {
    try {
      await TelnyxAndroidNotifications.initialize();
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
      final permission = await FirebaseMessaging.instance.requestPermission();
      if (permission.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[Telnyx FCM] Notification permission denied');
      }
      FirebaseMessaging.instance.onTokenRefresh.listen((token) {
        registerRefreshedPushToken(token);
      });
    } catch (error) {
      debugPrint('Firebase not configured for Android push: $error');
    }
  }

  FlutterCallkitIncoming.onEvent.listen((CallEvent? event) {
    if (event == null) return;
    PushCallCoordinator.instance.dispatchCallKitEvent(event);
  });

  if (defaultTargetPlatform == TargetPlatform.android) {
    try {
      FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
        final data = Map<String, dynamic>.from(message.data);
        if (NativeIncomingCallUi.isMissedCallPush(data)) {
          await NativeIncomingCallUi.handleMissedCallPush(data);
          PushCallCoordinator.instance.dispatchMissedCallPush(data);
          return;
        }
        TelnyxClient.setPushMetaData(data);
        if (!PushCallCoordinator.instance.socketConnectedForInbound) {
          await NativeIncomingCallUi.showFromRemoteMessage(message);
        }
        PushCallCoordinator.instance.dispatchForegroundPush(data);
      });
    } catch (_) {}
  }

  pushBootstrapComplete = true;
}

Future<String?> fetchPushDeviceToken({int maxAttempts = 3}) async {
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    final token = await _fetchPushDeviceTokenOnce();
    if (token != null && token.isNotEmpty) {
      return token;
    }
    if (attempt < maxAttempts - 1) {
      await Future<void>.delayed(Duration(milliseconds: 400 * (attempt + 1)));
    }
  }
  return null;
}

Future<String?> _fetchPushDeviceTokenOnce() async {
  if (defaultTargetPlatform == TargetPlatform.android) {
    try {
      await Firebase.initializeApp();
      return FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }

  if (defaultTargetPlatform == TargetPlatform.iOS) {
    try {
      final token = await FlutterCallkitIncoming.getDevicePushTokenVoIP();
      if (token != null && token.isNotEmpty) return token;
    } catch (_) {}
  }

  return null;
}

String pushPlatformName() {
  if (defaultTargetPlatform == TargetPlatform.android) return 'android';
  if (defaultTargetPlatform == TargetPlatform.iOS) return 'ios';
  return 'unknown';
}

typedef PushTokenRegistrar = Future<void> Function(String token);

PushTokenRegistrar? _pushTokenRegistrar;

void setPushTokenRegistrar(PushTokenRegistrar registrar) {
  _pushTokenRegistrar = registrar;
}

Future<void> registerRefreshedPushToken(String token) async {
  final registrar = _pushTokenRegistrar;
  if (registrar == null || token.isEmpty) return;
  try {
    await registrar(token);
  } catch (error) {
    debugPrint('Push token re-registration failed: $error');
  }
}
