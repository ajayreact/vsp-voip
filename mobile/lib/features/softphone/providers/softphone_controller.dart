import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:telnyx_webrtc/model/audio_constraints.dart';
import 'package:telnyx_webrtc/model/call_state.dart';
import 'package:telnyx_webrtc/model/push_notification.dart';
import 'package:telnyx_webrtc/model/socket_method.dart';
import 'package:telnyx_webrtc/model/verto/receive/received_message_body.dart';
import 'package:telnyx_webrtc/call.dart';
import 'package:telnyx_webrtc/telnyx_client.dart';
import 'package:telnyx_webrtc/telnyx_webrtc.dart';
import 'package:telnyx_webrtc/utils/logging/log_level.dart';
import 'package:vsp_voip_mobile/core/errors/api_exception.dart';
import 'package:vsp_voip_mobile/core/push/native_incoming_call_ui.dart';
import 'package:vsp_voip_mobile/core/push/push_call_coordinator.dart';
import 'package:vsp_voip_mobile/core/push/push_bootstrap.dart';
import 'package:vsp_voip_mobile/core/audio/audio_route_service.dart';
import 'package:vsp_voip_mobile/core/device/device_install_service.dart';
import 'package:vsp_voip_mobile/core/notifications/missed_call_notifier.dart';
import 'package:vsp_voip_mobile/core/webrtc/webrtc_audio_helper.dart';
import 'package:vsp_voip_mobile/features/auth/providers/auth_providers.dart';
import 'package:vsp_voip_mobile/features/calls/providers/calls_providers.dart';
import 'package:vsp_voip_mobile/features/dashboard/providers/dashboard_providers.dart';
import 'package:vsp_voip_mobile/features/softphone/data/models/softphone_config.dart';
import 'package:vsp_voip_mobile/features/softphone/data/softphone_repository.dart';
import 'package:vsp_voip_mobile/features/softphone/dial_normalization.dart';

enum SoftphoneUiState {
  idle,
  loading,
  notConfigured,
  noNumbers,
  connecting,
  ready,
  incoming,
  calling,
  active,
  error,
}

@immutable
class SoftphoneState {
  const SoftphoneState({
    this.uiState = SoftphoneUiState.idle,
    this.status = 'Connecting for inbound calls…',
    this.error,
    this.config,
    this.callerId = '',
    this.destination = '',
    this.elapsedSeconds = 0,
    this.muted = false,
    this.recordingActive = false,
    this.bootAttempt = 0,
    this.incomingCallerName,
    this.incomingCallerNumber,
    this.pushRegistered = false,
  });

  final SoftphoneUiState uiState;
  final String status;
  final String? error;
  final SoftphoneConfig? config;
  final String callerId;
  final String destination;
  final int elapsedSeconds;
  final bool muted;
  final bool recordingActive;
  final int bootAttempt;
  final String? incomingCallerName;
  final String? incomingCallerNumber;
  final bool pushRegistered;

  bool get inCall =>
      uiState == SoftphoneUiState.calling ||
      uiState == SoftphoneUiState.active;

  bool get hasIncoming =>
      uiState == SoftphoneUiState.incoming;

  SoftphoneState copyWith({
    SoftphoneUiState? uiState,
    String? status,
    String? error,
    SoftphoneConfig? config,
    String? callerId,
    String? destination,
    int? elapsedSeconds,
    bool? muted,
    bool? recordingActive,
    int? bootAttempt,
    String? incomingCallerName,
    String? incomingCallerNumber,
    bool? pushRegistered,
    bool clearError = false,
    bool clearIncoming = false,
  }) {
    return SoftphoneState(
      uiState: uiState ?? this.uiState,
      status: status ?? this.status,
      error: clearError ? null : (error ?? this.error),
      config: config ?? this.config,
      callerId: callerId ?? this.callerId,
      destination: destination ?? this.destination,
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
      muted: muted ?? this.muted,
      recordingActive: recordingActive ?? this.recordingActive,
      bootAttempt: bootAttempt ?? this.bootAttempt,
      incomingCallerName:
          clearIncoming ? null : (incomingCallerName ?? this.incomingCallerName),
      incomingCallerNumber: clearIncoming
          ? null
          : (incomingCallerNumber ?? this.incomingCallerNumber),
      pushRegistered: pushRegistered ?? this.pushRegistered,
    );
  }
}

final softphoneControllerProvider =
    NotifierProvider<SoftphoneController, SoftphoneState>(
  SoftphoneController.new,
);

class SoftphoneController extends Notifier<SoftphoneState> {
  TelnyxClient? _client;
  Call? _activeCall;
  Timer? _presenceTimer;
  Timer? _durationTimer;
  Timer? _tokenRefreshTimer;
  bool _recordingStarted = false;
  bool _initialized = false;
  String _lastFrom = '';
  String _lastTo = '';
  bool _isInboundCall = false;
  IncomingInviteParams? _pendingInvite;
  bool _waitingForInvite = false;
  bool _callFromPush = false;
  TokenConfig? _lastTokenConfig;
  String? _pushToken;
  String? _activeIncomingCallId;
  bool _endingCall = false;
  bool _answeringCall = false;
  bool _booting = false;
  bool _preferSpeaker = WebRtcAudioHelper.defaultPreferSpeaker;
  AudioRouteKind _activeAudioRoute = AudioRouteKind.speaker;
  bool _socketDisconnectedForBackground = false;

