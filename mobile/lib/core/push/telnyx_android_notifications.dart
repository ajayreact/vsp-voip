import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

/// Telnyx Flutter docs: high-importance FCM channel for incoming call alerts.
class TelnyxAndroidNotifications {
  TelnyxAndroidNotifications._();

  /// Must match `AndroidManifest.xml` meta-data value.
  static const channelId = 'telnyx_call_channel';
  static const channelName = 'Incoming Calls';

  static final _plugin = FlutterLocalNotificationsPlugin();
  static var _initialized = false;

  static Future<void> initialize() async {
    if (!Platform.isAndroid || _initialized) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: android);
    await _plugin.initialize(settings);

    const channel = AndroidNotificationChannel(
      channelId,
      channelName,
      description: 'Notifications for incoming Telnyx calls.',
      importance: Importance.max,
      playSound: true,
      audioAttributesUsage: AudioAttributesUsage.notificationRingtone,
    );

    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await _requestNotificationPermission();

    _initialized = true;
    debugPrint('[Telnyx FCM] Created high-importance channel $channelId');
  }

  /// Android 13+ (API 33): runtime POST_NOTIFICATIONS permission.
  static Future<void> _requestNotificationPermission() async {
    if (!Platform.isAndroid) return;
    final status = await Permission.notification.status;
    if (status.isGranted) return;
    await Permission.notification.request();
  }
}
