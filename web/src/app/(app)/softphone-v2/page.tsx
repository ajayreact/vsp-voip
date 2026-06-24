'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TelnyxRTC } from '@telnyx/webrtc';
import type { Call } from '@telnyx/webrtc';
import { getSoftphoneConfig, getSoftphoneToken, getExtensions, getMe, isUnauthorizedError } from '@/lib/api';
import { persistStoredCallerId, resolveStoredCallerId } from '@/lib/softphone-caller-id';
import { postServerCallLog } from '@/lib/softphone-call-log-client';
import { isSoftphoneV2Enabled } from '@/lib/softphone-config';
import {
  isValidDialInput,
  normalizeDialNumber,
  resolveOutboundDestination,
} from '@/lib/softphone-dial';
import { startSoftphonePresenceHeartbeat, type SoftphonePresenceStatus } from '@/lib/softphone-presence';
import {
  createTelnyxReconnectController,
  formatTelnyxErrorMessage,
  type TelnyxReconnectController,
} from '@/lib/softphone-v2-reconnect';
import { stopOutboundRingback, syncOutboundRingback } from '@/lib/softphone-v2-ringback';
import { trackSoftphoneEvent, subscribeSoftphoneTelemetry, type SoftphoneTelemetrySnapshot } from '@/lib/softphone-telemetry';
import { IphonePhoneApp } from '@/components/softphone-v2/iphone-phone-app';
import type {
  CallHistoryRecord,
  ContactEntry,
  PhoneTab,
  RecentsFilter,
} from '@/components/softphone-v2/types';
import { TenantOnlyGate } from '@/components/tenant-only-gate';
import { SoftphoneV2ErrorBoundary } from '@/components/softphone-v2-error-boundary';

const REMOTE_AUDIO_ID = 'softphone-v2-remote';
const CALL_HISTORY_KEY = 'softphone-v2-call-history';
const MAX_CALL_HISTORY = 100;