  SoftphoneRepository get _repository => ref.read(softphoneRepositoryProvider);

  @override
  SoftphoneState build() {
    ref.onDispose(() {
      PushCallCoordinator.instance.listener = null;
      setPushTokenRegistrar((_) async {});
      _teardown();
    });
    setPushTokenRegistrar(_registerPushTokenFromRefresh);
    PushCallCoordinator.instance.listener = _handlePushEvent;
    ref.listen(authControllerProvider, (previous, next) {
      final wasLoggedIn = previous?.asData?.value != null;
      final isLoggedIn = next.asData?.value != null;
      if (wasLoggedIn && !isLoggedIn) {
        _teardown();
        state = const SoftphoneState();
        return;
      }
      final user = next.asData?.value;
      if (user != null && user.hasTenant) {
        unawaited(ensureConnected());
      }
    });

    final auth = ref.watch(authControllerProvider);
    final user = auth.asData?.value;
    if (!auth.isLoading && user != null && user.hasTenant) {
      Future.microtask(ensureConnected);
    }

    return const SoftphoneState();
  }

  /// Keeps the Telnyx WebSocket registered for inbound calls app-wide.
  Future<void> ensureConnected() async {
    if (_booting) return;
    if (state.inCall || state.hasIncoming) return;
    if (state.uiState == SoftphoneUiState.ready && _client != null) {
      PushCallCoordinator.instance.socketConnectedForInbound = true;
      return;
    }
    if (state.uiState == SoftphoneUiState.loading ||
        (state.uiState == SoftphoneUiState.connecting &&
            !_socketDisconnectedForBackground)) {
      return;
    }

    _booting = true;
    _initialized = true;
    try {
      await _boot();
    } finally {
      _booting = false;
    }
  }

  Future<void> initialize() async => ensureConnected();

  Future<void> retry() async {
    await _teardown(resetInitialized: false);
    state = state.copyWith(
      bootAttempt: state.bootAttempt + 1,
      clearError: true,
    );
    await _boot();
  }

  Future<void> _boot() async {
    final user = ref.read(authControllerProvider).asData?.value;
    if (user == null || !user.hasTenant) {
      state = state.copyWith(
        uiState: SoftphoneUiState.error,
        status: 'Tenant account required',
        error: 'Sign in with a tenant user to use the softphone.',
      );
      return;
    }

    state = state.copyWith(
      uiState: SoftphoneUiState.loading,
      status: 'Starting softphone…',
      clearError: true,
    );

    try {
      final config = await _repository.getConfig();
      final defaultCaller =
          config.defaultCallerId ?? config.numbers.firstOrNull?.number ?? '';

      state = state.copyWith(
        config: config,
        callerId: defaultCaller.isNotEmpty ? defaultCaller : state.callerId,
      );

      if (!config.configured) {
        state = state.copyWith(
          uiState: SoftphoneUiState.notConfigured,
          status: 'WebRTC credential connection is not configured',
        );
        return;
      }

      if (config.numbers.isEmpty) {
        state = state.copyWith(
          uiState: SoftphoneUiState.noNumbers,
          status: 'Assign a phone number before placing calls',
        );
        return;
      }

      state = state.copyWith(
        uiState: SoftphoneUiState.connecting,
        status: 'Requesting secure login token…',
      );

      final pendingPush = await TelnyxClient.getPushData();
      if (pendingPush != null && pendingPush.isNotEmpty) {
        await _ensurePushTokenRegistered();
        final apiToken = await _repository.createToken();
        _lastTokenConfig = _buildTokenConfig(
          loginToken: apiToken.loginToken,
          userName: user.name,
          callerId: state.callerId.isNotEmpty
              ? state.callerId
              : config.numbers.first.number,
        );
        _scheduleTokenRefresh(apiToken.expiresInSeconds);
        await processPendingPushCall(
          accept: pendingPush['isAnswer'] == true,
          decline: pendingPush['isDecline'] == true,
        );
        return;
      }

      final token = await _repository.createToken();
      final callerId = state.callerId.isNotEmpty
          ? state.callerId
          : config.numbers.first.number;

      await _ensurePushTokenRegistered();

      _client = TelnyxClient();
      _client!.onSocketMessageReceived = _handleSocketMessage;
      _client!.onSocketErrorReceived = (error) {
        state = state.copyWith(
          uiState: SoftphoneUiState.error,
          error: error.errorMessage,
          status: 'Connection error',
        );
      };

      _lastTokenConfig = _buildTokenConfig(
        loginToken: token.loginToken,
        userName: user.name,
        callerId: callerId,
      );
      _scheduleTokenRefresh(token.expiresInSeconds);

      state = state.copyWith(status: 'Connecting to Telnyx…');
      _client!.connectWithToken(_lastTokenConfig!);
    } catch (error) {
      final message = error is ApiException
          ? error.message
          : error.toString();
      state = state.copyWith(
        uiState: SoftphoneUiState.error,
        status: 'Could not start softphone',
        error: message,
      );
    }
  }

