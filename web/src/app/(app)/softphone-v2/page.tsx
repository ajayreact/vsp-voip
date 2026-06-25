'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TelnyxRTC } from '@telnyx/webrtc';
import type { Call } from '@telnyx/webrtc';
import { getSoftphoneConfig, getSoftphoneToken, getExtensions, getMe, isUnauthorizedError } from '@/lib/api';
import { persistStoredCallerId, resolveStoredCallerId } from '@/lib/softphone-caller-id';
import { postServerCallLog, postCallAccepted } from '@/lib/softphone-call-log-client';
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
import {
  buildTelnyxClientOptions,
  bindRemoteAudioTarget,
} from '@/lib/telnyx-softphone-session';
import { logPeerConnectionDiagnostics } from '@/lib/telnyx-debug';
import {
  detachRemoteCallAudio,
  wireWebCallAudio,
} from '@/lib/webrtc-audio';
import { IphonePhoneApp } from '@/components/softphone-v2/iphone-phone-app';
import type {
  CallHistoryRecord,
  CallHistoryStatus,
  ContactEntry,
  PhoneTab,
  RecentsFilter,
} from '@/components/softphone-v2/types';
import { isInboundMissedStatus } from '@/components/softphone-v2/utils';
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
  acceptedByUser?: boolean;
  userCancelled?: boolean;
  terminationReason?: string;
  pstnCaller?: string;
  receivedAt?: string;
};

const DTMF_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
] as const;

async function acquireMicrophoneStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not available in this browser');
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

