'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { TelnyxRTC } from '@telnyx/webrtc';
import type { Call } from '@telnyx/webrtc';
import { getSoftphoneConfig, getSoftphoneToken, getCallRecordings, getVoicemails, isUnauthorizedError, type CallRecordingRecord, type VoicemailRecord } from '@/lib/api';
import { isSoftphoneV2Enabled } from '@/lib/softphone-config';
import { trackSoftphoneEvent } from '@/lib/softphone-telemetry';
import { TenantOnlyGate } from '@/components/tenant-only-gate';
import { SoftphoneV2ErrorBoundary } from '@/components/softphone-v2-error-boundary';
import { RecordingsList } from '@/components/recordings-list';
import { VoicemailList } from '@/components/voicemail-list';

const REMOTE_AUDIO_ID = 'softphone-v2-remote';
const CALL_HISTORY_KEY = 'softphone-v2-call-history';
const MAX_CALL_HISTORY = 100;

type CallHistoryRecord = {
  id: string;
  number: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  status: 'completed' | 'missed' | 'rejected';
  timestamp: string;
};

type ActiveCallSession = {
  callId: string;
  number: string;
  direction: 'inbound' | 'outbound';
  reachedActive: boolean;
  saved: boolean;
  userDeclined?: boolean;
  receivedAt?: string;
};

const DTMF_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
] as const;

function logTelnyx(event: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`[softphone-v2] ${event}`);
    return;
  }
  console.log(`[softphone-v2] ${event}`, payload);
}

function normalizeDestination(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

const TELNYX_STATE_BY_NUMBER = [
  'new',
  'requesting',
  'trying',
  'recovering',
  'ringing',
  'answering',
  'early',
  'active',
  'held',
  'hangup',
  'destroy',
  'purge',
] as const;

function normalizeCallState(state: string | number | undefined | null) {
  if (typeof state === 'number' && Number.isFinite(state)) {
    return TELNYX_STATE_BY_NUMBER[state] ?? String(state);
  }
  return String(state ?? '').trim().toLowerCase();
}

function formatCallTimer(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value || 'Unknown';
}

function resolveCallDisplayNumber(call: Call, fallback = '') {
  const options = (call as Call & {
    options?: { destinationNumber?: string; remoteCallerNumber?: string; callerNumber?: string };
  }).options;

  return (
    options?.destinationNumber
    || options?.remoteCallerNumber
    || options?.callerNumber
    || fallback
    || 'Unknown'
  );
}

function callStatusLabel(state: string) {
  switch (state) {
    case 'active':
      return 'Connected';
    case 'held':
      return 'On Hold';
    case 'ringing':
    case 'trying':
    case 'early':
    case 'answering':
      return 'Calling…';
    case 'requesting':
    case 'new':
      return 'Connecting…';
    default:
      return state ? state.charAt(0).toUpperCase() + state.slice(1) : 'Ready';
  }
}

function loadCallHistory(): CallHistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CALL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CallHistoryRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CALL_HISTORY) : [];
  } catch {
    return [];
  }
}

function persistCallHistory(records: CallHistoryRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    CALL_HISTORY_KEY,
    JSON.stringify(records.slice(0, MAX_CALL_HISTORY)),
  );
}

function formatHistoryTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) {
    return `Today ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${time}`;
  }
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

function historyDirectionLabel(direction: CallHistoryRecord['direction']) {
  return direction === 'outbound' ? 'Outgoing' : 'Incoming';
}

function isInboundCall(call: Call) {
  const extended = call as Call & {
    direction?: string;
    options?: { destinationNumber?: string; remoteCallerNumber?: string };
  };
  if (extended.direction?.toLowerCase() === 'inbound') return true;
  return Boolean(extended.options?.remoteCallerNumber && !extended.options?.destinationNumber);
}

function isTerminalCallState(state: string) {
  return state === 'hangup' || state === 'destroy' || state === 'purge' || state === 'error';
}

type CallWithControls = Call & {
  dtmf?: (digit: string) => void;
  muteAudio?: () => void;
  unmuteAudio?: () => void;
  hold?: () => void;
  unhold?: () => void;
  reject?: () => void | Promise<void>;
};

type IncomingRingtoneHandle = {
  stop: () => void;
};

function startIncomingRingtoneLoop(): IncomingRingtoneHandle | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioContextCtor = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    const ctx = new AudioContextCtor();
    let stopped = false;
    let intervalId = 0;

    const playBurst = () => {
      if (stopped) return;

      const t0 = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.value = 0.08;
      gain.connect(ctx.destination);

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(t0 + start);
        osc.stop(t0 + start + duration);
      };

      playTone(440, 0, 0.4);
      playTone(480, 0.5, 0.4);
    };

    void ctx.resume();
    playBurst();
    intervalId = window.setInterval(playBurst, 2000);

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        window.clearInterval(intervalId);
        void ctx.close();
      },
    };
  } catch {
    return null;
  }
}

