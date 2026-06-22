import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:telnyx_webrtc/call.dart';
import 'package:telnyx_webrtc/model/audio_constraints.dart';
import 'package:telnyx_webrtc/peer/session.dart';

/// Configures platform audio routing for Telnyx WebRTC calls.
class WebRtcAudioHelper {
  static const _tag = '[WebRTC Audio]';

  static Timer? _callAudioKeepaliveTimer;
  static bool _preferSpeaker = Platform.isAndroid;

  static bool get defaultPreferSpeaker => Platform.isAndroid;

  static void setPreferSpeaker(bool value) {
    _preferSpeaker = value;
  }

  static AudioConstraints callAudioConstraints() {
    if (!Platform.isAndroid) {
      return AudioConstraints.enabled();
    }
    return const AudioConstraints(
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
    );
  }

  static Future<bool> ensureMicrophonePermission() async {
    final before = await Permission.microphone.status;
    debugPrint('$_tag Mic permission (before): $before');
    if (before.isGranted) return true;

    final after = await Permission.microphone.request();
    debugPrint('$_tag Mic permission (after request): $after');
    return after.isGranted;
  }

  static Future<void> prepareForCall() async {
    if (WebRTC.platformIsAndroid) {
      await Helper.setAndroidAudioConfiguration(
        AndroidAudioConfiguration(
          manageAudioFocus: true,
          androidAudioMode: AndroidAudioMode.inCommunication,
          androidAudioFocusMode: AndroidAudioFocusMode.gain,
          androidAudioStreamType: AndroidAudioStreamType.voiceCall,
          androidAudioAttributesUsageType:
              AndroidAudioAttributesUsageType.voiceCommunication,
          androidAudioAttributesContentType:
              AndroidAudioAttributesContentType.speech,
          forceHandleAudioRouting: true,
        ),
      );
    } else if (WebRTC.platformIsIOS) {
      await Helper.ensureAudioSession();
    }
  }

  /// Wire local + remote stream callbacks so mic and speaker paths stay active.
  static void wireCallAudio(Call call) {
    void attachToPeer() {
      final peer = call.peerConnection;
      if (peer == null) return;

      final previousLocal = peer.onLocalStream;
      peer.onLocalStream = (stream) {
        previousLocal?.call(stream);
        unawaited(_activateLocalStream(call, stream));
      };

      final previousRemote = peer.onAddRemoteStream;
      peer.onAddRemoteStream = (Session session, MediaStream stream) {
        previousRemote?.call(session, stream);
        unawaited(_activateRemoteStream(call, stream));
      };
    }

    attachToPeer();
    if (call.peerConnection != null) return;

    var attempts = 0;
    Timer.periodic(const Duration(milliseconds: 100), (timer) {
      attempts += 1;
      attachToPeer();
      if (call.peerConnection != null || attempts >= 30) {
        timer.cancel();
      }
    });
  }

  static Future<void> _activateLocalStream(Call call, MediaStream stream) async {
    logAudioStream('local stream ready', stream);
    await prepareForCall();
    for (final track in stream.getAudioTracks()) {
      track.enabled = true;
    }
    call.setMuteState(false);
    await _enableOutboundAudioTracks(call);
    debugPrint('$_tag Local audio tracks enabled for call ${call.callId}');
  }

  static Future<void> _activateRemoteStream(Call call, MediaStream stream) async {
    logAudioStream('remote stream ready', stream);
    await prepareForCall();
    await _enableInboundAudioTracks(call, stream);
    await configureActiveCall(call, preferSpeaker: _preferSpeaker);
    debugPrint('$_tag Remote audio tracks enabled for call ${call.callId}');
  }

  static void logAudioStream(String label, MediaStream stream) {
    final tracks = stream.getAudioTracks();
    if (tracks.isEmpty) {
      debugPrint('$_tag $label: NO audio tracks');
      return;
    }
    for (final track in tracks) {
      debugPrint(
        '$_tag $label: track id=${track.id} enabled=${track.enabled} '
        'muted=${track.muted} kind=${track.kind}',
      );
    }
  }

  static Future<void> onMediaConnected(
    Call call, {
    required bool preferSpeaker,
  }) async {
    _preferSpeaker = preferSpeaker;
    await prepareForCall();
    await ensureLocalAudioTransmitting(call);
    await ensureRemoteAudioReceiving(call);
    await configureActiveCall(call, preferSpeaker: preferSpeaker);
    startCallAudioKeepalive(call);
  }

