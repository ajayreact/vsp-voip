'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSoftphoneV2Enabled } from '@/lib/softphone-config';
import { TelnyxRTC } from '@telnyx/webrtc';
import type { Call } from '@telnyx/webrtc';
import {
  getSoftphoneConfig,
  getSoftphoneDiagnostics,
  getSoftphoneToken,
  isUnauthorizedError,
  logSoftphoneCall,
  setSoftphonePresence,
  startSoftphoneRecording,
} from '@/lib/api';
import type { SoftphoneConfig, SoftphoneDiagnostics } from '@/lib/api';
import { TenantOnlyGate } from '@/components/tenant-only-gate';
import {
  playOutboundRingback,
  primeCallAudio,
  startIncomingRingtone,
  stopAllCallSounds,
  stopIncomingRingtone,
} from '@/lib/call-sounds';
import {
  attachRemoteCallAudio,
  detachRemoteCallAudio,
  wireWebCallAudio,
} from '@/lib/webrtc-audio';
import {
  errorSoftphone,
  formatCallFailureReason,
  isTerminalCallState,
  logPeerConnectionDiagnostics,
  logSoftphone,
  logTelnyxError,
  normalizeCallState,
  summarizeCall,
  summarizeNotification,
  warnSoftphone,
  watchCallState,
  wireCallDebugHandlers,
} from '@/lib/telnyx-debug';
import {
  extractCallFromNotification,
  isConnectingCallState,
  isInboundCall,
  resolveRemoteCallerNumber,
  shouldTrackInboundCall,
  type TelnyxSoftphoneNotification,
} from '@/lib/softphone-call-utils';
import {
  bindRemoteAudioTarget,
  buildTelnyxClientOptions,
  REMOTE_AUDIO_ELEMENT_ID,
  scheduleTelnyxReconnect,
  waitForRemoteAudioElement,
} from '@/lib/telnyx-softphone-session';
import {
  assignDebugGlobals,
  attachCallTraceListeners,
  createCallTraceSink,
  describeCallObject,
  hangupTrackedCall,
  startOutboundDeepTrace,
  traceGetUserMedia,
  validateOutboundCallObject,
  type CallTraceEvent,
} from '@/lib/softphone-call-trace';

type UiState = 'loading' | 'not-configured' | 'no-numbers' | 'connecting' | 'ready' | 'incoming' | 'calling' | 'active' | 'error';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const EXTENSION_DIAL_PATTERN = /^\d{2,6}$/;

function isExtensionDialInput(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  return EXTENSION_DIAL_PATTERN.test(digits);
}

function isPstnDialInput(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  return digits.length >= 10;
}

type TelnyxErrorEvent = {
  error?: {
    message?: string;
    description?: string;
    code?: number;
    name?: string;
  };
  sessionId?: string;
  recoverable?: boolean;
};

function formatTelnyxError(event: unknown) {
  if (!event || typeof event !== 'object') return 'Softphone connection failed';
  const payload = event as TelnyxErrorEvent;
  if (payload.error?.message) return payload.error.message;
  if (payload.error?.description) return payload.error.description;
  if (payload.error?.name) return payload.error.name;
  if ('message' in event && typeof (event as Error).message === 'string') {
    return (event as Error).message;
  }
  return 'Softphone connection failed';
}

async function ensureMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not available in this browser');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function formatCallDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function normalizeDialNumber(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  if (!digits) return '';
  if (value.trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export default function SoftphonePage() {
  return (
    <TenantOnlyGate featureName="Softphone">
      <SoftphoneLegacyGate />
    </TenantOnlyGate>
  );
}

function SoftphoneLegacyGate() {
  const router = useRouter();

  useEffect(() => {
    if (isSoftphoneV2Enabled()) {
      router.replace('/softphone-v2');
    }
  }, [router]);

  if (isSoftphoneV2Enabled()) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Redirecting to softphone…
      </p>
    );
  }

  return <SoftphoneContent />;
}