function getRemoteAudioElement() {
  return document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
}

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
  remoteIdentity?: {
    displayName?: string;
    uri?: {
      user?: string;
      raw?: string;
      toString?: () => string;
    };
  };
  options?: {
    destinationNumber?: string;
    remoteCallerNumber?: string;
    remotePartyNumber?: string;
    remoteCallerName?: string;
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

function extractPhoneDisplayValue(
  value?: string | null,
  ownNumbers: string[] = [],
  options: { skipOwnFilter?: boolean } = {},
) {
  if (!value) return '';
  let candidate = String(value).trim();
  if (!candidate) return '';
  if (/^anonymous$/i.test(candidate)) return '';

  const sipMatch = candidate.match(/(?:sip|tel):([^@;>\s]+)/i);
  if (sipMatch?.[1]) {
    candidate = sipMatch[1];
  }

  candidate = candidate.replace(/^sip:/i, '').replace(/^tel:/i, '');
  candidate = candidate.split('@')[0] || candidate;
  candidate = candidate.split(';')[0] || candidate;
  candidate = candidate.replace(/[<>"']/g, '').trim();

  const digits = candidate.replace(/\D/g, '');
  if (!digits) return '';
  if (/[a-z]/i.test(candidate.replace(/^sip:/i, ''))) return '';
  if (!options.skipOwnFilter && isOwnInboundNumber(digits, ownNumbers)) return '';

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (/^\d{2,6}$/.test(digits)) return digits;
  if (candidate.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return '';
}

function decodePstnCallerFromClientState(raw: string): string {
  try {
    const parsed = JSON.parse(atob(raw)) as {
      pstnCaller?: string;
      pstnCallerName?: string;
    };
    return (
      extractPhoneDisplayValue(parsed.pstnCaller, [], { skipOwnFilter: true })
      || extractPhoneDisplayValue(parsed.pstnCallerName, [], { skipOwnFilter: true })
    );
  } catch {
    return '';
  }
}

function decodePstnCallerFromNotification(
  notification?: TelnyxNotificationPayload,
): string {
  if (!notification) return '';

  const scan = (value: unknown, depth = 0): string => {
    if (!value || depth > 6) return '';
    if (typeof value === 'string') {
      if (value.length >= 16 && /^[A-Za-z0-9+/=]+$/.test(value)) {
        const fromState = decodePstnCallerFromClientState(value);
        if (fromState) return fromState;
      }
      return extractPhoneDisplayValue(value, [], { skipOwnFilter: true });
    }
    if (typeof value !== 'object') return '';

    const record = value as Record<string, unknown>;
    if (typeof record.client_state === 'string') {
      const fromState = decodePstnCallerFromClientState(record.client_state);
      if (fromState) return fromState;
    }
    if (record.pstnCaller) {
      const direct = extractPhoneDisplayValue(String(record.pstnCaller), [], { skipOwnFilter: true });
      if (direct) return direct;
    }

    for (const nested of Object.values(record)) {
      const found = scan(nested, depth + 1);
      if (found) return found;
    }
    return '';
  };

  return scan(notification.payload) || scan(notification);
}

function extractHangupCause(
  call?: Call,
  notification?: TelnyxNotificationPayload,
): string {
  const extended = call as Call & {
    cause?: string;
    hangupCause?: string;
    sipCode?: number;
    sipReason?: string;
  };
  const direct = [
    extended?.cause,
    extended?.hangupCause,
    extended?.sipReason,
    notification?.payload?.cause,
    notification?.payload?.hangup_cause,
  ]
    .map((value) => String(value || '').toLowerCase())
    .find(Boolean);
  if (direct) return direct;
  const sipCode = Number(extended?.sipCode || notification?.payload?.sip_code);
  if (sipCode === 486) return 'busy';
  if (sipCode === 487 || sipCode === 603) return 'cancelled';
  if (sipCode === 408 || sipCode === 480) return 'no-answer';
  return '';
}

function resolveTerminalHistoryStatus(session: ActiveCallSession): CallHistoryStatus {
  if (session.reachedActive) return 'completed';

  if (session.direction === 'inbound') {
    if (session.userDeclined || session.acceptedByUser) return 'rejected';
    return 'missed';
  }

  const reason = String(session.terminationReason || '').toLowerCase();
  if (session.userCancelled) return 'cancelled';
  if (reason.includes('busy')) return 'busy';
  if (reason.includes('cancel')) return 'cancelled';
  if (reason.includes('fail') || reason.includes('error')) return 'failed';
  if (reason.includes('no-answer') || reason.includes('no_answer') || reason.includes('timeout')) {
    return 'outbound_no_answer';
  }
  return 'outbound_no_answer';
}

function mapHistoryStatusToServerLog(
  status: CallHistoryStatus,
  direction: 'inbound' | 'outbound',
): {
  status: 'ended' | 'failed' | 'no-answer' | 'busy' | 'cancelled' | 'rejected';
  callType: string;
} {
  switch (status) {
    case 'completed':
      return { status: 'ended', callType: direction === 'outbound' ? 'outbound' : 'answered' };
    case 'missed':
      return { status: 'no-answer', callType: 'missed' };
    case 'outbound_no_answer':
      return { status: 'no-answer', callType: 'outbound_no_answer' };
    case 'busy':
      return { status: 'busy', callType: 'busy' };
    case 'failed':
      return { status: 'failed', callType: 'failed' };
    case 'cancelled':
      return { status: 'cancelled', callType: 'cancelled' };
    case 'rejected':
      return { status: 'rejected', callType: 'rejected' };
    default:
      return { status: 'failed', callType: 'failed' };
  }
}

function resolveRemoteIdentityNumber(call: CallDisplayFields, ownNumbers: string[]) {
  const displayName = call.remoteIdentity?.displayName || call.remotePartyName || call.options?.remoteCallerName;
  const displayNumber = extractPhoneDisplayValue(displayName, ownNumbers, { skipOwnFilter: true })
    || extractPhoneDisplayValue(displayName, ownNumbers);
  if (displayNumber) return displayNumber;

  const uri = call.remoteIdentity?.uri;
  return (
    extractPhoneDisplayValue(uri?.user, ownNumbers, { skipOwnFilter: true })
    || extractPhoneDisplayValue(uri?.raw, ownNumbers, { skipOwnFilter: true })
    || extractPhoneDisplayValue(uri?.toString?.(), ownNumbers, { skipOwnFilter: true })
    || extractPhoneDisplayValue(uri?.user, ownNumbers)
    || extractPhoneDisplayValue(uri?.raw, ownNumbers)
    || extractPhoneDisplayValue(uri?.toString?.(), ownNumbers)
  );
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
    'pstnCaller',
    'pstnCallerName',
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
  pstnCallerHint = '',
) {
  const extended = call as CallDisplayFields;
  const options = extended.options;

  if (isInboundCall(call)) {
    return (
      extractPhoneDisplayValue(pstnCallerHint, ownNumbers, { skipOwnFilter: true })
      || decodePstnCallerFromNotification(notification)
      || extractPhoneDisplayValue(
        extended.remoteIdentity?.displayName || extended.remotePartyName || options?.remoteCallerName,
        ownNumbers,
        { skipOwnFilter: true },
      )
      || resolveRemoteIdentityNumber(extended, ownNumbers)
      || extractPhoneDisplayValue(extended.remotePartyNumber, ownNumbers, { skipOwnFilter: true })
      || extractPhoneDisplayValue(options?.remotePartyNumber, ownNumbers, { skipOwnFilter: true })
      || findPhoneDisplayValueInPayload(notification?.payload, ownNumbers)
      || extractPhoneDisplayValue(options?.remoteCallerNumber, ownNumbers, { skipOwnFilter: true })
      || extractPhoneDisplayValue(extended.callerNumber, ownNumbers, { skipOwnFilter: true })
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
  return state === 'hangup' || state === 'destroy' || state === 'destroyed' || state === 'purge' || state === 'error';
}

function rememberFinalizedCallId(
  finalizedCallIds: Set<string>,
  callId: string,
  maxEntries = MAX_CALL_HISTORY,
) {
  finalizedCallIds.add(callId);
  while (finalizedCallIds.size > maxEntries) {
    const oldest = finalizedCallIds.values().next().value;
    if (!oldest) break;
    finalizedCallIds.delete(oldest);
  }
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
  const callDirectionRef = useRef<'inbound' | 'outbound' | ''>('');
  const displayNumberRef = useRef('');
  const tenantNumbersRef = useRef<string[]>([]);
  const saveCallToHistoryRef = useRef<() => void>(() => {});
  /** Telnyx SDK may emit hangup → destroy/purge for one call; block duplicate history saves. */
  const finalizedCallIdsRef = useRef<Set<string>>(new Set());
  const incomingRingtoneRef = useRef<IncomingRingtoneHandle | null>(null);
  const missedToastTimerRef = useRef<number | null>(null);
  const stopIncomingRingtoneRef = useRef<() => void>(() => {});
  const tearingDownRef = useRef(false);
  const reconnectControllerRef = useRef<TelnyxReconnectController | null>(null);
  const registrationSuccessEmittedRef = useRef(false);
  const unwireCallAudioRef = useRef<(() => void) | null>(null);
  const telemetryRef = useRef<{
    started?: string;
    connected?: string;
    failed?: string;
    ended?: string;
  }>({});

  const resetCallTelemetry = () => {
    telemetryRef.current = {};
  };

  const clearCallMedia = () => {
    unwireCallAudioRef.current?.();
    unwireCallAudioRef.current = null;
    detachRemoteCallAudio(getRemoteAudioElement());
  };

  const attachCallMedia = (call: Call, label: string) => {
    const audioEl = getRemoteAudioElement();

    const wireOnce = () => {
      if (unwireCallAudioRef.current) return true;
      const pc = (call as Call & { peer?: { peerConnection?: RTCPeerConnection } }).peer?.peerConnection;
      if (!pc) return false;
      unwireCallAudioRef.current = wireWebCallAudio(call, audioEl, () => {
        logTelnyx('media.playback-blocked', { label });
      });
      void logPeerConnectionDiagnostics(call, label).then(() => {
        logTelnyx('media.diagnostics', { label });
      });
      return true;
    };

    if (wireOnce()) return;

    let attempts = 0;
    const pollId = window.setInterval(() => {
      attempts += 1;
      if (wireOnce() || attempts >= 75) {
        window.clearInterval(pollId);
        if (attempts >= 75 && !unwireCallAudioRef.current) {
          logTelnyx('media.peer-timeout', { label });
        }
      }
    }, 200);
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
    if (finalizedCallIdsRef.current.has(session.callId)) return;

    session.saved = true;
    rememberFinalizedCallId(finalizedCallIdsRef.current, session.callId);

    const status = resolveTerminalHistoryStatus(session);

    const historyNumber = session.number && session.number !== 'Unknown'
      ? session.number
      : displayNumberRef.current || 'Unknown';

    const record: CallHistoryRecord = {
      id: crypto.randomUUID(),
      number: historyNumber,
      phoneNumber: historyNumber,
      remotePartyNumber: historyNumber,
      direction: session.direction,
      duration: session.reachedActive ? callSecondsRef.current : 0,
      status,
      timestamp: new Date().toISOString(),
    };

    logTelnyx('history.saved', record);

    const serverLog = mapHistoryStatusToServerLog(status, session.direction);

    if (status === 'completed') {
      trackCallEnded(session.callId, historyNumber, session.direction, record.duration);
      postServerCallLog({
        callSid: session.callId,
        from: session.logFrom,
        to: session.logTo,
        direction: session.direction,
        status: 'ended',
        durationSeconds: record.duration,
        callType: serverLog.callType,
      });
    } else {
      trackCallFailed(session.callId, historyNumber, session.direction, status);
      postServerCallLog({
        callSid: session.callId,
        from: session.logFrom,
        to: session.logTo,
        direction: session.direction,
        status: serverLog.status,
        callType: serverLog.callType,
        userDeclined: session.userDeclined,
        acceptedByUser: session.acceptedByUser,
        userCancelled: session.userCancelled,
      });
    }

    if (isInboundMissedStatus(status)) {
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
      acceptedByUser: false,
      receivedAt,
    };
    setCallDirection(direction);
    callDirectionRef.current = direction;
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
    callDirectionRef.current = '';
    setIncomingReceivedAt('');
  };

  useEffect(() => {
    callerNumberRef.current = callerNumber;
  }, [callerNumber]);

  useEffect(() => {
    displayNumberRef.current = displayNumber;
  }, [displayNumber]);

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

        client = new TelnyxRTC(buildTelnyxClientOptions(tokenRes.loginToken));

        const audioEl = getRemoteAudioElement();
        if (audioEl) {
          bindRemoteAudioTarget(client, audioEl);
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
              const pstnCallerHint = callSessionRef.current?.pstnCaller || '';
              setDisplayNumber((prev) => {
                const resolved = resolveCallDisplayNumber(
                  payload.call!,
                  prev,
                  payload,
                  ownedInboundNumbers,
                  pstnCallerHint,
                );
                if (isInboundCall(payload.call!)) {
                  const retained = prev
                    || callSessionRef.current?.number
                    || displayNumberRef.current
                    || '';
                  const next = resolved !== 'Unknown' ? resolved : retained;
                  displayNumberRef.current = next;
                  return next;
                }
                const next = resolved !== 'Unknown' ? resolved : prev;
                displayNumberRef.current = next;
                return next;
              });

              const existingSession = callSessionRef.current;
              const callId = payload.call.id ?? '';
              const terminal = isTerminalCallState(normalized);
              const callAlreadyFinalized = Boolean(
                callId && finalizedCallIdsRef.current.has(callId),
              );
              const notificationIsInbound = isInboundCall(payload.call)
                && existingSession?.direction !== 'outbound'
                && callDirectionRef.current !== 'outbound';

              // Telnyx callUpdate may emit hangup/destroy/purge sequentially — never
              // start a new session on a terminal notification (see SDK State enum).
              if (
                notificationIsInbound
                && callId
                && !terminal
                && !callAlreadyFinalized
              ) {
                const inboundNumber = resolveCallDisplayNumber(
                  payload.call,
                  '',
                  payload,
                  ownedInboundNumbers,
                  pstnCallerHint,
                );
                if (
                  !callSessionRef.current
                  || callSessionRef.current.callId !== callId
                ) {
                  beginCallSession(
                    callId,
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

              if (normalized === 'active' && callId) {
                markCallSessionActive(callId);
                attachCallMedia(
                  payload.call,
                  notificationIsInbound ? 'inbound:active' : 'outbound:active',
                );
                stopIncomingRingtoneRef.current();
              }

              if (terminal) {
                if (callSessionRef.current) {
                  callSessionRef.current.terminationReason = extractHangupCause(
                    payload.call,
                    payload,
                  );
                }
                clearCallMedia();
                stopIncomingRingtoneRef.current();

                const canSaveHistory = Boolean(
                  callSessionRef.current
                  && !callSessionRef.current.saved
                  && callId
                  && !callAlreadyFinalized,
                );
                if (canSaveHistory) {
                  saveCallToHistoryRef.current();
                } else if (callAlreadyFinalized) {
                  logTelnyx('history.duplicate-terminal-ignored', { callId, state: normalized });
                }

                resetCallTelemetry();
                callSessionRef.current = null;
                setCallDirection('');
                callDirectionRef.current = '';
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
      clearCallMedia();
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

  const onAnswer = async () => {
    const call = callRef.current;
    logTelnyx('answer.click', call ? { id: call.id, state: call.state } : null);
    if (!call) return;
    stopIncomingRingtone();
    const isInbound = callSessionRef.current?.direction === 'inbound';
    if (isInbound && callSessionRef.current) {
      callSessionRef.current.acceptedByUser = true;
    }
    try {
      const extended = call as Call & {
        options?: {
          remoteElement?: string | HTMLMediaElement;
          localStream?: MediaStream;
          audio?: boolean;
        };
      };
      const audioEl = getRemoteAudioElement();
      const localStream = await acquireMicrophoneStream();

      if (extended.options) {
        extended.options.localStream = localStream;
        extended.options.remoteElement = audioEl ?? REMOTE_AUDIO_ID;
        extended.options.audio = true;
      }

      // Bridge grace signal — fire-and-forget so call.answer() is not delayed (Telnyx media path).
      if (isInbound) {
        void postCallAccepted().then((acceptRes) => {
          logTelnyx('answer.callAccepted', acceptRes);
          if (!acceptRes.ok) {
            logTelnyx('answer.callAccepted.failed', {
              error: acceptRes.error,
              reason: acceptRes.reason,
              status: acceptRes.response?.status,
              url: acceptRes.request.url,
              networkError: acceptRes.networkError,
              responseBody: acceptRes.response?.body,
            });
          }
          const pstnCaller = acceptRes.ok ? acceptRes.pstnCaller : null;
          if (pstnCaller && callSessionRef.current) {
            callSessionRef.current.pstnCaller = pstnCaller;
            const normalized = normalizeDialNumber(pstnCaller) || pstnCaller;
            callSessionRef.current.number = normalized;
            const parties = resolveCallLogParties('inbound', normalized, callerNumberRef.current);
            callSessionRef.current.logFrom = parties.from;
            callSessionRef.current.logTo = parties.to;
            displayNumberRef.current = normalized;
            setDisplayNumber(normalized);
            logTelnyx('answer.pstnCaller', { pstnCaller: normalized });
          }
        }).catch((err) => {
          logTelnyx('answer.callAccepted.error', err);
        });
      }

      await call.answer();
      attachCallMedia(call, isInbound ? 'inbound:answer' : 'outbound:answer');
      void logPeerConnectionDiagnostics(call, 'answer:after');
      setCallState('answering');
      setDisplayNumber((prev) => resolveCallDisplayNumber(
        call,
        prev,
        undefined,
        getOwnedInboundNumbers(),
        callSessionRef.current?.pstnCaller || '',
      ));
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

    clearCallMedia();
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
    if (callSessionRef.current && !callSessionRef.current.reachedActive) {
      if (callSessionRef.current.direction === 'outbound') {
        callSessionRef.current.userCancelled = true;
      }
    }
    try {
      void Promise.resolve(call.hangup()).then(() => {
        logTelnyx('hangup.resolved');
      });
    } catch (err) {
      logTelnyx('hangup.error', err);
    }
    clearCallMedia();
    finalizeCallSession();
    callRef.current = null;
    setCallState('');
    resetInCallControls();
  };

  const onCallBack = (record: CallHistoryRecord) => {
    const callbackNumber = record.number || record.phoneNumber || record.remotePartyNumber || '';
    setDestination(callbackNumber);
    logTelnyx('history.callback', { number: callbackNumber });
    const live = Boolean(
      callRef.current && callState && !isTerminalCallState(callState),
    );
    if (!live) {
      onCallWithDestination(callbackNumber);
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
  const hasLiveCall = Boolean(callRef.current && callState && !['hangup', 'destroy', 'destroyed', 'purge', 'error', ''].includes(callState));
  const isCallActive = callState === 'active';
  const activeCallCount = hasLiveCall ? 1 : 0;
  const failedCallCount = callHistory.filter((record) => record.status !== 'completed').length;
  const missedCallCount = callHistory.filter((record) => isInboundMissedStatus(record.status)).length;
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