  TokenConfig _buildTokenConfig({
    required String loginToken,
    required String userName,
    required String callerId,
  }) {
    return TokenConfig(
      sipToken: loginToken,
      sipCallerIDName: userName,
      sipCallerIDNumber: callerId,
      notificationToken: _pushToken,
      debug: kDebugMode,
      logLevel: kDebugMode ? LogLevel.info : LogLevel.error,
      autoReconnect: true,
    );
  }

  Future<void> _registerPushTokenFromRefresh(String token) async {
    if (token.isEmpty) return;
    _pushToken = token;
    final deviceId = await DeviceInstallService.deviceId();
    final deviceName = await DeviceInstallService.deviceName();
    final appVersion = await DeviceInstallService.appVersion();
    await _repository.registerPushToken(
      token: token,
      platform: pushPlatformName(),
      deviceId: deviceId,
      deviceName: deviceName,
      appVersion: appVersion,
    );
    state = state.copyWith(pushRegistered: true);
  }

  Future<void> _ensurePushTokenRegistered() async {
    final token = await fetchPushDeviceToken();
    if (token == null || token.isEmpty) {
      state = state.copyWith(pushRegistered: false);
      return;
    }

    _pushToken = token;
    try {
      final deviceId = await DeviceInstallService.deviceId();
      final deviceName = await DeviceInstallService.deviceName();
      final appVersion = await DeviceInstallService.appVersion();
      await _repository.registerPushToken(
        token: token,
        platform: pushPlatformName(),
        deviceId: deviceId,
        deviceName: deviceName,
        appVersion: appVersion,
      );
      state = state.copyWith(pushRegistered: true);
    } catch (_) {
      state = state.copyWith(pushRegistered: false);
    }
  }

  void _scheduleTokenRefresh(int expiresInSeconds) {
    _tokenRefreshTimer?.cancel();
    final refreshSeconds = (expiresInSeconds - 3600).clamp(300, expiresInSeconds);
    _tokenRefreshTimer = Timer(Duration(seconds: refreshSeconds), () {
      unawaited(_refreshLoginToken());
    });
  }

  Future<void> _refreshLoginToken() async {
    if (state.inCall || state.hasIncoming) {
      _scheduleTokenRefresh(3600);
      return;
    }

    final user = ref.read(authControllerProvider).asData?.value;
    if (user == null || !user.hasTenant || _client == null) return;

    try {
      final token = await _repository.createToken();
      final callerId = state.callerId.isNotEmpty
          ? state.callerId
          : (state.config?.numbers.firstOrNull?.number ?? '');
      _lastTokenConfig = _buildTokenConfig(
        loginToken: token.loginToken,
        userName: user.name,
        callerId: callerId,
      );
      _scheduleTokenRefresh(token.expiresInSeconds);
      _client!.disconnect();
      _client!.connectWithToken(_lastTokenConfig!);
    } catch (_) {
      _scheduleTokenRefresh(1800);
    }
  }

  Call? _resolveCall(TelnyxMessage message) {
    final callId = message.message.inviteParams?.callID;
    if (callId != null && callId.isNotEmpty) {
      final fromClient = _client?.getCallOrNull(callId);
      if (fromClient != null) return fromClient;
    }
    return _activeCall;
  }

  void _handleSocketMessage(TelnyxMessage message) {
    switch (message.socketMethod) {
      case SocketMethod.clientReady:
      case SocketMethod.login:
        _onClientReady();
        break;
      case SocketMethod.invite:
        _onIncomingInvite(message);
        break;
      case SocketMethod.ringing:
        _onOutboundRinging(message);
        break;
      case SocketMethod.answer:
        _onCallAnswered(message);
        break;
      case SocketMethod.bye:
        _onRemoteHangup(message);
        break;
      case SocketMethod.media:
      case SocketMethod.attach:
        _syncActiveCallState();
        if (_activeCall != null) {
          unawaited(
            WebRtcAudioHelper.onMediaConnected(
              _activeCall!,
              preferSpeaker: _preferSpeaker,
            ),
          );
        }
        break;
    }
  }

  /// Telnyx docs: ANSWER socket event — remote party answered (outbound).
  /// SDK 4.2.0 sets callState=active directly without always firing
  /// onCallStateChanged, so we handle this explicitly.
  void _onCallAnswered(TelnyxMessage message) {
    final call = _resolveCall(message);
    if (call == null) return;
    _activeCall = call;
    debugPrint(
      '[WebRTC Audio] Remote ANSWER received for call ${call.callId}',
    );
    unawaited(
      WebRtcAudioHelper.onMediaConnected(
        call,
        preferSpeaker: _preferSpeaker,
      ),
    );
    if (state.uiState != SoftphoneUiState.active) {
      call.callHandler.changeState(CallState.active);
    }
  }