function SoftphoneContent() {
  const clientRef = useRef<TelnyxRTC | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const outboundCallRef = useRef<Call | null>(null);
  const callTraceSinkRef = useRef(createCallTraceSink(() => {}));
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callerIdRef = useRef('');
  const destinationRef = useRef('');
  const recordingStartedRef = useRef(false);

  const [uiState, setUiState] = useState<UiState>('loading');
  const [status, setStatus] = useState('Starting softphone…');
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('');
  const [callerId, setCallerId] = useState('');
  const [numbers, setNumbers] = useState<{ id: string; number: string }[]>([]);
  const [callRecordingEnabled, setCallRecordingEnabled] = useState(true);
  const [voiceWebhookUrl, setVoiceWebhookUrl] = useState('');
  const [callControlHint, setCallControlHint] = useState('');
  const [webrtcSetupMessage, setWebrtcSetupMessage] = useState('');
  const [outboundReady, setOutboundReady] = useState(true);
  const [inboundReady, setInboundReady] = useState(false);
  const [inboundRoutingMessage, setInboundRoutingMessage] = useState('');
  const [sipUsername, setSipUsername] = useState('');
  const [webrtcDialUri, setWebrtcDialUri] = useState('');
  const [telnyxArchitecture, setTelnyxArchitecture] = useState<SoftphoneConfig['telnyxArchitecture']>();
  const [incomingFrom, setIncomingFrom] = useState('');
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const [callRecordingActive, setCallRecordingActive] = useState(false);
  const callRecordingEnabledRef = useRef(true);
  const bootGenerationRef = useRef(0);
  const tearingDownRef = useRef(false);
  const unwireCallAudioRef = useRef<(() => void) | null>(null);
  const audioPrimedRef = useRef(false);
  const callingTimeoutRef = useRef<number | null>(null);
  const outboundTraceStopRef = useRef<(() => void) | null>(null);
  const callWatchCleanupRef = useRef<(() => void) | null>(null);
  const callReachedActiveRef = useRef(false);
  const clientReadyRef = useRef(false);
  const watchedCallIdRef = useRef<string | null>(null);
  const applyCallUpdateRef = useRef<(call: Call) => void>(() => {});
  const bindTrackedCallRef = useRef<(call: Call, label: string) => void>(() => {});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [telnyxReady, setTelnyxReady] = useState(false);
  const [tokenStatus, setTokenStatus] = useState('Loading…');
  const [serverDiagnostics, setServerDiagnostics] = useState<SoftphoneDiagnostics | null>(null);
  const [lastInviteReceived, setLastInviteReceived] = useState<string | null>(null);
  const [debugCallId, setDebugCallId] = useState<string | null>(null);
  const [debugCallState, setDebugCallState] = useState<string>('—');
  const [debugCallDestination, setDebugCallDestination] = useState<string>('—');
  const [lastCallEvent, setLastCallEvent] = useState<string>('None');
  const [hangupObjectMatch, setHangupObjectMatch] = useState<string>('—');

  useEffect(() => {
    if (uiState !== 'active') {
      setCallElapsedSeconds(0);
      return undefined;
    }

    setCallElapsedSeconds(0);
    const timerId = window.setInterval(() => {
      setCallElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [uiState]);

  useEffect(() => {
    callerIdRef.current = callerId;
  }, [callerId]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    callRecordingEnabledRef.current = callRecordingEnabled;
  }, [callRecordingEnabled]);

  useEffect(() => {
    if (uiState === 'incoming') {
      void startIncomingRingtone();
      return () => {
        stopIncomingRingtone();
      };
    }
    stopIncomingRingtone();
    return undefined;
  }, [uiState]);

  useEffect(() => {
    callTraceSinkRef.current = createCallTraceSink((entry: CallTraceEvent) => {
      setLastCallEvent(`${entry.at} — ${entry.source}: ${entry.event}${entry.state ? ` (${entry.state})` : ''}`);
    });
  }, []);

  const syncDebugCallState = useCallback((call: Call | null, dest?: string) => {
    assignDebugGlobals(clientRef.current, call);
    setDebugCallId(call?.id ?? null);
    setDebugCallState(call ? normalizeCallState(call.state) || 'unknown' : '—');
    if (dest !== undefined) {
      setDebugCallDestination(dest || '—');
    }
  }, []);

  const ensureAudioPrimed = useCallback(async () => {
    if (audioPrimedRef.current) return;
    await primeCallAudio(remoteAudioRef.current);
    audioPrimedRef.current = true;
  }, []);

  const clearCallingTimeout = useCallback(() => {
    if (callingTimeoutRef.current != null) {
      window.clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }
  }, []);

  const clearCallWatch = useCallback(() => {
    callWatchCleanupRef.current?.();
    callWatchCleanupRef.current = null;
  }, []);

  const clearOutboundTrace = useCallback(() => {
    outboundTraceStopRef.current?.();
    outboundTraceStopRef.current = null;
  }, []);

  const resetOutboundCallUi = useCallback((message: string, callError = '') => {
    clearCallingTimeout();
    clearOutboundTrace();
    clearCallWatch();
    watchedCallIdRef.current = null;
    activeCallRef.current = null;
    outboundCallRef.current = null;
    callReachedActiveRef.current = false;
    unwireCallAudioRef.current?.();
    unwireCallAudioRef.current = null;
    detachRemoteCallAudio(remoteAudioRef.current);
    recordingStartedRef.current = false;
    setCallRecordingActive(false);
    setIncomingFrom('');
    syncDebugCallState(null);
    setUiState('ready');
    setStatus(message);
    setError(callError);
  }, [clearCallingTimeout, clearCallWatch, clearOutboundTrace, syncDebugCallState]);

  const startCallingTimeout = useCallback(() => {
    clearCallingTimeout();
    callingTimeoutRef.current = window.setTimeout(() => {
      const call = activeCallRef.current;
      warnSoftphone('Call stuck in calling state — timing out', summarizeCall(call));
      if (call) {
        void logPeerConnectionDiagnostics(call, 'stuck-calling-timeout');
      }
      clearOutboundTrace();
      clearCallWatch();
      stopAllCallSounds();
      call?.hangup();
      activeCallRef.current = null;
      outboundCallRef.current = null;
      syncDebugCallState(null);
      setUiState('ready');
      setStatus('Connected — ready for inbound and outbound calls');
      setError(formatCallFailureReason(call));
    }, 45000);
  }, [clearCallingTimeout, clearCallWatch, clearOutboundTrace, syncDebugCallState]);

  useEffect(() => {
    const generation = ++bootGenerationRef.current;
    tearingDownRef.current = false;
    let mounted = true;
    let client: TelnyxRTC | null = null;
    let cancelReconnect: (() => void) | null = null;

    async function boot() {
      try {
        setUiState('loading');
        setStatus('Starting softphone…');
        setError('');

        const config = await getSoftphoneConfig();
        if (!mounted || generation !== bootGenerationRef.current) return;

        logSoftphone('Softphone config loaded', {
          configured: config.configured,
          credentialConnectionId: config.credentialConnectionId,
          numbers: config.numbers?.length ?? 0,
          voiceWebhookUrl: config.voiceWebhookUrl,
          callControlSetup: config.callControlSetup,
        });

        setNumbers(config.numbers);
        setCallRecordingEnabled(config.callRecordingEnabled);
        callRecordingEnabledRef.current = config.callRecordingEnabled;
        setVoiceWebhookUrl(config.voiceWebhookUrl || '');
        setCallControlHint(config.callControlSetup?.message || '');
        setWebrtcSetupMessage(config.webrtcSetup?.message || '');
        setOutboundReady(config.webrtcSetup?.outboundReady !== false);
        setInboundReady(config.inboundRouting?.ready === true);
        setInboundRoutingMessage(config.inboundRouting?.message || '');
        setSipUsername(config.sipUsername || config.webrtcSession?.sipUsername || '');
        setWebrtcDialUri(config.webrtcSession?.dialUri || '');
        setTelnyxArchitecture(config.telnyxArchitecture);
        const defaultId = config.defaultCallerId || config.numbers[0]?.number || '';
        setCallerId(defaultId);
        callerIdRef.current = defaultId;

        getSoftphoneDiagnostics()
          .then((diagnostics) => {
            if (mounted && generation === bootGenerationRef.current) {
              setServerDiagnostics(diagnostics);
            }
          })
          .catch((err) => {
            warnSoftphone('Softphone diagnostics fetch failed', err);
          });

        if (!config.configured) {
          setUiState('not-configured');
          setStatus('WebRTC credential connection is not configured');
          return;
        }
        if (!config.numbers.length) {
          setUiState('no-numbers');
          setStatus('Assign a phone number before placing calls');
          return;
        }

        setUiState('connecting');
        setStatus('Requesting secure login token…');
        setTokenStatus('Requesting…');
        const tokenRes = await getSoftphoneToken();
        if (!mounted || generation !== bootGenerationRef.current) return;

        logSoftphone('Login token received', {
          sipUsername: tokenRes.sipUsername,
          credentialConnectionId: tokenRes.credentialConnectionId,
          expiresInSeconds: tokenRes.expiresInSeconds,
        });
        setTokenStatus(
          tokenRes.loginToken?.trim()
            ? `Valid (${tokenRes.loginToken.trim().length} chars, expires ${tokenRes.expiresInSeconds}s)`
            : 'Empty — Telnyx did not return a JWT',
        );

        if (tokenRes.sipUsername) {
          setSipUsername(tokenRes.sipUsername);
        }

        if (!tokenRes.loginToken?.trim()) {
          throw new Error('Telnyx login token was empty. Check API logs and TELNYX_API_KEY.');
        }

        clientReadyRef.current = false;
        watchedCallIdRef.current = null;
        setTelnyxReady(false);

        setStatus('Preparing audio and WebRTC session…');
        const remoteAudioEl = await waitForRemoteAudioElement(remoteAudioRef);

        const clientOptions = buildTelnyxClientOptions(tokenRes.loginToken);
        client = new TelnyxRTC(clientOptions);
        bindRemoteAudioTarget(client, remoteAudioEl);
        clientRef.current = client;

        function bindTrackedCall(call: Call, label: string) {
          if (watchedCallIdRef.current === call.id && callWatchCleanupRef.current) {
            logSoftphone('[SOFTPHONE] bindTrackedCall skipped — already tracking call', {
              callId: call.id,
              label,
            });
            return;
          }

          clearCallWatch();
          watchedCallIdRef.current = call.id;
          callReachedActiveRef.current = false;
          activeCallRef.current = call;
          outboundCallRef.current = call;
          syncDebugCallState(call);
          logSoftphone('[SOFTPHONE] Current call stored', describeCallObject(call));
          attachCallTraceListeners(call, label, callTraceSinkRef.current);
          callWatchCleanupRef.current = watchCallState(call, label, (currentCall, state) => {
            callTraceSinkRef.current.record({
              source: `${label}:watchCallState`,
              event: 'state-change',
              callId: currentCall.id,
              state,
            });
            syncDebugCallState(currentCall);
            applyCallUpdateRef.current(currentCall);
          });
          void logPeerConnectionDiagnostics(call, `${label}: immediate`);
          applyCallUpdateRef.current(call);
        }

        bindTrackedCallRef.current = bindTrackedCall;

        function applyCallUpdate(call: Call) {
          if (generation !== bootGenerationRef.current) return;

          activeCallRef.current = call;
          const state = normalizeCallState(call.state);
          const inbound = isInboundCall(call);
          const remoteNumber = resolveRemoteCallerNumber(call);

          logSoftphone('applyCallUpdate', describeCallObject(call));
          callTraceSinkRef.current.record({
            source: 'applyCallUpdate',
            event: 'ui-sync',
            callId: call.id,
            state,
            detail: { inbound, remoteNumber },
          });
          void logPeerConnectionDiagnostics(call, `applyCallUpdate:${state}`);

          if (isConnectingCallState(state)) {
            if (inbound) {
              setIncomingFrom(remoteNumber || 'Unknown caller');
              setUiState('incoming');
              setStatus(`Incoming call from ${remoteNumber || 'unknown'}`);
            } else {
              setUiState('calling');
              setStatus(`Calling ${destinationRef.current || '…'}`);
              void playOutboundRingback(call);
            }
          }

          if (state === 'active') {
            callReachedActiveRef.current = true;
            clearCallingTimeout();
            stopAllCallSounds();
            call.stopRingback?.();
            call.stopRingtone?.();
            logSoftphone('Call answered', {
              callId: call.id,
              inbound,
              remoteNumber,
            });
            unwireCallAudioRef.current?.();
            unwireCallAudioRef.current = wireWebCallAudio(
              call,
              remoteAudioRef.current,
              () => setAudioBlocked(true),
            );
            setUiState('active');
            setStatus(inbound ? `In call with ${remoteNumber || incomingFrom}` : 'Call in progress');
            setError('');
            setCallRecordingActive(false);
            const logFrom = inbound ? remoteNumber || incomingFrom : callerIdRef.current;
            const logTo = inbound ? callerIdRef.current || remoteNumber : destinationRef.current;
            if (
              callRecordingEnabledRef.current
              && !recordingStartedRef.current
              && logFrom
              && logTo
            ) {
              const callControlId = call.telnyxIDs?.telnyxCallControlId;
              if (callControlId) {
                recordingStartedRef.current = true;
                startSoftphoneRecording({
                  callControlId,
                  from: logFrom,
                  to: logTo,
                })
                  .then(() => {
                    setCallRecordingActive(true);
                  })
                  .catch((err) => {
                    console.error(err);
                    recordingStartedRef.current = false;
                  });
              }
            }
          }

          if (isTerminalCallState(state)) {
            clearCallingTimeout();
            clearCallWatch();
            watchedCallIdRef.current = null;
            stopAllCallSounds();
            call.stopRingback?.();
            call.stopRingtone?.();
            logSoftphone('Call ended', {
              callId: call.id,
              state,
              inbound,
              remoteNumber,
            });
            unwireCallAudioRef.current?.();
            unwireCallAudioRef.current = null;
            detachRemoteCallAudio(remoteAudioRef.current);
            setAudioBlocked(false);
            setStatus('Call ended');
            recordingStartedRef.current = false;
            setCallRecordingActive(false);

            if (!inbound && !callReachedActiveRef.current) {
              setError(formatCallFailureReason(call));
            } else {
              setError('');
            }

            const logFrom = inbound ? remoteNumber || incomingFrom : callerIdRef.current;
            const logTo = inbound ? callerIdRef.current : destinationRef.current;
            if (logFrom && logTo && callReachedActiveRef.current) {
              logSoftphoneCall({
                callSid: call.id,
                from: logFrom,
                to: logTo,
                status: 'completed',
              }).catch(() => {});
            }

            activeCallRef.current = null;
            outboundCallRef.current = null;
            callReachedActiveRef.current = false;
            setIncomingFrom('');
            syncDebugCallState(null);
            if (mounted && generation === bootGenerationRef.current) {
              setUiState('ready');
              setStatus('Connected — ready for inbound and outbound calls');
            }
          }
        }

        function handleTelnyxNotification(notification: TelnyxSoftphoneNotification) {
          logSoftphone('telnyx.notification', summarizeNotification(notification));
          if (generation !== bootGenerationRef.current) return;

          const type = String(notification.type || '');
          callTraceSinkRef.current.record({
            source: 'client:telnyx.notification',
            event: type || 'unknown',
            callId: notification.call?.id ?? null,
            state: notification.call ? normalizeCallState(notification.call.state) : undefined,
            detail: summarizeNotification(notification),
          });

          if (type === 'callUpdate' && notification.call) {
            const call = notification.call;
            const state = normalizeCallState(call.state);

            if (state === 'ringing' && isInboundCall(call)) {
              const from = resolveRemoteCallerNumber(call);
              logSoftphone('Incoming INVITE received', {
                from,
                callerNumber: (call as Call & { options?: { callerNumber?: string } }).options?.callerNumber,
                call: summarizeCall(call),
              });
              setLastInviteReceived(
                `${new Date().toLocaleTimeString()} — ${from || 'Unknown caller'}`,
              );
            }
          }

          // Telnyx JS SDK maps telnyx_rtc.invite → callUpdate with call.state=ringing (direction=inbound).
          // Some SDK builds also emit type=invite or participantData (telnyx_rtc.attach).
          const call = extractCallFromNotification(notification);
          if (!call) {
            if (type === 'invite' && notification.call) {
              const from = resolveRemoteCallerNumber(notification.call);
              logSoftphone('Incoming INVITE received (invite notification)', {
                from,
                call: summarizeCall(notification.call),
              });
              setLastInviteReceived(
                `${new Date().toLocaleTimeString()} — ${from || 'Unknown caller'}`,
              );
              bindTrackedCall(notification.call, 'inbound-invite');
            }
            return;
          }

          if (shouldTrackInboundCall(call, watchedCallIdRef.current)) {
            bindTrackedCall(call, `inbound-${type || 'event'}`);
          } else if (!watchedCallIdRef.current && isConnectingCallState(normalizeCallState(call.state))) {
            bindTrackedCall(call, `tracked-${type || 'event'}`);
          } else {
            applyCallUpdate(call);
            return;
          }

          applyCallUpdate(call);
        }

        applyCallUpdateRef.current = applyCallUpdate;

        client.on('telnyx.socket.open', () => {
          logSoftphone('telnyx.socket.open — WebSocket signaling connected');
        });

        client.on('telnyx.socket.close', (event: unknown) => {
          warnSoftphone('telnyx.socket.close', event);
          if (!mounted || tearingDownRef.current || generation !== bootGenerationRef.current) return;
          clientReadyRef.current = false;
          setTelnyxReady(false);
          setStatus('Reconnecting to Telnyx…');
          cancelReconnect?.();
          cancelReconnect = scheduleTelnyxReconnect(
            () => client?.connect(),
            () => tearingDownRef.current || !mounted || generation !== bootGenerationRef.current,
          );
        });

        client.on('telnyx.ready', () => {
          if (!mounted || generation !== bootGenerationRef.current || tearingDownRef.current) return;
          cancelReconnect?.();
          cancelReconnect = null;
          clientReadyRef.current = true;
          setTelnyxReady(true);
          logSoftphone('telnyx.ready — WebRTC client registered with Telnyx', {
            sipUsername: tokenRes.sipUsername || config.sipUsername,
            region: clientOptions.region || 'auto',
            remoteElement: REMOTE_AUDIO_ELEMENT_ID,
          });
          syncDebugCallState(null);
          assignDebugGlobals(client, null);
          setUiState('ready');
          setStatus('Connected — ready for inbound and outbound calls');
          setError('');
          setSoftphonePresence(true).catch(() => {});
        });

        client.on('telnyx.error', (event: unknown) => {
          if (!mounted || generation !== bootGenerationRef.current || tearingDownRef.current) return;
          logTelnyxError(event);
          clientReadyRef.current = false;
          setTelnyxReady(false);
          setUiState('error');
          setError(formatTelnyxError(event));
        });

        client.on('telnyx.notification', handleTelnyxNotification);

        logSoftphone('TelnyxRTC client configured', {
          region: clientOptions.region || 'auto',
          credentialConnectionId: tokenRes.credentialConnectionId || config.credentialConnectionId,
          sipUsername: tokenRes.sipUsername || config.sipUsername,
          loginTokenLength: tokenRes.loginToken.trim().length,
        });

        setStatus('Connecting to Telnyx…');
        logSoftphone('Calling client.connect()');
        client.connect();
      } catch (err) {
        if (!mounted || generation !== bootGenerationRef.current) return;
        setTokenStatus('Failed');
        if (!isUnauthorizedError(err)) {
          setUiState('error');
          setError(err instanceof Error ? err.message : 'Could not start softphone');
        }
      }
    }

    boot();

    return () => {
      mounted = false;
      tearingDownRef.current = true;
      cancelReconnect?.();
      cancelReconnect = null;
      clientReadyRef.current = false;
      setTelnyxReady(false);
      watchedCallIdRef.current = null;
      clearCallingTimeout();
      clearOutboundTrace();
      clearCallWatch();
      stopAllCallSounds();
      setSoftphonePresence(false).catch(() => {});
      try {
        activeCallRef.current?.hangup();
        client?.disconnect();
        if (clientRef.current === client) {
          clientRef.current = null;
        }
      } catch {
        /* ignore cleanup errors */
      }
    };
  }, [bootAttempt, clearCallingTimeout, clearCallWatch, clearOutboundTrace]);

  useEffect(() => {
    if (uiState !== 'ready' && uiState !== 'incoming' && uiState !== 'active' && uiState !== 'calling') {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSoftphonePresence(true).catch(() => {});
    }, 2 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [uiState]);

  const appendDigit = useCallback((digit: string) => {
    void ensureAudioPrimed();
    setDestination((prev) => prev + digit);
  }, [ensureAudioPrimed]);

  const onCall = useCallback(async () => {
    const client = clientRef.current;
    const dest = destination.trim();
    logSoftphone('[SOFTPHONE] Call button clicked', { destination: dest, callerId });

    if (!client || !dest || !callerId) {
      warnSoftphone('[SOFTPHONE] Call blocked — missing client, destination, or caller ID', {
        hasClient: Boolean(client),
        dest,
        callerId,
      });
      return;
    }

    if (!clientReadyRef.current) {
      setError('Softphone is still connecting to Telnyx. Wait until status shows “Connected”.');
      return;
    }

    setError('');
    recordingStartedRef.current = false;
    setCallRecordingActive(false);

    const extensionDigits = dest.replace(/\D/g, '');
    const isExtension = isExtensionDialInput(dest);
    const normalizedCallerId = normalizeDialNumber(callerId);
    const normalizedDest = isExtension ? extensionDigits : normalizeDialNumber(dest);

    if (!outboundReady && !isExtension) {
      setError(webrtcSetupMessage || 'Outbound calling is not configured on Telnyx. Assign an Outbound Voice Profile to the Credential Connection.');
      return;
    }

    try {
      await ensureMicrophoneAccess();
      await ensureAudioPrimed();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : 'UnknownError';
      callTraceSinkRef.current.record({
        source: 'getUserMedia',
        event: 'failure',
        detail: { name, error, phase: 'pre-dial ensureMicrophoneAccess' },
      });
      setError(err instanceof Error ? err.message : 'Microphone permission is required for calls');
      return;
    }

    const clientConnected = (client as TelnyxRTC & { connected?: boolean }).connected;

    logSoftphone('[SOFTPHONE] Creating Telnyx call', {
      destination: normalizedDest,
      callerId: normalizedCallerId,
      clientConnected,
      outboundReady,
      isExtension,
    });

    if (clientConnected === false) {
      warnSoftphone('Telnyx client reports not connected — call may fail');
    }

    const callOptions = {
      callerNumber: normalizedCallerId,
      audio: true as const,
      remoteElement: remoteAudioRef.current || REMOTE_AUDIO_ELEMENT_ID,
      debug: true,
      onNotification: (notification: TelnyxSoftphoneNotification) => {
        logSoftphone('[SOFTPHONE] call.onNotification', summarizeNotification(notification));
        const call = extractCallFromNotification(notification);
        if (call) {
          if (!watchedCallIdRef.current) {
            bindTrackedCallRef.current(call, 'outbound-onNotification');
          } else {
            syncDebugCallState(call);
            applyCallUpdateRef.current(call);
          }
        }
      },
    };

    let call: Call;
    try {
      call = isExtension
        ? client.newCall({
          ...callOptions,
          destinationNumber: extensionDigits,
        })
        : client.newCall({
          ...callOptions,
          destinationNumber: normalizedDest,
        });

      logSoftphone('[SOFTPHONE] Call object returned from newCall', describeCallObject(call));

      const validationError = validateOutboundCallObject(call);
      if (validationError) {
        throw new Error(validationError);
      }
    } catch (err) {
      console.error('CALL CREATION FAILED', err);
      errorSoftphone('CALL CREATION FAILED', err);
      resetOutboundCallUi(
        'Connected — ready for inbound and outbound calls',
        err instanceof Error ? err.message : 'Failed to start call',
      );
      return;
    }

    outboundCallRef.current = call;
    bindTrackedCallRef.current(call, isExtension ? 'outbound-extension' : 'outbound-pstn');

    if (activeCallRef.current !== call || outboundCallRef.current !== call) {
      errorSoftphone('[SOFTPHONE] Call storage mismatch after bindTrackedCall', {
        newCall: describeCallObject(call),
        activeCallRef: describeCallObject(activeCallRef.current),
        outboundCallRef: describeCallObject(outboundCallRef.current),
      });
      resetOutboundCallUi(
        'Connected — ready for inbound and outbound calls',
        'Call object was not stored in activeCallRef',
      );
      return;
    }

    assignDebugGlobals(client, call);
    logSoftphone('[SOFTPHONE] Verified call refs', {
      activeCallRef: activeCallRef.current === call,
      outboundCallRef: outboundCallRef.current === call,
      windowCurrentCall: (window as typeof window & { currentCall?: Call | null }).currentCall === call,
      windowTelnyxClient: (window as typeof window & { telnyxClient?: TelnyxRTC | null }).telnyxClient === client,
    });

    clearOutboundTrace();
    const gumResult = await traceGetUserMedia(callTraceSinkRef.current, call.id);
    const traceSession = startOutboundDeepTrace(client, call, callTraceSinkRef.current);
    traceSession.capture.getUserMediaOk = gumResult.ok;
    traceSession.capture.getUserMediaError = gumResult.error;
    outboundTraceStopRef.current = traceSession.stop;

    setDebugCallDestination(normalizedDest);
    setUiState('calling');
    setStatus(isExtension ? `Calling ext ${extensionDigits}…` : `Calling ${dest}…`);
    startCallingTimeout();
  }, [
    destination,
    callerId,
    ensureAudioPrimed,
    startCallingTimeout,
    clearOutboundTrace,
    outboundReady,
    webrtcSetupMessage,
    resetOutboundCallUi,
    syncDebugCallState,
  ]);

  const onEnableAudio = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    await ensureAudioPrimed();
    const playing = await attachRemoteCallAudio(call, remoteAudioRef.current);
    if (playing) setAudioBlocked(false);
  }, [ensureAudioPrimed]);

  const onHangup = useCallback(() => {
    const call = outboundCallRef.current ?? activeCallRef.current;
    const sameObject = outboundCallRef.current === activeCallRef.current;
    setHangupObjectMatch(
      call
        ? `outbound=${outboundCallRef.current === call}, active=${activeCallRef.current === call}, sameRef=${sameObject}`
        : 'no call object',
    );

    logSoftphone('[SOFTPHONE] Hang up clicked', {
      call: describeCallObject(call),
      outboundCallRef: describeCallObject(outboundCallRef.current),
      activeCallRef: describeCallObject(activeCallRef.current),
      windowCurrentCall: describeCallObject(
        (window as typeof window & { currentCall?: Call | null }).currentCall,
      ),
    });
    stopAllCallSounds();

    void hangupTrackedCall(call, 'onHangup', callTraceSinkRef.current).finally(() => {
      resetOutboundCallUi('Connected — ready for inbound and outbound calls');
    });
  }, [resetOutboundCallUi]);

  const onAnswer = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    try {
      stopIncomingRingtone();
      call.stopRingtone?.();
      await ensureMicrophoneAccess();
      await ensureAudioPrimed();

      const extended = call as Call & {
        options?: { remoteElement?: string | HTMLMediaElement; audio?: boolean };
      };
      if (extended.options) {
        extended.options.remoteElement = remoteAudioRef.current ?? REMOTE_AUDIO_ELEMENT_ID;
        extended.options.audio = true;
      }

      logSoftphone('Call answered (user action)', summarizeCall(call));
      call.answer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone permission is required');
    }
  }, [ensureAudioPrimed]);

  const onReject = useCallback(() => {
    stopAllCallSounds();
    activeCallRef.current?.hangup();
    setIncomingFrom('');
    setUiState('ready');
    setStatus('Connected — ready for inbound and outbound calls');
  }, []);

  const canDial = uiState === 'ready'
    && outboundReady
    && (isExtensionDialInput(destination) || isPstnDialInput(destination));
  const inCall = uiState === 'calling' || uiState === 'active' || uiState === 'incoming';

  if (uiState === 'loading') {
    return (
      <>
        <audio
          ref={remoteAudioRef}
          id={REMOTE_AUDIO_ELEMENT_ID}
          autoPlay
          playsInline
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
          aria-hidden
        />
        <div className="py-24 text-center text-slate-400">{status}</div>
      </>
    );
  }

  return (
    <>
      {/* Must exist before client.connect() — Telnyx attaches remote media here */}
      <audio
        ref={remoteAudioRef}
        id={REMOTE_AUDIO_ELEMENT_ID}
        autoPlay
        playsInline
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        aria-hidden
      />

    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Softphone</h2>
        <p className="text-sm text-slate-400">Place and receive calls from your browser using your business numbers.</p>
      </div>

      {callControlHint && !callControlHint.includes('configured') ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {callControlHint}
        </div>
      ) : null}

      {!outboundReady ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-900 space-y-2">
          <p><strong>Outbound calling is not configured.</strong></p>
          <p>{webrtcSetupMessage}</p>
          <p className="text-xs">
            Telnyx Portal → Voice → Connections → <strong>VSP-SIP-Trunk</strong> (Credential) →{' '}
            <strong>Outbound</strong> tab → select <strong>VSP-Outbound</strong> profile.
            Do <strong>not</strong> move phone numbers off <strong>VSP-Voice-App</strong> — that breaks inbound.
          </p>
        </div>
      ) : null}

      {uiState === 'ready' && !inboundReady ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 space-y-2">
          <p><strong>Inbound calls may not ring this browser yet.</strong></p>
          <p>{inboundRoutingMessage || 'Add yourself to the ring group (type: app) in Call routing, enable ring group, and keep this page open while registered.'}</p>
        </div>
      ) : null}

      {sipUsername && uiState !== 'not-configured' && uiState !== 'no-numbers' ? (
        <p className="text-xs text-slate-500">
          WebRTC registered as <code className="text-slate-700">{sipUsername}</code>
          {webrtcDialUri ? (
            <> — inbound dial target <code className="break-all text-slate-700">{webrtcDialUri}</code></>
          ) : null}
        </p>
      ) : null}

      {uiState !== 'not-configured' && uiState !== 'no-numbers' ? (
        <details open className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-slate-900">Session diagnostics</summary>
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">Current Call Exists</dt>
              <dd className={debugCallId ? 'text-emerald-700' : 'text-amber-700'}>
                {debugCallId ? `Yes — ${debugCallId}` : 'No'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Call ID</dt>
              <dd className="break-all font-mono text-slate-800">{debugCallId || '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Current State</dt>
              <dd className="font-mono text-slate-800">{debugCallState}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Last Event Received</dt>
              <dd className="break-all text-slate-800">{lastCallEvent}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Hang Up Object Match</dt>
              <dd className="break-all font-mono text-slate-800">{hangupObjectMatch}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Destination Number</dt>
              <dd className="font-mono text-slate-800">{debugCallDestination}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Telnyx Ready</dt>
              <dd className={telnyxReady ? 'text-emerald-700' : 'text-amber-700'}>
                {telnyxReady ? 'Yes — telnyx.ready received' : uiState === 'connecting' ? 'Connecting…' : 'No — not registered'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">SIP Username</dt>
              <dd className="break-all font-mono text-slate-800">{sipUsername || 'Not provisioned'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Registration Status</dt>
              <dd>
                {telnyxReady
                  ? 'Registered on Telnyx WebRTC'
                  : uiState === 'error'
                    ? 'Registration failed'
                    : uiState === 'connecting'
                      ? 'Registering…'
                      : 'Not connected'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">WebRTC State</dt>
              <dd className="capitalize">{uiState}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Token Status</dt>
              <dd className="break-all">{tokenStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Last INVITE Received</dt>
              <dd>{lastInviteReceived || 'None this session'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">Push Status (mobile / Telnyx Portal)</dt>
              <dd>
                {serverDiagnostics?.push
                  ? [
                      serverDiagnostics.push.telnyxPortal.configured
                        ? 'Telnyx Portal push configured'
                        : 'Telnyx Portal push NOT configured',
                      serverDiagnostics.push.userDevices.registered
                        ? `${serverDiagnostics.push.userDevices.count} mobile device(s) registered`
                        : 'No mobile push tokens in backend',
                    ].join(' · ')
                  : 'Loading server diagnostics…'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">Inbound Routing</dt>
              <dd>
                {serverDiagnostics?.inboundRouting?.ready
                  ? 'Ready — Call Control can dial this WebRTC user'
                  : serverDiagnostics?.inboundRouting?.message
                    || inboundRoutingMessage
                    || 'Checking…'}
              </dd>
            </div>
            {serverDiagnostics?.fix ? (
              <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                <dt className="font-medium">Recommended fix</dt>
                <dd className="mt-1">{serverDiagnostics.fix}</dd>
              </div>
            ) : null}
          </dl>
        </details>
      ) : null}

      {outboundReady && telnyxArchitecture ? (
        <details className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-slate-900">Telnyx connection model (inbound vs outbound)</summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed">
            <p>
              <strong>Inbound:</strong> {telnyxArchitecture.inbound.resource} &quot;{telnyxArchitecture.inbound.name}&quot; —{' '}
              {telnyxArchitecture.inbound.numberAssignment}
            </p>
            <p>
              <strong>Outbound WebRTC:</strong> {telnyxArchitecture.outboundWebRtc.resource} —{' '}
              {telnyxArchitecture.outboundWebRtc.note}
            </p>
            <p className="text-slate-500">
              Caller ID uses tenant numbers from the database; authentication uses a credential JWT, not a Call Control app token.
            </p>
          </div>
        </details>
      ) : null}

      {uiState === 'not-configured' ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-900 space-y-2">
          <p>Add a Telnyx <strong>Credential Connection</strong> ID in Admin → Platform settings, or set{' '}
            <code className="text-amber-200">TELNYX_CREDENTIAL_CONNECTION_ID</code> in <code className="text-amber-200">.env</code>.
          </p>
          <p className="text-xs text-amber-200/80">
            This is separate from the TeXML app used for inbound calls. Create it in Telnyx Portal → Voice → Connections → Credential.
          </p>
        </div>
      ) : null}

      {uiState === 'no-numbers' ? (
        <div className="panel-card p-5 text-center text-slate-400">
          <p className="mb-3">You need at least one phone number to call out.</p>
          <Link href="/numbers" className="text-indigo-600 hover:text-indigo-500">
            Buy numbers →
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          {uiState === 'error' ? (
            <button
              type="button"
              onClick={() => setBootAttempt((value) => value + 1)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Retry connection
            </button>
          ) : null}
        </div>
      ) : null}

      {uiState !== 'not-configured' && uiState !== 'no-numbers' ? (
        <div
          className="panel-card p-6 space-y-4"
          onPointerDown={() => {
            void ensureAudioPrimed();
          }}
        >
          <div className="rounded-lg bg-white px-4 py-2 text-sm text-slate-700">
            {uiState === 'active' ? (
              <div className="flex items-center justify-between gap-3">
                <span>
                  Call in progress
                  {callRecordingActive ? ' · recording' : ''}
                </span>
                <span className="font-mono tabular-nums text-lg text-indigo-400">
                  {formatCallDuration(callElapsedSeconds)}
                </span>
              </div>
            ) : (
              status
            )}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-400">Caller ID</span>
            <select
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              disabled={inCall}
              className="w-full rounded-lg input-field"
            >
              {numbers.map((n) => (
                <option key={n.id} value={n.number}>
                  {n.number}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-400">Destination (extension or E.164)</span>
            <input
              type="tel"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="101 or +15551234567"
              disabled={inCall}
              className="w-full rounded-lg input-field font-mono text-lg"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            {DIAL_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                disabled={inCall}
                onClick={() => appendDigit(key)}
                className="rounded-lg border border-slate-300 bg-white py-3 text-lg font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-40"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            {uiState === 'incoming' ? (
              <>
                <button
                  type="button"
                  onClick={onAnswer}
                  className="flex-1 btn-primary px-4 py-2.5 text-sm w-full justify-center"
                >
                  Answer
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="flex-1 rounded-lg bg-red-500 py-3 font-medium text-white hover:bg-red-400"
                >
                  Decline
                </button>
              </>
            ) : !inCall ? (
              <button
                type="button"
                onClick={onCall}
                disabled={!canDial}
                className="flex-1 btn-primary px-4 py-2.5 text-sm w-full justify-center disabled:opacity-40"
              >
                Call
              </button>
            ) : (
              <button
                type="button"
                onClick={onHangup}
                className="flex-1 rounded-lg bg-red-500 py-3 font-medium text-white hover:bg-red-400"
              >
                Hang up
              </button>
            )}
          </div>

          {audioBlocked && uiState === 'active' ? (
            <button
              type="button"
              onClick={onEnableAudio}
              className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Enable speaker audio
            </button>
          ) : null}

          {callRecordingEnabled ? (
            <p className="text-xs text-slate-500">
              Outbound calls are recorded automatically when Call routing → Call recording is enabled.
              Set your Telnyx Credential Connection webhook to{' '}
              <code className="break-all text-slate-400">{voiceWebhookUrl || '/webhook/voice'}</code>{' '}
              so recordings appear in the Recordings inbox.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Call recording is off. Enable it in Call routing → Call recording.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Allow microphone access when prompted. Use headphones to avoid echo.
          </p>
        </div>
      ) : null}
    </div>
    </>
  );
}
