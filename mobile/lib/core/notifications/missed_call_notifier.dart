import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Local notifications for missed calls when the app is foregrounded.
class MissedCallNotifier {
  MissedCallNotifier._();

  static final _plugin = FlutterLocalNotificationsPlugin();
  static var _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    const settings = InitializationSettings(android: android, iOS: ios);

    await _plugin.initialize(settings);

    if (defaultTargetPlatform == TargetPlatform.android) {
      const channel = AndroidNotificationChannel(
        'missed_calls',
        'Missed calls',
        description: 'Alerts when an inbound call is not answered',
        importance: Importance.high,
      );
      await _plugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }

    _initialized = true;
  }

  static Future<void> showMissedCall({
    required String callerNumber,
    String? callerName,
  }) async {
    await initialize();

    final display = (callerName != null && callerName.trim().isNotEmpty)
        ? callerName.trim()
        : callerNumber;

    const androidDetails = AndroidNotificationDetails(
      'missed_calls',
      'Missed calls',
      channelDescription: 'Alerts when an inbound call is not answered',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _plugin.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      'Missed call',
      display,
      const NotificationDetails(android: androidDetails, iOS: iosDetails),
    );
  }
}