  /// Telnyx docs: RINGING socket event — remote leg is ringing (outbound).
  void _onOutboundRinging(TelnyxMessage message) {
    final call = _resolveCall(message);
    if (call == null) return;
    _activeCall = call;
    if (state.uiState == SoftphoneUiState.active) return;
    state = state.copyWith(
      uiState: SoftphoneUiState.calling,
      status: 'Ringing ${formatDisplayNumber(_lastTo)}…',
    );
  }

  void _syncActiveCallState() {
    final call = _activeCall;
    if (call == null) return;
    if (call.callState == CallState.active &&
        state.uiState != SoftphoneUiState.active) {
      _onCallActive(call);
    } else if ((call.callState == CallState.done ||
            call.callState == CallState.dropped ||
            call.callState == CallState.error) &&
        state.inCall) {
      _onCallEnded(call);
    }
  }

  void _onIncomingInvite(TelnyxMessage message) {
    final invite = message.message.inviteParams;
    if (invite == null) return;

    final callId = invite.callID;

    if (state.uiState == SoftphoneUiState.active ||
        state.uiState == SoftphoneUiState.calling) {
      if (callId != null && callId != _activeCall?.callId) {
        _client?.getCallOrNull(callId)?.endCall();
      }
      return;
    }

    if (_pendingInvite?.callID == callId &&
        state.uiState == SoftphoneUiState.incoming) {
      return;
    }

    if (_pendingInvite != null &&
        _pendingInvite!.callID != null &&
        _pendingInvite!.callID != callId) {
      final stale = _client?.getCallOrNull(_pendingInvite!.callID!);
      stale?.endCall();
      NativeIncomingCallUi.dismissAll().catchError((_) {});
    }

    _pendingInvite = invite;
    final callerNumber = invite.callerIdNumber ?? 'Unknown';
    final callerName = invite.callerIdName;
    _activeIncomingCallId = callId;

    if (_waitingForInvite || _callFromPush) {
      _acceptPendingInvite();
      return;
    }

    _isInboundCall = true;
    _lastFrom = callerNumber;
    _lastTo = invite.calleeIdNumber ?? state.callerId;

    final useNativeUi = !PushCallCoordinator.instance.socketConnectedForInbound;
    if (useNativeUi) {
      NativeIncomingCallUi.showFromData({
        'metadata': {
          'caller_name': callerName ?? '',
          'caller_number': callerNumber,
          'call_id': callId ?? '',
        },
      }).catchError((_) {});
    }

    state = state.copyWith(
      uiState: SoftphoneUiState.incoming,
      status: 'Incoming call from ${formatDisplayNumber(callerNumber)}',
      incomingCallerName: callerName,
      incomingCallerNumber: callerNumber,
      clearError: true,
    );
  }

  Future<void> acceptIncoming() async {
    if (_answeringCall) return;
    _answeringCall = true;
    try {
      if (!await WebRtcAudioHelper.ensureMicrophonePermission()) {
        state = state.copyWith(
          error: 'Microphone permission is required to answer calls',
        );
        return;
      }
      await WebRtcAudioHelper.prepareForCall();
      await NativeIncomingCallUi.dismissAll();

      _waitingForInvite = true;
      _callFromPush = false;

      if (_pendingInvite != null) {
        await _acceptPendingInvite();
        TelnyxClient.clearPushMetaData();
        return;
      }

      await processPendingPushCall(accept: true);
    } finally {
      _answeringCall = false;
    }
  }

  Future<void> declineIncoming() async {
    await NativeIncomingCallUi.dismissAll();

    final usedDeclinePush = _pendingInvite == null || _callFromPush;
    if (_pendingInvite != null && _client != null && !_callFromPush) {
      final callId = _pendingInvite!.callID;
      final call = callId != null ? _client!.getCallOrNull(callId) : null;
      call?.endCall();
    } else {
      await processPendingPushCall(decline: true);
    }

    _ensureInboundLogContext();
    _logInboundCallEnd(status: 'declined');
    _clearIncomingState();
    if (_client != null && !state.inCall) {
      state = state.copyWith(
        uiState: SoftphoneUiState.ready,
        status: '',
        clearIncoming: true,
      );
    }

    if (usedDeclinePush) {
      TelnyxClient.clearPushMetaData();
    }
  }

  Future<void> _acceptPendingInvite() async {
    final client = _client;
    final invite = _pendingInvite;
    final user = ref.read(authControllerProvider).asData?.value;
    if (client == null || invite == null) return;

    final callerId = state.callerId.isNotEmpty
        ? state.callerId
        : (invite.calleeIdNumber ?? state.config?.numbers.firstOrNull?.number ?? '');

    _isInboundCall = true;
    _lastFrom = invite.callerIdNumber ?? '';
    _lastTo = invite.calleeIdNumber ?? callerId;
    _recordingStarted = false;

    state = state.copyWith(
      uiState: SoftphoneUiState.calling,
      status: 'Answering ${formatDisplayNumber(_lastFrom)}…',
      clearIncoming: true,
      recordingActive: false,
      elapsedSeconds: 0,
    );

    try {
      final call = client.acceptCall(
        invite,
        user?.name ?? 'VSP Agent',
        callerId,
        'vsp-mobile-inbound',
        debug: kDebugMode,
        mutedMicOnStart: false,
        audioConstraints: WebRtcAudioHelper.callAudioConstraints(),
      );
      _activeCall = call;
      _wireCallHandlers(call, inbound: true);
      _waitingForInvite = false;
      _callFromPush = false;
      NativeIncomingCallUi.dismissAll().catchError((_) {});
    } catch (error) {
      _waitingForInvite = false;
      state = state.copyWith(
        uiState: SoftphoneUiState.ready,
        status: '',
        error: error.toString(),
      );
    }
  }