type ActiveCallSession = {
  callId: string;
  number: string;
  direction: 'inbound' | 'outbound';
  logFrom: string;
  logTo: string;
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

function formatPhoneDisplay(value: string) {
  if (/^\d{2,6}$/.test(value.trim())) {
    return `Ext ${value.trim()}`;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value || 'Unknown';
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

function resolveCallLogParties(
  direction: 'inbound' | 'outbound',
  remoteOrDestination: string,
  callerId: string,
) {
  const normalizedCallerId = normalizeDialNumber(callerId);
  if (direction === 'outbound') {
    return {
      from: normalizedCallerId,
      to: remoteOrDestination,
    };
  }
  return {
    from: remoteOrDestination,
    to: normalizedCallerId,
  };
}

function formatCallTimer(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type TelnyxNotificationPayload = {
  type?: string;
  call?: Call;
  payload?: Record<string, unknown>;
};

type CallDisplayFields = Call & {
  callerNumber?: string;
  callerName?: string;
  remoteCallerNumber?: string;
  remotePartyNumber?: string;
  remotePartyName?: string;
  options?: {
    destinationNumber?: string;
    remoteCallerNumber?: string;
    remotePartyNumber?: string;
    callerNumber?: string;
  };
};

function phoneDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function isOwnInboundNumber(digits: string, ownNumbers: string[] = []) {
  if (!digits) return false;
  return ownNumbers.some((value) => {
    const ownDigits = phoneDigits(value);
    if (!ownDigits) return false;
    if (digits === ownDigits) return true;
    return digits.length >= 10
      && ownDigits.length >= 10
      && digits.slice(-10) === ownDigits.slice(-10);
  });
}

function extractPhoneDisplayValue(value?: string | null, ownNumbers: string[] = []) {
  if (!value) return '';
  let candidate = String(value).trim();
  if (!candidate) return '';

  candidate = candidate.replace(/^sip:/i, '').replace(/^tel:/i, '');
  candidate = candidate.split('@')[0] || candidate;
  candidate = candidate.split(';')[0] || candidate;
  candidate = candidate.replace(/[<>"']/g, '').trim();

  const digits = candidate.replace(/\D/g, '');
  if (!digits) return '';
  if (/[a-z]/i.test(candidate.replace(/^sip:/i, ''))) return '';
  if (isOwnInboundNumber(digits, ownNumbers)) return '';

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (/^\d{2,6}$/.test(digits)) return digits;
  if (candidate.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return '';
}

function findPhoneDisplayValueInPayload(
  value: unknown,
  ownNumbers: string[] = [],
  depth = 0,
): string {
  if (!value || depth > 5) return '';
  if (typeof value === 'string') return extractPhoneDisplayValue(value, ownNumbers);
  if (typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const preferredKeys = [
    'from',
    'remotePartyNumber',
    'callerNumber',
    'remoteCallerNumber',
    'caller_id_number',
    'callerIdNumber',
    'ani',
    'cli',
    'phone_number',
  ];

  for (const key of preferredKeys) {
    const direct = findPhoneDisplayValueInPayload(record[key], ownNumbers, depth + 1);
    if (direct) return direct;
  }

  for (const [key, nested] of Object.entries(record)) {
    if (key === 'call' || key === 'to' || preferredKeys.includes(key)) continue;
    const found = findPhoneDisplayValueInPayload(nested, ownNumbers, depth + 1);
    if (found) return found;
  }

  return '';
}

function resolveCallDisplayNumber(
  call: Call,
  fallback = '',
  notification?: TelnyxNotificationPayload,
  ownNumbers: string[] = [],
) {
  const extended = call as CallDisplayFields;
  const options = extended.options;

  if (isInboundCall(call)) {
    return (
      extractPhoneDisplayValue(extended.remotePartyNumber, ownNumbers)
      || extractPhoneDisplayValue(options?.remotePartyNumber, ownNumbers)
      || findPhoneDisplayValueInPayload(notification?.payload, ownNumbers)
      || extractPhoneDisplayValue(options?.remoteCallerNumber, ownNumbers)
      || extractPhoneDisplayValue(extended.callerNumber, ownNumbers)
      || findPhoneDisplayValueInPayload(notification, ownNumbers)
      || 'Unknown'
    );
  }

  return (
    options?.destinationNumber
    || options?.remoteCallerNumber
    || options?.callerNumber
    || extended.callerNumber
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
    callerNumber?: string;
    remotePartyNumber?: string;
    options?: { destinationNumber?: string; remoteCallerNumber?: string };
  };
  if (extended.direction?.toLowerCase() === 'inbound') return true;
  return Boolean(
    extended.remotePartyNumber
    || extended.options?.remoteCallerNumber
    || (extended.callerNumber && !extended.options?.destinationNumber),
  );
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

function resolveUserExtensionNumber(
  assignments: Array<{ extensionNumber?: string | null; extensionUserId?: string | null }>,
  userId: string,
) {
  const mine = assignments.find((entry) => entry.extensionUserId === userId);
  return mine?.extensionNumber ?? null;
}

function SoftphoneV2Content() {
  const clientRef = useRef<TelnyxRTC | null>(null);
  const callRef = useRef<Call | null>(null);

  const [destination, setDestination] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [tenantNumbers, setTenantNumbers] = useState<{ id: string; number: string }[]>([]);
  const [telnyxReady, setTelnyxReady] = useState(false);
  const [telnyxSocketConnected, setTelnyxSocketConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastReconnectTime, setLastReconnectTime] = useState<string | null>(null);
  const [presenceStatus, setPresenceStatus] = useState<SoftphonePresenceStatus>('offline');
  const [extensionNumber, setExtensionNumber] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<PhoneTab>('recents');
  const [recentsSearch, setRecentsSearch] = useState('');
  const [recentsFilter, setRecentsFilter] = useState<RecentsFilter>('all');
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsSearch, setContactsSearch] = useState('');
  const [selectedRecent, setSelectedRecent] = useState<CallHistoryRecord | null>(null);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  const [voicemailBadge, setVoicemailBadge] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastTelemetryEvent, setLastTelemetryEvent] = useState<SoftphoneTelemetrySnapshot | null>(null);

  const timerIntervalRef = useRef<number | null>(null);
  const callSecondsRef = useRef(0);
  const callSessionRef = useRef<ActiveCallSession | null>(null);
  const callerNumberRef = useRef('');
  const tenantNumbersRef = useRef<string[]>([]);
  const saveCallToHistoryRef = useRef<() => void>(() => {});
  const incomingRingtoneRef = useRef<IncomingRingtoneHandle | null>(null);
  const missedToastTimerRef = useRef<number | null>(null);
  const stopIncomingRingtoneRef = useRef<() => void>(() => {});
  const tearingDownRef = useRef(false);
  const reconnectControllerRef = useRef<TelnyxReconnectController | null>(null);
  const registrationSuccessEmittedRef = useRef(false);
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

  const getOwnedInboundNumbers = () => [
    callerNumberRef.current,
    ...tenantNumbersRef.current,
  ].filter(Boolean);

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
      postServerCallLog({
        callSid: session.callId,
        from: session.logFrom,
        to: session.logTo,
        direction: session.direction,
        status: 'ended',
        durationSeconds: record.duration,
      });
    } else {
      trackCallFailed(session.callId, session.number, session.direction, status);
      postServerCallLog({
        callSid: session.callId,
        from: session.logFrom,
        to: session.logTo,
        direction: session.direction,
        status: 'failed',
      });
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
    const sessionNumber = direction === 'outbound'
      ? number
      : (normalizeDialNumber(number) || number);
    const parties = resolveCallLogParties(direction, sessionNumber, callerNumberRef.current);
    const receivedAt = direction === 'inbound' ? new Date().toISOString() : undefined;
    callSessionRef.current = {
      callId,
      number: sessionNumber,
      direction,
      logFrom: parties.from,
      logTo: parties.to,
      reachedActive: false,
      saved: false,
      userDeclined: false,
      receivedAt,
    };
    setCallDirection(direction);
    if (receivedAt) {
      setIncomingReceivedAt(receivedAt);
    }
    trackCallStarted(callId, sessionNumber, direction);
    postServerCallLog({
      callSid: callId,
      from: parties.from,
      to: parties.to,
      direction,
      status: 'started',
    });
  };

  const markCallSessionActive = (callId: string) => {
    if (callSessionRef.current?.callId === callId) {
      callSessionRef.current.reachedActive = true;
      trackCallConnected(
        callId,
        callSessionRef.current.number,
        callSessionRef.current.direction,
      );
      postServerCallLog({
        callSid: callId,
        from: callSessionRef.current.logFrom,
        to: callSessionRef.current.logTo,
        direction: callSessionRef.current.direction,
        status: 'connected',
      });
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
    callerNumberRef.current = callerNumber;
  }, [callerNumber]);

  useEffect(() => {
    tenantNumbersRef.current = tenantNumbers.map((entry) => entry.number);
  }, [tenantNumbers]);

  useEffect(() => {
    if (!telnyxReady) return undefined;
    return startSoftphonePresenceHeartbeat(undefined, setPresenceStatus);
  }, [telnyxReady]);

  useEffect(() => {
    void syncOutboundRingback(callRef.current, callDirection, callState);
  }, [callState, callDirection]);

  useEffect(() => {
    setCallHistory(loadCallHistory());
  }, []);

  useEffect(() => {
    return subscribeSoftphoneTelemetry(setLastTelemetryEvent);
  }, []);

  useEffect(() => {
    let mounted = true;
    getExtensions()
      .then((res) => {
        if (!mounted) return;
        setContacts(
          res.extensions
            .filter((ext) => ext.status === 'ACTIVE')
            .map((ext) => ({
              id: ext.id,
              name: ext.displayName || ext.employeeName || `Ext ${ext.extensionNumber}`,
              extensionNumber: ext.extensionNumber,
              department: ext.department || '',
              number: ext.assignedDidNumber,
            })),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setContactsLoading(false);
      });
    return () => {
      mounted = false;
    };
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
    stopOutboundRingback(callRef.current);
    if (missedToastTimerRef.current != null) {
      window.clearTimeout(missedToastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let client: TelnyxRTC | null = null;
    tearingDownRef.current = false;

    async function boot() {
      try {
        logTelnyx('boot.start');

        const [config, me] = await Promise.all([getSoftphoneConfig(), getMe()]);
        const defaultCallerId = config.defaultCallerId || config.numbers[0]?.number || '';
        if (!defaultCallerId) {
          if (mounted) setStatus('No caller ID — assign a tenant number first');
          logTelnyx('boot.no-caller-id');
          return;
        }
        const initialCallerId = resolveStoredCallerId(config.numbers, defaultCallerId);
        const userExtension = resolveUserExtensionNumber(
          config.inboundRouting?.routingMethods?.extensionAssignment?.assignments ?? [],
          me.id,
        );
        tenantNumbersRef.current = config.numbers.map((entry) => entry.number);
        if (mounted) {
          setTenantNumbers(config.numbers);
          setCallerNumber(initialCallerId);
          callerNumberRef.current = initialCallerId;
          setExtensionNumber(userExtension);
        }

        const tokenRes = await getSoftphoneToken();
        logTelnyx('boot.token', {
          sipUsername: tokenRes.sipUsername,
          expiresInSeconds: tokenRes.expiresInSeconds,
          loginTokenLength: tokenRes.loginToken?.trim().length ?? 0,
        });

        if (!tokenRes.loginToken?.trim()) {
          if (mounted) {
            setStatus('Empty login token from /api/softphone/token');
            trackSoftphoneEvent('Registration Failed', { reason: 'empty_login_token', phase: 'boot' });
          }
          logTelnyx('boot.empty-token');
          return;
        }

        client = new TelnyxRTC({
          login_token: tokenRes.loginToken.trim(),
          debug: true,
          keepConnectionAliveOnSocketClose: true,
        });

        const audioEl = document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
        if (audioEl) {
          (client as TelnyxRTC & { remoteElement?: HTMLMediaElement }).remoteElement = audioEl;
          logTelnyx('boot.remote-audio-bound', { id: audioEl.id });
        } else {
          logTelnyx('boot.remote-audio-missing');
        }

        reconnectControllerRef.current = createTelnyxReconnectController({
          connect: () => {
            if (!client || tearingDownRef.current) return;
            logTelnyx('reconnect.connect');
            client.connect();
          },
          shouldAbort: () => tearingDownRef.current || !mounted,
          onAttempt: (attempt, delayMs) => {
            trackSoftphoneEvent('Reconnect Attempt', { attempt, delayMs });
            if (mounted) {
              setReconnectCount((prev) => prev + 1);
              setReconnecting(true);
              setReconnectAttempt(attempt);
              setTelnyxReady(false);
              setStatus('Reconnecting…');
            }
          },
        });

        client.on('telnyx.socket.open', () => {
          logTelnyx('telnyx.socket.open');
          if (mounted) setTelnyxSocketConnected(true);
        });

        client.on('telnyx.socket.close', (event: unknown) => {
          logTelnyx('telnyx.socket.close', event);
          if (mounted) {
            setTelnyxSocketConnected(false);
            setTelnyxReady(false);
          }
          if (tearingDownRef.current || !mounted) return;
          reconnectControllerRef.current?.schedule();
        });

        client.on('telnyx.ready', () => {
          logTelnyx('telnyx.ready');
          const attempts = reconnectControllerRef.current?.getAttempt() ?? 0;
          reconnectControllerRef.current?.reset();
          if (mounted) {
            setTelnyxReady(true);
            setTelnyxSocketConnected(true);
            setReconnecting(false);
            setReconnectAttempt(0);
            if (attempts > 0) {
              const reconnectedAt = new Date().toISOString();
              setLastReconnectTime(reconnectedAt);
              trackSoftphoneEvent('Registration Restored', { attempts, reconnectedAt });
            } else if (!registrationSuccessEmittedRef.current) {
              registrationSuccessEmittedRef.current = true;
              trackSoftphoneEvent('Registration Success');
            }
            setStatus('Ready — open DevTools console for all Telnyx events');
          }
        });

        client.on('telnyx.notification', (notification: unknown) => {
          logTelnyx('telnyx.notification', notification);
          const payload = notification as TelnyxNotificationPayload;
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
              const ownedInboundNumbers = getOwnedInboundNumbers();
              setCallState(normalized);
              setDisplayNumber((prev) => {
                const resolved = resolveCallDisplayNumber(payload.call!, prev, payload, ownedInboundNumbers);
                if (isInboundCall(payload.call!)) {
                  return resolved !== 'Unknown' ? resolved : '';
                }
                return resolved !== 'Unknown' ? resolved : prev;
              });

              if (isInboundCall(payload.call) && payload.call.id) {
                const inboundNumber = resolveCallDisplayNumber(payload.call, '', payload, ownedInboundNumbers);
                if (
                  !callSessionRef.current
                  || callSessionRef.current.callId !== payload.call.id
                ) {
                  beginCallSession(
                    payload.call.id,
                    inboundNumber,
                    'inbound',
                  );
                } else if (inboundNumber !== 'Unknown') {
                  const session = callSessionRef.current;
                  const normalizedNumber = normalizeDialNumber(inboundNumber) || inboundNumber;
                  if (session.direction === 'inbound' && session.number !== normalizedNumber) {
                    const parties = resolveCallLogParties('inbound', normalizedNumber, callerNumberRef.current);
                    session.number = normalizedNumber;
                    session.logFrom = parties.from;
                    session.logTo = parties.to;
                  }
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
          trackSoftphoneEvent('Registration Failed', {
            reason: formatTelnyxErrorMessage(event),
            phase: 'runtime',
          });
          if (mounted) {
            setTelnyxReady(false);
            setTelnyxSocketConnected(false);
          }
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
          if (!tearingDownRef.current && mounted) {
            reconnectControllerRef.current?.schedule();
          }
        });

        clientRef.current = client;
        if (mounted) setStatus('Connecting…');
        logTelnyx('boot.connect');
        client.connect();
      } catch (err) {
        logTelnyx('boot.error', err);
        trackSoftphoneEvent('Registration Failed', {
          reason: err instanceof Error ? err.message : 'boot.error',
          phase: 'boot',
        });
        if (mounted) {
          setStatus(err instanceof Error ? err.message : 'Boot failed');
        }
      }
    }

    void boot();

    return () => {
      mounted = false;
      tearingDownRef.current = true;
      reconnectControllerRef.current?.cancel();
      reconnectControllerRef.current = null;
      setTelnyxReady(false);
      setTelnyxSocketConnected(false);
      setReconnecting(false);
      setPresenceStatus('offline');
      logTelnyx('boot.cleanup');
      stopTimer();
      stopIncomingRingtoneRef.current();
      stopOutboundRingback(callRef.current);
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
    const { destinationNumber, isExtension } = resolveOutboundDestination(number);
    logTelnyx('call.click', { destinationNumber, callerNumber, isExtension });

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

    const outboundCallerId = normalizeDialNumber(callerNumber);
    resetTimer();
    resetInCallControls();
    setDisplayNumber(destinationNumber);

    try {
      const call = client.newCall({
        destinationNumber,
        callerNumber: outboundCallerId,
      });
      callRef.current = call;
      beginCallSession(call.id, destinationNumber, 'outbound');
      setCallDirection('outbound');
      setCallState(normalizeCallState(call.state));
      logTelnyx('newCall.returned', {
        id: call.id,
        state: call.state,
        isExtension,
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
      setDisplayNumber((prev) => resolveCallDisplayNumber(call, prev, undefined, getOwnedInboundNumbers()));
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
    setActiveTab('keypad');
    logTelnyx('history.select', { number });
  };

  const onAppendDigit = (digit: string) => {
    setDestination((prev) => prev + digit);
  };

  const onBackspace = () => {
    setDestination((prev) => prev.slice(0, -1));
  };

  const onToggleInCallKeypad = () => {
    setShowInCallKeypad((prev) => !prev);
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

  const onCallerIdChange = (value: string) => {
    setCallerNumber(value);
    callerNumberRef.current = value;
    persistStoredCallerId(value);
    logTelnyx('caller-id.changed', { callerNumber: value });
  };

  const canPlaceCall = isValidDialInput(destination) && Boolean(callerNumber);
  const hasLiveCall = Boolean(callRef.current && callState && !['hangup', 'destroy', 'purge', 'error', ''].includes(callState));
  const isCallActive = callState === 'active';
  const activeCallCount = hasLiveCall ? 1 : 0;
  const failedCallCount = callHistory.filter((record) => record.status !== 'completed').length;
  const missedCallCount = callHistory.filter((record) => record.status === 'missed').length;
  const displayStatus = reconnecting
    ? reconnectAttempt > 0
      ? `Reconnecting… (attempt ${reconnectAttempt})`
      : 'Reconnecting…'
    : status;

  return (
    <IphonePhoneApp
      remoteAudioId={REMOTE_AUDIO_ID}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      voicemailBadge={voicemailBadge}
      onVoicemailUnreadChange={setVoicemailBadge}
      displayStatus={displayStatus}
      showIncomingOverlay={showIncomingOverlay}
      hasLiveCall={hasLiveCall}
      isCallActive={isCallActive}
      callState={callState}
      callDirection={callDirection}
      displayNumber={displayNumber}
      incomingReceivedAt={incomingReceivedAt}
      callSeconds={callSeconds}
      muted={muted}
      speakerOn={speakerOn}
      onHold={onHold}
      showInCallKeypad={showInCallKeypad}
      lastDtmf={lastDtmf}
      destination={destination}
      callerNumber={callerNumber}
      tenantNumbers={tenantNumbers}
      canPlaceCall={canPlaceCall}
      callHistory={callHistory}
      recentsSearch={recentsSearch}
      recentsFilter={recentsFilter}
      contacts={contacts}
      contactsLoading={contactsLoading}
      contactsSearch={contactsSearch}
      selectedRecent={selectedRecent}
      missedCallToast={missedCallToast}
      telnyxSocketConnected={telnyxSocketConnected}
      telnyxRegistered={telnyxReady}
      reconnecting={reconnecting}
      presenceStatus={presenceStatus}
      extensionNumber={extensionNumber}
      lastReconnectTime={lastReconnectTime}
      activeCallCount={activeCallCount}
      failedCallCount={failedCallCount}
      missedCallCount={missedCallCount}
      reconnectCount={reconnectCount}
      lastTelemetryEvent={lastTelemetryEvent}
      onRecentsSearchChange={setRecentsSearch}
      onRecentsFilterChange={setRecentsFilter}
      onRecentsSelect={(record) => onSelectHistoryNumber(record.number)}
      onRecentsInfo={setSelectedRecent}
      onRecentsCallBack={onCallBack}
      onCloseRecentDetail={() => setSelectedRecent(null)}
      onContactsSearchChange={setContactsSearch}
      onContactSelect={(contact) => {
        setDestination(contact.extensionNumber);
        setActiveTab('keypad');
      }}
      onDestinationChange={setDestination}
      onAppendDigit={onAppendDigit}
      onBackspace={onBackspace}
      onCallerIdChange={onCallerIdChange}
      onCall={onCall}
      onAnswer={onAnswer}
      onDeclineIncoming={onDeclineIncoming}
      onHangup={onHangup}
      onToggleMute={onToggleMute}
      onToggleSpeaker={onToggleSpeaker}
      onToggleHold={onToggleHold}
      onToggleInCallKeypad={onToggleInCallKeypad}
      onDtmf={onDtmf}
      onDismissMissedToast={() => setMissedCallToast(null)}
    />
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