function callerInitials(number: string) {
  const digits = number.replace(/\D/g, '').slice(-4);
  return digits.slice(0, 2) || '??';
}

function SoftphoneV2Content() {
  const clientRef = useRef<TelnyxRTC | null>(null);
  const callRef = useRef<Call | null>(null);

  const [destination, setDestination] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [status, setStatus] = useState('Initializing…');
  const [callSeconds, setCallSeconds] = useState(0);
  const [callState, setCallState] = useState('');
  const [displayNumber, setDisplayNumber] = useState('');
  const [lastDtmf, setLastDtmf] = useState('');
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [onHold, setOnHold] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryRecord[]>([]);
  const [callDirection, setCallDirection] = useState<'inbound' | 'outbound' | ''>('');
  const [incomingReceivedAt, setIncomingReceivedAt] = useState('');
  const [missedCallToast, setMissedCallToast] = useState<{ number: string } | null>(null);

  const timerIntervalRef = useRef<number | null>(null);
  const callSecondsRef = useRef(0);
  const callSessionRef = useRef<ActiveCallSession | null>(null);
  const saveCallToHistoryRef = useRef<() => void>(() => {});
  const incomingRingtoneRef = useRef<IncomingRingtoneHandle | null>(null);
  const missedToastTimerRef = useRef<number | null>(null);
  const stopIncomingRingtoneRef = useRef<() => void>(() => {});
  const telemetryRef = useRef<{
    started?: string;
    connected?: string;
    failed?: string;
    ended?: string;
  }>({});

  const resetCallTelemetry = () => {
    telemetryRef.current = {};
  };

  const trackCallStarted = (
    callId: string,
    number: string,
    direction: 'inbound' | 'outbound',
  ) => {
    if (telemetryRef.current.started === callId) return;
    telemetryRef.current.started = callId;
    trackSoftphoneEvent('Call Started', { callId, number, direction });
  };

  const trackCallConnected = (
    callId: string,
    number: string,
    direction: 'inbound' | 'outbound',
  ) => {
    if (telemetryRef.current.connected === callId) return;
    telemetryRef.current.connected = callId;
    trackSoftphoneEvent('Call Connected', { callId, number, direction });
  };

  const trackCallFailed = (
    callId: string,
    number: string,
    direction: 'inbound' | 'outbound',
    reason: string,
  ) => {
    if (telemetryRef.current.failed === callId) return;
    telemetryRef.current.failed = callId;
    trackSoftphoneEvent('Call Failed', { callId, number, direction, reason });
  };

  const trackCallEnded = (
    callId: string,
    number: string,
    direction: 'inbound' | 'outbound',
    durationSeconds: number,
  ) => {
    if (telemetryRef.current.ended === callId) return;
    telemetryRef.current.ended = callId;
    trackSoftphoneEvent('Call Ended', { callId, number, direction, durationSeconds });
  };

  const stopTimer = () => {
    if (timerIntervalRef.current != null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const resetTimer = () => {
    stopTimer();
    setCallSeconds(0);
  };

  const startTimer = () => {
    if (timerIntervalRef.current != null) return;
    setCallSeconds(0);
    timerIntervalRef.current = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
  };

  const syncTimerWithCallState = (state: string | number | undefined | null) => {
    const normalized = normalizeCallState(state);
    if (normalized === 'active') {
      startTimer();
      return;
    }
    if (normalized === 'hangup' || normalized === 'destroy' || normalized === 'error') {
      stopTimer();
    }
  };

  const resetInCallControls = () => {
    setLastDtmf('');
    setMuted(false);
    setSpeakerOn(true);
    setOnHold(false);
  };

  const stopIncomingRingtone = () => {
    incomingRingtoneRef.current?.stop();
    incomingRingtoneRef.current = null;
  };

  stopIncomingRingtoneRef.current = stopIncomingRingtone;

  const showMissedCallToast = (number: string) => {
    setMissedCallToast({ number });
    if (missedToastTimerRef.current != null) {
      window.clearTimeout(missedToastTimerRef.current);
    }
    missedToastTimerRef.current = window.setTimeout(() => {
      setMissedCallToast(null);
      missedToastTimerRef.current = null;
    }, 4500);
  };

  const saveCallToHistory = () => {
    const session = callSessionRef.current;
    if (!session || session.saved) return;

    session.saved = true;

    let status: CallHistoryRecord['status'];
    if (session.reachedActive) {
      status = 'completed';
    } else if (session.direction === 'inbound') {
      status = session.userDeclined ? 'rejected' : 'missed';
    } else {
      status = 'rejected';
    }

    const record: CallHistoryRecord = {
      id: crypto.randomUUID(),
      number: session.number,
      direction: session.direction,
      duration: session.reachedActive ? callSecondsRef.current : 0,
      status,
      timestamp: new Date().toISOString(),
    };

    logTelnyx('history.saved', record);

    if (status === 'completed') {
      trackCallEnded(session.callId, session.number, session.direction, record.duration);
    } else {
      trackCallFailed(session.callId, session.number, session.direction, status);
    }

    if (status === 'missed') {
      showMissedCallToast(record.number);
    }

    setCallHistory((prev) => {
      const next = [record, ...prev].slice(0, MAX_CALL_HISTORY);
      persistCallHistory(next);
      return next;
    });
  };

  saveCallToHistoryRef.current = saveCallToHistory;

  const beginCallSession = (
    callId: string,
    number: string,
    direction: 'inbound' | 'outbound',
  ) => {
    const normalized = normalizeDestination(number) || number;
    const receivedAt = direction === 'inbound' ? new Date().toISOString() : undefined;
    callSessionRef.current = {
      callId,
      number: normalized,
      direction,
      reachedActive: false,
      saved: false,
      userDeclined: false,
      receivedAt,
    };
    setCallDirection(direction);
    if (receivedAt) {
      setIncomingReceivedAt(receivedAt);
    }
    trackCallStarted(callId, normalized, direction);
  };

  const markCallSessionActive = (callId: string) => {
    if (callSessionRef.current?.callId === callId) {
      callSessionRef.current.reachedActive = true;
      trackCallConnected(
        callId,
        callSessionRef.current.number,
        callSessionRef.current.direction,
      );
    }
  };

  const finalizeCallSession = () => {
    saveCallToHistory();
    resetCallTelemetry();
    callSessionRef.current = null;
    setCallDirection('');
    setIncomingReceivedAt('');
  };

  useEffect(() => {
    setCallHistory(loadCallHistory());
  }, []);

  useEffect(() => {
    callSecondsRef.current = callSeconds;
  }, [callSeconds]);

  const showIncomingOverlay = callState === 'ringing' && callDirection === 'inbound';

  useEffect(() => {
    if (showIncomingOverlay) {
      stopIncomingRingtone();
      incomingRingtoneRef.current = startIncomingRingtoneLoop();
    } else {
      stopIncomingRingtone();
    }
    return () => stopIncomingRingtone();
  }, [showIncomingOverlay]);

  useEffect(() => () => {
    stopTimer();
    stopIncomingRingtone();
    if (missedToastTimerRef.current != null) {
      window.clearTimeout(missedToastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let client: TelnyxRTC | null = null;

    async function boot() {
      try {
        logTelnyx('boot.start');

        const config = await getSoftphoneConfig();
        const callerId = config.defaultCallerId || config.numbers[0]?.number || '';
        if (!callerId) {
          if (mounted) setStatus('No caller ID — assign a tenant number first');
          logTelnyx('boot.no-caller-id');
          return;
        }
        if (mounted) setCallerNumber(callerId);

        const tokenRes = await getSoftphoneToken();
        logTelnyx('boot.token', {
          sipUsername: tokenRes.sipUsername,
          expiresInSeconds: tokenRes.expiresInSeconds,
          loginTokenLength: tokenRes.loginToken?.trim().length ?? 0,
        });

        if (!tokenRes.loginToken?.trim()) {
          if (mounted) setStatus('Empty login token from /api/softphone/token');
          logTelnyx('boot.empty-token');
          return;
        }

        client = new TelnyxRTC({
          login_token: tokenRes.loginToken.trim(),
          debug: true,
        });

        const audioEl = document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
        if (audioEl) {
          (client as TelnyxRTC & { remoteElement?: HTMLMediaElement }).remoteElement = audioEl;
          logTelnyx('boot.remote-audio-bound', { id: audioEl.id });
        } else {
          logTelnyx('boot.remote-audio-missing');
        }

        client.on('telnyx.ready', () => {
          logTelnyx('telnyx.ready');
          if (mounted) setStatus('Ready — open DevTools console for all Telnyx events');
        });

        client.on('telnyx.notification', (notification: unknown) => {
          logTelnyx('telnyx.notification', notification);
          const payload = notification as { type?: string; call?: Call };
          if (payload.call) {
            callRef.current = payload.call;
            const normalized = normalizeCallState(payload.call.state);
            logTelnyx('telnyx.notification.call', {
              type: payload.type,
              id: payload.call.id,
              state: payload.call.state,
            });
            syncTimerWithCallState(payload.call.state);
            if (mounted) {
              setCallState(normalized);
              setDisplayNumber((prev) => {
                const resolved = resolveCallDisplayNumber(payload.call!, prev);
                return resolved !== 'Unknown' ? resolved : prev;
              });

              if (isInboundCall(payload.call) && payload.call.id) {
                if (
                  !callSessionRef.current
                  || callSessionRef.current.callId !== payload.call.id
                ) {
                  beginCallSession(
                    payload.call.id,
                    resolveCallDisplayNumber(payload.call, ''),
                    'inbound',
                  );
                }
              }

              if (normalized === 'active' && payload.call.id) {
                markCallSessionActive(payload.call.id);
                stopIncomingRingtoneRef.current();
              }

              if (isTerminalCallState(normalized)) {
                stopIncomingRingtoneRef.current();
                saveCallToHistoryRef.current();
                resetCallTelemetry();
                callSessionRef.current = null;
                setCallDirection('');
                setIncomingReceivedAt('');
                setLastDtmf('');
                setMuted(false);
                setSpeakerOn(true);
                setOnHold(false);
              }
            }
          }
        });

        client.on('telnyx.error', (event: unknown) => {
          logTelnyx('telnyx.error', event);
          stopTimer();
          const session = callSessionRef.current;
          if (session && !session.reachedActive) {
            trackCallFailed(
              session.callId,
              session.number,
              session.direction,
              'telnyx.error',
            );
          }
          if (mounted) {
            setStatus(`Telnyx error — see console`);
            setCallState('');
            setLastDtmf('');
            setMuted(false);
            setSpeakerOn(true);
            setOnHold(false);
          }
        });

        clientRef.current = client;
        if (mounted) setStatus('Connecting…');
        logTelnyx('boot.connect');
        client.connect();
      } catch (err) {
        logTelnyx('boot.error', err);
        if (mounted) {
          setStatus(err instanceof Error ? err.message : 'Boot failed');
        }
      }
    }

    void boot();

    return () => {
      mounted = false;
      logTelnyx('boot.cleanup');
      stopTimer();
      stopIncomingRingtoneRef.current();
      try {
        callRef.current?.hangup();
        client?.disconnect();
      } catch (err) {
        logTelnyx('boot.cleanup.error', err);
      }
      clientRef.current = null;
      callRef.current = null;
    };
  }, []);

  const onCallWithDestination = (number: string) => {
    const client = clientRef.current;
    const destinationNumber = normalizeDestination(number);
    logTelnyx('call.click', { destinationNumber, callerNumber });

    if (!client) {
      logTelnyx('call.blocked', 'no client');
      return;
    }
    if (!destinationNumber) {
      logTelnyx('call.blocked', 'empty destination');
      return;
    }
    if (!callerNumber) {
      logTelnyx('call.blocked', 'empty callerNumber');
      return;
    }

    resetTimer();
    resetInCallControls();
    setDisplayNumber(destinationNumber);

    try {
      const call = client.newCall({
        destinationNumber,
        callerNumber,
      });
      callRef.current = call;
      beginCallSession(call.id, destinationNumber, 'outbound');
      setCallState(normalizeCallState(call.state));
      logTelnyx('newCall.returned', {
        id: call.id,
        state: call.state,
        keys: Object.keys(call as object),
      });
    } catch (err) {
      logTelnyx('newCall.error', err);
      trackSoftphoneEvent('Call Failed', {
        callId: 'unknown',
        number: destinationNumber,
        direction: 'outbound',
        reason: err instanceof Error ? err.message : 'newCall.error',
      });
    }
  };

  const onCall = () => {
    onCallWithDestination(destination);
  };

  const onAnswer = () => {
    const call = callRef.current;
    logTelnyx('answer.click', call ? { id: call.id, state: call.state } : null);
    if (!call) return;
    stopIncomingRingtone();
    try {
      call.answer();
      setDisplayNumber((prev) => resolveCallDisplayNumber(call, prev));
      logTelnyx('answer.invoked');
    } catch (err) {
      logTelnyx('answer.error', err);
    }
  };

  const onDeclineIncoming = () => {
    const call = callRef.current as CallWithControls | null;
    logTelnyx('decline.click', call ? { id: call.id, state: call.state } : null);
    if (!call) return;

    stopIncomingRingtone();
    if (callSessionRef.current) {
      callSessionRef.current.userDeclined = true;
    }

    try {
      if (typeof call.reject === 'function') {
        void Promise.resolve(call.reject()).then(() => {
          logTelnyx('decline.rejected');
        });
      } else {
        void Promise.resolve(call.hangup()).then(() => {
          logTelnyx('decline.hangup');
        });
      }
    } catch (err) {
      logTelnyx('decline.error', err);
    }

    finalizeCallSession();
    callRef.current = null;
    setCallState('');
    resetInCallControls();
  };

  const onHangup = () => {
    const call = callRef.current;
    logTelnyx('hangup.click', call ? { id: call.id, state: call.state } : null);
    if (!call) return;
    stopIncomingRingtone();
    stopTimer();
    try {
      void Promise.resolve(call.hangup()).then(() => {
        logTelnyx('hangup.resolved');
      });
    } catch (err) {
      logTelnyx('hangup.error', err);
    }
    finalizeCallSession();
    callRef.current = null;
    setCallState('');
    resetInCallControls();
  };

  const onCallBack = (record: CallHistoryRecord) => {
    setDestination(record.number);
    logTelnyx('history.callback', { number: record.number });
    const live = Boolean(
      callRef.current && callState && !isTerminalCallState(callState),
    );
    if (!live) {
      onCallWithDestination(record.number);
    }
  };

  const onClearHistory = () => {
    persistCallHistory([]);
    setCallHistory([]);
    logTelnyx('history.cleared');
  };

  const onSelectHistoryNumber = (number: string) => {
    setDestination(number);
    logTelnyx('history.select', { number });
  };

  const onDtmf = (digit: string) => {
    const call = callRef.current as CallWithControls | null;
    if (!call || callState !== 'active') return;

    console.log('[softphone-v2] dtmf', digit);
    logTelnyx('dtmf', digit);
    setLastDtmf(digit);

    try {
      call.dtmf?.(digit);
    } catch (err) {
      logTelnyx('dtmf.error', err);
    }
  };

  const onToggleMute = () => {
    const call = callRef.current as CallWithControls | null;
    if (!call || callState !== 'active') return;
    try {
      if (muted) {
        call.unmuteAudio?.();
      } else {
        call.muteAudio?.();
      }
      setMuted((prev) => !prev);
      logTelnyx('mute.toggle', { muted: !muted });
    } catch (err) {
      logTelnyx('mute.error', err);
    }
  };

  const onToggleHold = () => {
    const call = callRef.current as CallWithControls | null;
    if (!call || (callState !== 'active' && callState !== 'held')) return;
    try {
      if (onHold) {
        call.unhold?.();
        setOnHold(false);
        setCallState('active');
      } else {
        call.hold?.();
        setOnHold(true);
        setCallState('held');
      }
      logTelnyx('hold.toggle', { onHold: !onHold });
    } catch (err) {
      logTelnyx('hold.error', err);
    }
  };

  const onToggleSpeaker = () => {
    const audioEl = document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
    if (!audioEl) return;
    const next = !speakerOn;
    audioEl.volume = next ? 1 : 0.35;
    setSpeakerOn(next);
    logTelnyx('speaker.toggle', { speakerOn: next });
  };

  const hasLiveCall = Boolean(callRef.current && callState && !['hangup', 'destroy', 'purge', 'error', ''].includes(callState));
  const isCallActive = callState === 'active';
  const showKeypad = hasLiveCall && isCallActive;
  const keypadDisabled = !showKeypad;

  return (
    <div className="min-h-[100dvh] bg-[#F5F5F7] text-[#1D1D1F] dark:bg-black dark:text-white">
      {showIncomingOverlay ? (
        <IncomingCallScreen
          callerNumber={displayNumber}
          receivedAt={incomingReceivedAt}
          onAccept={onAnswer}
          onDecline={onDeclineIncoming}
        />
      ) : null}

      {missedCallToast ? (
        <MissedCallToast
          number={missedCallToast.number}
          onDismiss={() => setMissedCallToast(null)}
        />
      ) : null}

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 py-6 sm:px-6">
        {!hasLiveCall ? (
          <div className="flex flex-1 flex-col gap-6 py-4">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Phone</h1>
                <p className="mt-1 text-sm text-[#1D1D1F]/70 dark:text-white/70">{status}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="softphone-v2-destination" className="text-sm font-medium text-[#1D1D1F]/80 dark:text-white/80">
                  Contact Number
                </label>
                <input
                  id="softphone-v2-destination"
                  type="tel"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-lg text-[#1D1D1F] shadow-sm backdrop-blur-md outline-none ring-0 placeholder:text-[#1D1D1F]/35 focus:border-black/20 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/35"
                />
              </div>

              {callerNumber ? (
                <p className="text-xs text-[#1D1D1F]/50 dark:text-white/50">
                  Caller ID: {formatPhoneDisplay(callerNumber)}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onCall}
                  className="flex-1 rounded-full bg-[#34C759] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Call
                </button>
                <button
                  type="button"
                  onClick={onAnswer}
                  className="rounded-full bg-white/80 px-5 py-3 text-sm font-semibold text-[#1D1D1F] shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 dark:bg-white/10 dark:text-white"
                >
                  Answer
                </button>
              </div>
            </div>

            <CallHistoryPanel
              records={callHistory}
              onSelect={onSelectHistoryNumber}
              onCallBack={onCallBack}
              onClear={onClearHistory}
            />

            <VoicemailRecordingsCenter />
          </div>
        ) : showIncomingOverlay ? null : (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-col items-center pt-8 text-center sm:pt-12">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#1D1D1F]/45 dark:text-white/45">
                Contact Number
              </p>
              <h2 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">
                {formatPhoneDisplay(displayNumber)}
              </h2>

              <p className="mt-6 text-sm font-medium text-[#1D1D1F]/55 dark:text-white/55">
                Call Status
              </p>
              <p className="mt-1 text-lg font-medium text-[#34C759]">
                {callStatusLabel(onHold ? 'held' : callState)}
              </p>

              <p className="mt-6 text-sm font-medium text-[#1D1D1F]/55 dark:text-white/55">
                Call Duration
              </p>
              <p className="mt-1 font-mono text-4xl tabular-nums tracking-tight sm:text-5xl">
                {formatCallTimer(callSeconds)}
              </p>
            </div>

            {showKeypad ? (
              <div className="mt-8 flex flex-1 flex-col justify-center">
                <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-x-5 gap-y-5 sm:max-w-[300px] sm:gap-x-6 sm:gap-y-6">
                  {DTMF_ROWS.flat().map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={keypadDisabled}
                      onClick={() => onDtmf(digit)}
                      className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-white/75 text-2xl font-light text-[#1D1D1F] shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:h-[4.5rem] sm:w-[4.5rem] dark:border-white/10 dark:bg-white/[0.08] dark:text-white dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
                      aria-label={`DTMF ${digit}`}
                    >
                      {digit}
                    </button>
                  ))}
                </div>

                <div className="mx-auto mt-6 w-full max-w-xs rounded-2xl border border-white/50 bg-white/60 px-4 py-3 text-center shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#1D1D1F]/50 dark:text-white/50">
                    Last DTMF Pressed
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {lastDtmf || '—'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-[#1D1D1F]/50 dark:text-white/50">
                  Keypad available when call is connected
                </p>
              </div>
            )}

            <div className="mt-auto space-y-8 pb-4 pt-8">
              <div className="mx-auto flex max-w-xs items-start justify-around">
                <InCallControlButton
                  label="Mute"
                  active={muted}
                  disabled={!isCallActive}
                  onClick={onToggleMute}
                  icon={
                    muted ? (
                      <MicOffIcon />
                    ) : (
                      <MicIcon />
                    )
                  }
                />
                <InCallControlButton
                  label="Speaker"
                  active={speakerOn}
                  disabled={!isCallActive}
                  onClick={onToggleSpeaker}
                  icon={<SpeakerIcon />}
                />
                <InCallControlButton
                  label="Hold"
                  active={onHold}
                  disabled={!isCallActive && callState !== 'held'}
                  onClick={onToggleHold}
                  icon={<HoldIcon />}
                />
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onHangup}
                  className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#FF3B30] text-white shadow-[0_12px_40px_rgba(255,59,48,0.45)] transition-all duration-200 hover:scale-105 active:scale-95"
                  aria-label="End Call"
                >
                  <PhoneDownIcon />
                </button>
              </div>
              <p className="text-center text-sm font-medium text-[#FF3B30]">End Call</p>
            </div>
          </div>
        )}

        <audio
          id={REMOTE_AUDIO_ID}
          autoPlay
          playsInline
          className="sr-only"
          aria-hidden
        />
      </div>
    </div>
  );
}

function IncomingCallScreen({
  callerNumber,
  receivedAt,
  onAccept,
  onDecline,
}: {
  callerNumber: string;
  receivedAt: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const formatted = formatPhoneDisplay(callerNumber);
  const receivedLabel = receivedAt
    ? formatHistoryTimestamp(receivedAt)
    : 'Just now';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F5F7]/95 text-[#1D1D1F] opacity-100 backdrop-blur-xl transition-all duration-500 dark:bg-black/95 dark:text-white">
      <div className="flex flex-1 flex-col items-center justify-between px-6 pb-10 pt-16 sm:pt-20">
        <div className="w-full text-center">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-[#1D1D1F]/45 dark:text-white/45">
            Incoming Call
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[#1D1D1F]/45 dark:text-white/45">
            Caller Number
          </p>
          <h1 className="mt-2 text-3xl font-light tracking-tight sm:text-4xl">
            {formatted}
          </h1>

          <div className="mx-auto mt-8 max-w-xs rounded-2xl border border-white/50 bg-white/60 px-4 py-3 text-sm shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
            <p className="text-[#1D1D1F]/55 dark:text-white/55">Direction: Incoming</p>
            <p className="mt-1 text-[#1D1D1F]/55 dark:text-white/55">Time received: {receivedLabel}</p>
          </div>
        </div>

        <div className="relative my-8 flex items-center justify-center">
          <span
            className="absolute h-40 w-40 animate-ping rounded-full border border-[#34C759]/30 dark:border-[#34C759]/40"
          />
          <span
            className="absolute h-48 w-48 animate-ping rounded-full border border-[#34C759]/20 dark:border-[#34C759]/25 [animation-delay:450ms]"
          />
          <div
            className="relative flex h-36 w-36 animate-pulse items-center justify-center rounded-full border border-white/60 bg-gradient-to-b from-white/90 to-white/60 text-4xl font-light text-[#1D1D1F] shadow-2xl backdrop-blur-md dark:border-white/10 dark:from-white/15 dark:to-white/5 dark:text-white"
          >
            {callerInitials(callerNumber)}
          </div>
        </div>

        <div className="w-full text-center">
          <p className="text-sm font-medium text-[#1D1D1F]/55 dark:text-white/55">Call Status</p>
          <p className="mt-1 animate-pulse text-lg font-medium text-[#34C759]">Ringing…</p>
        </div>

        <div className="flex w-full max-w-sm items-center justify-between gap-8 pt-8">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onDecline}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#FF3B30] text-white shadow-[0_12px_40px_rgba(255,59,48,0.45)] transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label="Decline"
            >
              <PhoneDownIcon />
            </button>
            <span className="text-sm font-medium text-[#FF3B30]">Decline</span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onAccept}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#34C759] text-white shadow-[0_12px_40px_rgba(52,199,89,0.45)] transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label="Accept"
            >
              <PhoneAcceptIcon />
            </button>
            <span className="text-sm font-medium text-[#34C759]">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissedCallToast({
  number,
  onDismiss,
}: {
  number: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed left-4 right-4 top-4 z-[60] mx-auto max-w-md">
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/50 bg-white/85 px-4 py-3 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-white/10">
        <div>
          <p className="text-sm font-semibold">Missed Call</p>
          <p className="mt-1 text-sm text-[#1D1D1F]/70 dark:text-white/70">
            {formatPhoneDisplay(number)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-2 py-1 text-xs font-medium text-[#1D1D1F]/50 hover:text-[#1D1D1F] dark:text-white/50 dark:hover:text-white"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function VoicemailRecordingsCenter() {
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);
  const [recordings, setRecordings] = useState<CallRecordingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'voicemails' | 'recordings' | 'unread'>('all');

  const loadMedia = async () => {
    setLoading(true);
    setError('');
    try {
      const [vmRes, recRes] = await Promise.all([
        getVoicemails(100),
        getCallRecordings(100),
      ]);
      setVoicemails(vmRes.voicemails);
      setRecordings(recRes.recordings);
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        setError(err instanceof Error ? err.message : 'Could not load voicemail or recordings');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMedia();
  }, []);

  const matchesSearch = (number: string, createdAt: string) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const dateText = new Date(createdAt).toLocaleString().toLowerCase();
    const datePart = createdAt.slice(0, 10);
    return (
      number.toLowerCase().includes(query)
      || dateText.includes(query)
      || datePart.includes(query)
    );
  };

  const filteredVoicemails = voicemails.filter(
    (vm) => matchesSearch(vm.from, vm.createdAt) && (filter !== 'unread' || !vm.isRead),
  );

  const filteredRecordings = recordings.filter(
    (rec) => matchesSearch(
      rec.direction?.toLowerCase() === 'outbound' ? rec.to : rec.from,
      rec.createdAt,
    ),
  );

  const showVoicemails = filter === 'all' || filter === 'voicemails' || filter === 'unread';
  const showRecordings = filter === 'all' || filter === 'recordings';

  const filterOptions: Array<{ id: typeof filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'voicemails', label: 'Voicemails' },
    { id: 'recordings', label: 'Recordings' },
    { id: 'unread', label: 'Unread' },
  ];

  return (
    <section className="rounded-3xl border border-white/50 bg-white/60 p-4 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Voicemail &amp; Recordings</h2>
        <p className="mt-1 text-sm text-[#1D1D1F]/55 dark:text-white/55">
          Review voicemails and business call recordings
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search number or date"
        className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm text-[#1D1D1F] shadow-sm backdrop-blur-md outline-none placeholder:text-[#1D1D1F]/35 focus:border-black/20 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/35"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95 ${
              filter === option.id
                ? 'bg-[#007AFF] text-white shadow-md'
                : 'border border-white/50 bg-white/70 text-[#1D1D1F]/70 dark:border-white/10 dark:bg-white/[0.08] dark:text-white/70'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-[#1D1D1F]/45 dark:text-white/45">
          Loading voicemail and recordings…
        </p>
      ) : (
        <div className="mt-4 max-h-[28rem] space-y-6 overflow-y-auto pr-1">
          {showVoicemails ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#1D1D1F]/45 dark:text-white/45">
                Voicemails
              </h3>
              <VoicemailList
                voicemails={filteredVoicemails}
                onChange={() => void loadMedia()}
                onError={setError}
              />
            </div>
          ) : null}

          {showRecordings ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#1D1D1F]/45 dark:text-white/45">
                Call Recordings
              </h3>
              <RecordingsList
                recordings={filteredRecordings}
                onError={setError}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function CallHistoryPanel({
  records,
  onSelect,
  onCallBack,
  onClear,
}: {
  records: CallHistoryRecord[];
  onSelect: (number: string) => void;
  onCallBack: (record: CallHistoryRecord) => void;
  onClear: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/50 bg-white/60 p-4 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Recent Calls</h2>
        {records.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-[#1D1D1F]/70 backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 dark:border-white/10 dark:bg-white/[0.08] dark:text-white/70"
          >
            Clear History
          </button>
        ) : null}
      </div>

      {records.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#1D1D1F]/45 dark:text-white/45">
          No recent calls yet
        </p>
      ) : (
        <ul className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
          {records.map((record) => (
            <li
              key={record.id}
              className="rounded-2xl border border-white/50 bg-white/75 p-4 shadow-md backdrop-blur-md transition-all duration-200 hover:scale-[1.01] dark:border-white/10 dark:bg-white/[0.06]"
            >
              <button
                type="button"
                onClick={() => onSelect(record.number)}
                className="w-full text-left"
              >
                <p className="text-base font-medium">
                  📞 {formatPhoneDisplay(record.number)}
                </p>
                <p className="mt-1 text-sm text-[#1D1D1F]/65 dark:text-white/65">
                  {historyDirectionLabel(record.direction)}
                </p>
                <p className="mt-1 text-sm text-[#1D1D1F]/55 dark:text-white/55">
                  Duration: {formatCallTimer(record.duration)}
                </p>
                <p className="mt-1 text-xs text-[#1D1D1F]/45 dark:text-white/45">
                  {formatHistoryTimestamp(record.timestamp)}
                  {record.status !== 'completed' ? ` · ${record.status}` : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onCallBack(record)}
                className="mt-3 w-full rounded-full bg-[#007AFF]/10 px-4 py-2 text-sm font-semibold text-[#007AFF] transition-all duration-200 hover:scale-[1.02] active:scale-95 dark:bg-[#0A84FF]/15 dark:text-[#0A84FF]"
              >
                Call Back
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InCallControlButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 ${
          active
            ? 'border-white/70 bg-white text-[#1D1D1F] dark:border-white/20 dark:bg-white dark:text-black'
            : 'border-white/50 bg-white/70 text-[#1D1D1F] dark:border-white/10 dark:bg-white/[0.08] dark:text-white'
        }`}
      >
        {icon}
      </span>
      <span className="text-xs font-medium text-[#1D1D1F]/70 dark:text-white/70">{label}</span>
    </button>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M16.5 12A4.5 4.5 0 0 0 12 7.5v2.03l4.47 4.47ZM19 11h-1.05A6.98 6.98 0 0 0 13 5.08V3h-2v2.08A6.98 6.98 0 0 0 6.05 11H5v2h1.05A6.98 6.98 0 0 0 11 18.92V21h2v-2.08A6.98 6.98 0 0 0 17.95 13H19v-2ZM12 17.5A4.5 4.5 0 0 1 7.5 13H9v.5a3 3 0 0 0 6 0v-.5h1.5a4.5 4.5 0 0 1-4.5 4.5Z" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Zm2.17 3.41A7 7 0 0 1 18 12a7 7 0 0 1-4.83 3.59l1.06 1.77A8.96 8.96 0 0 0 20 12a8.96 8.96 0 0 0-5.77-5.36l1.06 1.77ZM7.05 6.05 5.64 7.46A10.96 10.96 0 0 0 2 12a10.96 10.96 0 0 0 3.64 4.54l1.41-1.41A8.96 8.96 0 0 1 4 12c0-1.25.25-2.44.7-3.54l1.35-1.41Z" />
    </svg>
  );
}

function HoldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  );
}

function PhoneAcceptIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24c1.12.37 2.33.57 3.59.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.2 2.47.57 3.59a1 1 0 0 1-.25 1.01l-2.2 2.19Z" />
    </svg>
  );
}

function PhoneDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 rotate-[135deg]" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24c1.12.37 2.33.57 3.59.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.2 2.47.57 3.59a1 1 0 0 1-.25 1.01l-2.2 2.19Z" />
    </svg>
  );
}

export default function SoftphoneV2Page() {
  const router = useRouter();

  useEffect(() => {
    if (!isSoftphoneV2Enabled()) {
      router.replace('/softphone');
    }
  }, [router]);

  if (!isSoftphoneV2Enabled()) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Redirecting to legacy softphone…
      </p>
    );
  }

  return (
    <TenantOnlyGate featureName="Softphone">
      <SoftphoneV2ErrorBoundary>
        <SoftphoneV2Content />
      </SoftphoneV2ErrorBoundary>
    </TenantOnlyGate>
  );
}