  Future<void> processPendingPushCall({
    bool accept = false,
    bool decline = false,
  }) async {
    if (accept && _pendingInvite != null && _client != null) {
      await _acceptPendingInvite();
      TelnyxClient.clearPushMetaData();
      return;
    }

    final data = await TelnyxClient.getPushData();
    if (data == null || data.isEmpty) {
      if (accept && _pendingInvite != null) {
        await _acceptPendingInvite();
      }
      return;
    }

    final pushMeta = PushMetaData.fromJson(data);
    if (_lastTokenConfig == null) {
      final user = ref.read(authControllerProvider).asData?.value;
      if (user == null) return;
      try {
        final apiToken = await _repository.createToken();
        final callerId = state.callerId.isNotEmpty
            ? state.callerId
            : (state.config?.defaultCallerId ??
                state.config?.numbers.firstOrNull?.number ??
                '');
        await _ensurePushTokenRegistered();
        _lastTokenConfig = _buildTokenConfig(
          loginToken: apiToken.loginToken,
          userName: user.name,
          callerId: callerId,
        );
        _scheduleTokenRefresh(apiToken.expiresInSeconds);
      } catch (_) {
        return;
      }
    }

    if (accept) {
      pushMeta.isAnswer = true;
      pushMeta.isDecline = false;
      _callFromPush = true;
      _waitingForInvite = true;
    } else if (decline) {
      pushMeta.isAnswer = false;
      pushMeta.isDecline = true;
    }

    _client ??= TelnyxClient();
    _client!.onSocketMessageReceived = _handleSocketMessage;
    _client!.handlePushNotification(
      pushMeta,
      null,
      _lastTokenConfig,
    );

    TelnyxClient.clearPushMetaData();
  }

  void _handlePushEvent(PushCallEvent event) {
    switch (event.action) {
      case PushCallAction.incoming:
        if (PushCallCoordinator.instance.socketConnectedForInbound &&
            (_pendingInvite != null ||
                state.uiState == SoftphoneUiState.incoming ||
                state.uiState == SoftphoneUiState.active ||
                state.uiState == SoftphoneUiState.calling)) {
          return;
        }
        _callFromPush = true;
        final data = event.data;
        if (data != null) {
          final meta = NativeIncomingCallUi.parsePushMetaData(data);
          if (meta != null) {
            _isInboundCall = true;
            _lastFrom = meta.callerNumber ?? '';
            _lastTo = state.callerId.isNotEmpty
                ? state.callerId
                : (state.config?.defaultCallerId ?? '');
            _activeIncomingCallId = meta.callId;
            if (state.uiState != SoftphoneUiState.incoming &&
                state.uiState != SoftphoneUiState.active) {
              state = state.copyWith(
                uiState: SoftphoneUiState.incoming,
                incomingCallerName: meta.callerName,
                incomingCallerNumber: meta.callerNumber,
                status: meta.callerNumber != null
                    ? 'Incoming call from ${formatDisplayNumber(meta.callerNumber!)}'
                    : 'Incoming call',
                clearError: true,
              );
            }
          }
        }
      case PushCallAction.accept:
        acceptIncoming();
      case PushCallAction.decline:
        declineIncoming();
      case PushCallAction.timeout:
      case PushCallAction.missed:
        _onMissedIncomingCall(event.data);
      case PushCallAction.ended:
        hangUp();
      case PushCallAction.appResumed:
        if (_callFromPush || _waitingForInvite) {
          unawaited(processPendingPushCall(accept: _waitingForInvite));
        } else {
          _socketDisconnectedForBackground = false;
          unawaited(ensureConnected());
        }
      case PushCallAction.appBackground:
        unawaited(disconnectSocketForBackground());
    }
  }

  /// Telnyx: disconnect socket when backgrounded so push is the wake mechanism.
  Future<void> disconnectSocketForBackground() async {
    if (state.inCall || state.hasIncoming || _waitingForInvite || _callFromPush) {
      return;
    }
    if (PushCallCoordinator.instance.suppressBackgroundDisconnect) return;
    if (_client == null) return;

    _presenceTimer?.cancel();
    _presenceTimer = null;
    PushCallCoordinator.instance.socketConnectedForInbound = false;

    try {
      _client?.disconnect();
    } catch (_) {}

    _socketDisconnectedForBackground = true;
    if (state.uiState == SoftphoneUiState.ready) {
      state = state.copyWith(
        uiState: SoftphoneUiState.connecting,
        status: 'Background — push will wake for calls',
      );
    }
  }

