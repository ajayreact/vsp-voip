import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:telnyx_webrtc/call.dart';

enum AudioRouteKind { speaker, earpiece, bluetooth, wired, unknown }

class AudioRoute {
  const AudioRoute({
    required this.id,
    required this.label,
    required this.kind,
  });

  final String id;
  final String label;
  final AudioRouteKind kind;
}

/// Lists and applies WebRTC audio output routes during active calls.
class AudioRouteService {
  static AudioRouteKind? _activeKind;

  static AudioRouteKind? get activeKind => _activeKind;

  static Future<List<AudioRoute>> listRoutes() async {
    final routes = <AudioRoute>[
      const AudioRoute(
        id: 'speaker',
        label: 'Speaker',
        kind: AudioRouteKind.speaker,
      ),
      const AudioRoute(
        id: 'earpiece',
        label: 'Phone',
        kind: AudioRouteKind.earpiece,
      ),
    ];

    try {
      final devices = await navigator.mediaDevices.enumerateDevices();
      for (final device in devices) {
        if (device.kind != 'audioinput' && device.kind != 'audiooutput') {
          continue;
        }
        final label = device.label.trim();
        if (label.isEmpty) continue;

        final lower = label.toLowerCase();
        AudioRouteKind? kind;
        if (lower.contains('bluetooth') || lower.contains('airpods') || lower.contains('buds')) {
          kind = AudioRouteKind.bluetooth;
        } else if (lower.contains('headset') ||
            lower.contains('headphone') ||
            lower.contains('wired')) {
          kind = AudioRouteKind.wired;
        } else {
          continue;
        }

        if (routes.any((route) => route.id == device.deviceId)) continue;
        routes.add(
          AudioRoute(
            id: device.deviceId,
            label: label,
            kind: kind,
          ),
        );
      }
    } catch (error) {
      debugPrint('[AudioRoute] enumerateDevices failed: $error');
    }

    return routes;
  }

  static Future<bool> hasHeadsetConnected() async {
    final routes = await listRoutes();
    return routes.any(
      (route) =>
          route.kind == AudioRouteKind.bluetooth ||
          route.kind == AudioRouteKind.wired,
    );
  }

  static Future<void> applyRoute(
    Call call, {
    required AudioRoute route,
  }) async {
    _activeKind = route.kind;

    switch (route.kind) {
      case AudioRouteKind.speaker:
        await Helper.setSpeakerphoneOn(true);
        call.enableSpeakerPhone(true);
        return;
      case AudioRouteKind.earpiece:
        await Helper.setSpeakerphoneOn(false);
        call.enableSpeakerPhone(false);
        return;
      case AudioRouteKind.bluetooth:
      case AudioRouteKind.wired:
        if (Platform.isAndroid && route.id != 'speaker' && route.id != 'earpiece') {
          try {
            await Helper.selectAudioInput(route.id);
          } catch (_) {}
        }
        await Helper.setSpeakerphoneOn(false);
        call.enableSpeakerPhone(false);
        return;
      case AudioRouteKind.unknown:
        await Helper.setSpeakerphoneOn(false);
        call.enableSpeakerPhone(false);
        return;
    }
  }
}