  static void startCallAudioKeepalive(Call call) {
    _callAudioKeepaliveTimer?.cancel();

    var ticks = 0;
    _callAudioKeepaliveTimer = Timer.periodic(const Duration(milliseconds: 800), (
      timer,
    ) {
      ticks += 1;
      if (ticks > 25) {
        timer.cancel();
        return;
      }
      unawaited(_refreshCallAudio(call));
    });
  }

  static Future<void> _refreshCallAudio(Call call) async {
    await prepareForCall();
    await ensureLocalAudioTransmitting(call);
    await ensureRemoteAudioReceiving(call);
    if (Platform.isAndroid) {
      await Helper.setSpeakerphoneOn(_preferSpeaker);
      call.enableSpeakerPhone(_preferSpeaker);
    }
  }

  static void stopCallAudioKeepalive() {
    _callAudioKeepaliveTimer?.cancel();
    _callAudioKeepaliveTimer = null;
  }

  static Future<void> ensureLocalAudioTransmitting(Call call) async {
    await prepareForCall();
    call.setMuteState(false);
    await _enableOutboundAudioTracks(call);

    for (var attempt = 0; attempt < 4; attempt++) {
      call.setMuteState(false);
      await _enableOutboundAudioTracks(call);
      if (attempt == 0) {
        debugPrint('$_tag Local mic unmuted for call ${call.callId}');
      }
      await Future<void>.delayed(const Duration(milliseconds: 120));
    }
  }

  static Future<void> ensureRemoteAudioReceiving(Call call) async {
    await prepareForCall();
    final peer = call.peerConnection;
    final pc = peer?.peerConnection;
    if (pc == null) return;

    try {
      final receivers = await pc.getReceivers();
      var enabled = 0;
      for (final receiver in receivers) {
        final track = receiver.track;
        if (track != null && track.kind == 'audio') {
          track.enabled = true;
          enabled += 1;
          if (WebRTC.platformIsAndroid) {
            await Helper.setVolume(1.0, track);
          }
        }
      }
      if (enabled > 0) {
        debugPrint('$_tag Enabled $enabled remote audio receiver(s)');
      }

      final streams = pc.getRemoteStreams();
      for (final stream in streams) {
        if (stream == null) continue;
        await _enableInboundAudioTracks(call, stream);
      }
    } catch (error) {
      debugPrint('$_tag Could not enable remote audio: $error');
    }
  }

  static Future<void> _enableOutboundAudioTracks(Call call) async {
    final pc = call.peerConnection?.peerConnection;
    if (pc == null) return;

    try {
      final senders = await pc.getSenders();
      for (final sender in senders) {
        final track = sender.track;
        if (track != null && track.kind == 'audio') {
          track.enabled = true;
        }
      }

      final streams = pc.getLocalStreams();
      for (final stream in streams) {
        if (stream == null) continue;
        for (final track in stream.getAudioTracks()) {
          track.enabled = true;
        }
      }
    } catch (error) {
      debugPrint('$_tag Could not enable outbound audio tracks: $error');
    }
  }

  static Future<void> _enableInboundAudioTracks(
    Call call,
    MediaStream stream,
  ) async {
    for (final track in stream.getAudioTracks()) {
      track.enabled = true;
      if (WebRTC.platformIsAndroid) {
        await Helper.setVolume(1.0, track);
      }
    }
    await configureActiveCall(call, preferSpeaker: _preferSpeaker);
  }

  static Future<void> configureActiveCall(
    Call call, {
    required bool preferSpeaker,
  }) async {
    _preferSpeaker = preferSpeaker;
    await prepareForCall();

    if (Platform.isAndroid) {
      // Telnyx SDK disables speaker ~100ms after ICE connect — re-apply later.
      await Future<void>.delayed(const Duration(milliseconds: 300));
      await Helper.setSpeakerphoneOn(preferSpeaker);
      call.enableSpeakerPhone(preferSpeaker);
      debugPrint(
        '$_tag Android speakerphone ${preferSpeaker ? 'enabled' : 'disabled'}',
      );
      return;
    }

    call.enableSpeakerPhone(preferSpeaker);
    debugPrint(
      '$_tag Speakerphone ${preferSpeaker ? 'enabled' : 'disabled'}',
    );
  }
}