  void _onMissedIncomingCall(Map<String, dynamic>? data) {
    if (data != null && NativeIncomingCallUi.isMissedCallPush(data)) {
      NativeIncomingCallUi.handleMissedCallPush(data).catchError((_) {});
    } else if (_activeIncomingCallId != null) {
      NativeIncomingCallUi.endCall(_activeIncomingCallId!).catchError((_) {});
    }

    if (_lastFrom.isEmpty && data != null) {
      final meta = NativeIncomingCallUi.parsePushMetaData(data);
      if (meta != null) {
        _isInboundCall = true;
        _lastFrom = meta.callerNumber ?? '';
        _lastTo = state.callerId.isNotEmpty
            ? state.callerId
            : (state.config?.defaultCallerId ?? '');
      }
    }

    _ensureInboundLogContext();
    _logInboundCallEnd(status: 'no-answer');

    final callerNumber = state.incomingCallerNumber ?? _lastFrom;
    final callerName = state.incomingCallerName;
    if (callerNumber.isNotEmpty) {
      MissedCallNotifier.showMissedCall(
        callerNumber: callerNumber,
        callerName: callerName,
      ).catchError((_) {});
    }

    TelnyxClient.clearPushMetaData();
    _clearIncomingState();
    if (_client != null && !state.inCall) {
      state = state.copyWith(
        uiState: SoftphoneUiState.ready,
        status: '',
        clearIncoming: true,
      );
    }
  }

  void _ensureInboundLogContext() {
    if (_lastFrom.isNotEmpty) return;
    final caller = state.incomingCallerNumber;
    if (caller == null || caller.isEmpty) return;
    _isInboundCall = true;
    _lastFrom = caller;
    _lastTo = state.callerId.isNotEmpty
        ? state.callerId
        : (state.config?.defaultCallerId ?? '');
  }

  void _logInboundCallEnd({required String status}) {
    if (!_isInboundCall) return;
    final from = _lastFrom;
    final to = _lastTo;
    if (from.isEmpty || to.isEmpty) return;

    final duration = state.elapsedSeconds > 0 ? state.elapsedSeconds : null;
    _repository
        .logCall(
          from: from,
          to: to,
          direction: 'inbound',
          status: status,
          durationSeconds: duration,
        )
        .then((_) {
          ref.invalidate(callHistoryProvider);
          ref.invalidate(dashboardStatsProvider);
        })
        .catchError((_) {});
  }

  void _clearIncomingState() {
    _pendingInvite = null;
    _waitingForInvite = false;
    _callFromPush = false;
    _activeIncomingCallId = null;
  }

  void _onClientReady() {
    if (_client == null) return;
    _socketDisconnectedForBackground = false;
    PushCallCoordinator.instance.socketConnectedForInbound = true;
    state = state.copyWith(
      uiState: SoftphoneUiState.ready,
      status: '',
      clearError: true,
    );
    unawaited(WebRtcAudioHelper.ensureMicrophonePermission());
    _repository.setPresence(online: true).catchError((_) {});
    _startPresenceHeartbeat();
  }

  void _startPresenceHeartbeat() {
    _presenceTimer?.cancel();
    _presenceTimer = Timer.periodic(const Duration(minutes: 2), (_) {
      if (state.uiState == SoftphoneUiState.ready ||
          state.uiState == SoftphoneUiState.active ||
          state.uiState == SoftphoneUiState.calling) {
        _repository.setPresence(online: true).catchError((_) {});
      }
    });
  }

  void setCallerId(String value) {
    if (state.inCall || state.hasIncoming) return;
    state = state.copyWith(callerId: value);
  }

  void setDestination(String value) {
    if (state.inCall || state.hasIncoming) return;
    state = state.copyWith(destination: value);
  }

  /// Waits until Telnyx WebSocket is registered, or times out.
  Future<bool> waitUntilReady({
    Duration timeout = const Duration(seconds: 45),
  }) async {
    if (state.uiState == SoftphoneUiState.ready && _client != null) {
      return true;
    }

    await ensureConnected();

    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      if (state.uiState == SoftphoneUiState.ready && _client != null) {
        return true;
      }
      if (state.uiState == SoftphoneUiState.error ||
          state.uiState == SoftphoneUiState.notConfigured ||
          state.uiState == SoftphoneUiState.noNumbers) {
        return false;
      }
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
    return false;
  }

  /// Pre-fills the dialer and places an outbound call when the softphone is ready.
  Future<void> callNumber(String rawNumber) async {
    final normalized = normalizeDialableNumber(rawNumber);
    if (normalized == null) {
      state = state.copyWith(error: 'Invalid phone number');
      return;
    }
    if (state.inCall || state.hasIncoming) {
      state = state.copyWith(error: 'End the current call first');
      return;
    }

    state = state.copyWith(
      destination: normalized,
      clearError: true,
      status: state.uiState == SoftphoneUiState.ready
          ? 'Calling ${formatDisplayNumber(normalized)}…'
          : 'Connecting softphone…',
    );

    if (state.uiState != SoftphoneUiState.ready) {
      final ready = await waitUntilReady();
      if (!ready) {
        state = state.copyWith(
          error: state.error ??
              'Softphone is not connected. Open the Phone tab and wait for '
              '"Connected · ready for calls", then try again.',
          status: '',
        );
        return;
      }
    }

    if (state.callerId.isNotEmpty) {
      await placeCall();
    }
  }

  void appendDigit(String digit) {
    if (state.inCall || state.hasIncoming) return;
    state = state.copyWith(destination: state.destination + digit);
  }

  void backspace() {
    if (state.inCall || state.destination.isEmpty) return;
    state = state.copyWith(
      destination: state.destination.substring(0, state.destination.length - 1),
    );
  }

  Future<void> placeCall() async {
    final client = _client;
    final destination = normalizeDialableNumber(state.destination);
    final callerId = state.callerId;

    if (client == null ||
        destination == null ||
        callerId.isEmpty ||
        state.uiState != SoftphoneUiState.ready) {
      return;
    }

    final micGranted = await WebRtcAudioHelper.ensureMicrophonePermission();
    if (!micGranted) {
      state = state.copyWith(
        error: 'Microphone permission is required to place calls',
      );
      return;
    }
    await WebRtcAudioHelper.prepareForCall();

    final user = ref.read(authControllerProvider).asData?.value;
    _lastFrom = callerId;
    _lastTo = destination;
    _recordingStarted = false;
    _isInboundCall = false;
    _endingCall = false;

    state = state.copyWith(
      uiState: SoftphoneUiState.calling,
      status: 'Calling ${formatDisplayNumber(destination)}…',
      clearError: true,
      recordingActive: false,
      elapsedSeconds: 0,
    );

    try {
      final call = client.newInvite(
        user?.name ?? 'VSP Agent',
        callerId,
        destination,
        'vsp-mobile-outbound',
        debug: kDebugMode,
        mutedMicOnStart: false,
        audioConstraints: WebRtcAudioHelper.callAudioConstraints(),
      );
      _activeCall = call;
      _wireCallHandlers(call);
      if (defaultTargetPlatform == TargetPlatform.iOS) {
        final outboundCallId = call.callId;
        if (outboundCallId != null && outboundCallId.isNotEmpty) {
          unawaited(
            NativeIncomingCallUi.startOutboundCallKit(
              callId: outboundCallId,
              handle: destination,
              callerName: user?.name ?? 'VSP Agent',
            ),
          );
        }
      }
    } catch (error) {
      _activeCall = null;
      state = state.copyWith(
        uiState: SoftphoneUiState.ready,
        status: '',
        error: error.toString(),
      );
    }
  }

  void _wireCallHandlers(Call call, {bool inbound = false}) {
    WebRtcAudioHelper.wireCallAudio(call);
    call.callHandler.onCallStateChanged = (callState) {
      _handleTelnyxCallState(call, callState, inbound: inbound);
    };
  }

  /// Maps Telnyx CallState + socket events to UI (see Telnyx WebRTC SDK docs).
  void _handleTelnyxCallState(
    Call call,
    CallState callState, {
    bool inbound = false,
  }) {
    switch (callState) {
      case CallState.newCall:
      case CallState.connecting:
        state = state.copyWith(
          uiState: SoftphoneUiState.calling,
          status: inbound
              ? 'Connecting…'
              : 'Calling ${formatDisplayNumber(_lastTo)}…',
        );
        return;
      case CallState.ringing:
        unawaited(
          WebRtcAudioHelper.prepareForCall().then((_) {
            if (_activeCall != null) {
              WebRtcAudioHelper.ensureRemoteAudioReceiving(_activeCall!);
            }
          }),
        );
        state = state.copyWith(
          uiState: SoftphoneUiState.calling,
          status: inbound
              ? 'Incoming…'
              : 'Ringing ${formatDisplayNumber(_lastTo)}…',
        );
        return;
      case CallState.active:
        _onCallActive(call);
        return;
      case CallState.done:
      case CallState.dropped:
        _onCallEnded(call);
        return;
      case CallState.error:
        if (state.uiState == SoftphoneUiState.active &&
            _activeCall?.callId == call.callId) {
          return;
        }
        _onCallEnded(call);
        return;
      case CallState.held:
        state = state.copyWith(status: 'On hold');
        return;
      case CallState.reconnecting:
        state = state.copyWith(status: 'Reconnecting…');
        return;
      case CallState.renegotiation:
        return;
    }
  }

  void _onCallActive(Call call) {
    if (state.uiState == SoftphoneUiState.active &&
        _activeCall?.callId == call.callId) {
      return;
    }
    _activeCall = call;
    NativeIncomingCallUi.dismissAll().catchError((_) {});
    debugPrint('[WebRTC Audio] Call ACTIVE ${call.callId}');
    unawaited(
      WebRtcAudioHelper.onMediaConnected(
        call,
        preferSpeaker: _preferSpeaker,
      ),
    );
    state = state.copyWith(
      uiState: SoftphoneUiState.active,
      status: 'Call in progress',
      muted: false,
      clearError: true,
    );
    _startDurationTimer();

    if (state.config?.callRecordingEnabled == true && !_recordingStarted) {
      final callControlId = call.telnyxCallControlId;
      if (callControlId != null && callControlId.isNotEmpty) {
        _recordingStarted = true;
        _repository
            .startRecording(
              callControlId: callControlId,
              from: _lastFrom,
              to: _lastTo,
            )
            .then((started) {
              if (started) {
                state = state.copyWith(recordingActive: true);
              }
            })
            .catchError((_) {
              _recordingStarted = false;
            });
      }
    }
  }

  void _onCallEnded(Call call) {
    if (_endingCall) return;
    WebRtcAudioHelper.stopCallAudioKeepalive();
    if (!state.inCall &&
        state.uiState != SoftphoneUiState.incoming &&
        state.uiState != SoftphoneUiState.calling) {
      return;
    }
    _endingCall = true;
    _stopDurationTimer();
    final from = _lastFrom;
    final to = _lastTo;
    final duration = state.elapsedSeconds;

    if (from.isNotEmpty && to.isNotEmpty) {
      _repository
          .logCall(
            callSid: call.callId,
            from: from,
            to: to,
            direction: _isInboundCall ? 'inbound' : 'outbound',
            durationSeconds: duration > 0 ? duration : null,
          )
          .then((_) {
            ref.invalidate(callHistoryProvider);
            ref.invalidate(dashboardStatsProvider);
          })
          .catchError((_) {});
    }

    if (_activeIncomingCallId != null) {
      NativeIncomingCallUi.endCall(_activeIncomingCallId!).catchError((_) {});
    }
    NativeIncomingCallUi.dismissAll().catchError((_) {});

    _activeCall = null;
    _recordingStarted = false;
    _lastFrom = '';
    _lastTo = '';
    _isInboundCall = false;
    _clearIncomingState();

    if (_client != null) {
      state = state.copyWith(
        uiState: SoftphoneUiState.ready,
        status: '',
        recordingActive: false,
        elapsedSeconds: 0,
        muted: false,
      );
      _repository.setPresence(online: true).catchError((_) {});
    }
    _endingCall = false;
  }

  /// Telnyx docs: BYE socket event — remote hangup / rejected / ended.
  void _onRemoteHangup(TelnyxMessage message) {
    final call = _resolveCall(message);
    if (call != null) {
      _activeCall = call;
      _onCallEnded(call);
      return;
    }
    if (_activeCall != null) {
      _onCallEnded(_activeCall!);
    }
  }

  void hangUp() {
    final call = _activeCall;
    if (call == null) return;
    try {
      call.endCall();
    } catch (_) {
      _onCallEnded(call);
    }
  }

  void toggleMute() {
    final call = _activeCall;
    if (call == null || !state.inCall) return;
    final nextMuted = !state.muted;
    call.setMuteState(nextMuted);
    debugPrint('[WebRTC Audio] Mute set to $nextMuted');
    state = state.copyWith(muted: nextMuted);
  }

  void toggleSpeaker() {
    final call = _activeCall;
    if (call == null) return;
    _preferSpeaker = !call.speakerPhone;
    _activeAudioRoute =
        _preferSpeaker ? AudioRouteKind.speaker : AudioRouteKind.earpiece;
    WebRtcAudioHelper.setPreferSpeaker(_preferSpeaker);
    unawaited(
      WebRtcAudioHelper.configureActiveCall(
        call,
        preferSpeaker: _preferSpeaker,
      ),
    );
    debugPrint('[WebRTC Audio] Speakerphone set to $_preferSpeaker');
  }

  AudioRouteKind get activeAudioRoute => _activeAudioRoute;

  Future<void> applyAudioRouteKind(AudioRouteKind kind) async {
    _activeAudioRoute = kind;
    _preferSpeaker = kind == AudioRouteKind.speaker;
    WebRtcAudioHelper.setPreferSpeaker(_preferSpeaker);
  }

  Call? get activeCall => _activeCall;

  bool get speakerEnabled => _preferSpeaker;

  Future<void> disconnect() async {
    await _teardown();
    state = const SoftphoneState();
  }

  Future<void> _teardown({bool resetInitialized = true}) async {
    _stopDurationTimer();
    _presenceTimer?.cancel();
    _presenceTimer = null;
    _tokenRefreshTimer?.cancel();
    _tokenRefreshTimer = null;
    PushCallCoordinator.instance.socketConnectedForInbound = false;
    _answeringCall = false;
    WebRtcAudioHelper.stopCallAudioKeepalive();

    try {
      _activeCall?.endCall();
    } catch (_) {}

    try {
      _client?.disconnect();
    } catch (_) {}

    _client = null;
    _activeCall = null;
    _recordingStarted = false;

    _lastTokenConfig = null;
    _pushToken = null;
    _clearIncomingState();

    if (resetInitialized) {
      _initialized = false;
    }

    await _repository.setPresence(online: false).catchError((_) {});

    try {
      final deviceId = await DeviceInstallService.deviceId();
      await _repository.unregisterDevice(deviceId);
    } catch (_) {}
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      state = state.copyWith(elapsedSeconds: state.elapsedSeconds + 1);
    });
  }

  void _stopDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = null;
  }
}

extension _FirstOrNull<E> on List<E> {
  E? get firstOrNull => isEmpty ? null : first;
}
