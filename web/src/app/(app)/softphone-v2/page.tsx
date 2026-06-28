'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TelnyxRTC } from '@telnyx/webrtc';
import type { Call } from '@telnyx/webrtc';
import { getSoftphoneConfig, getSoftphoneToken, getExtensions, getMe, isUnauthorizedError } from '@/lib/api';
import { persistStoredCallerId, resolveStoredCallerId } from '@/lib/softphone-caller-id';
import { postServerCallLog, postCallAccepted, postBlindTransfer } from '@/lib/softphone-call-log-client';
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
import { stopOutboundRingback } from '@/lib/softphone-v2-ringback';
import { trackSoftphoneEvent, subscribeSoftphoneTelemetry, type SoftphoneTelemetrySnapshot } from '@/lib/softphone-telemetry';
import {
  buildTelnyxClientOptions,
  bindRemoteAudioTarget,
  bindTelnyxTokenLifecycle,
  waitForRemoteAudioElement,
} from '@/lib/telnyx-softphone-session';
import { logPeerConnectionDiagnostics } from '@/lib/telnyx-debug';
import {
  logInboundCallerResolution,
  resolveInboundCallerDisplay,
  resolveInboundCallerNameHint,
  type InboundCallerNotification,
} from '@/lib/inbound-caller-display';
import { isInboundCall, extractCallFromNotification, isLikelyInboundRingingInvite } from '@/lib/softphone-call-utils';
import { isTerminalSdkState, normalizeSdkCallState } from '@/lib/telephony/telnyx-mapper';
import { LIVE_CALL_PHASES } from '@/lib/telephony/types';
import { selectIsConnected } from '@/lib/telephony/selectors';
import {
  attachRemoteCallAudio,
  canWireRemoteCallAudio,
  detachRemoteCallAudio,
  resolvePeerConnection,
  setLocalAudioMuted,
  wireWebCallAudio,
} from '@/lib/webrtc-audio';
import {
  clearWebRtcDiagnosticsSnapshot,
  registerWebRtcDiagnosticsSnapshot,
} from '@/lib/webrtc-diagnostics-registry';
import { startWebRtcSendPathProbe } from '@/lib/webrtc-send-path-probe';
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
import { useSoftphoneTelephony } from '@/hooks/use-softphone-telephony';
import { getActiveLocalToneSourceForDiagnostics } from '@/lib/call-sounds';
import { logDiagnosticTimeline } from '@/lib/telephony';

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

const SOFTPHONE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

async function acquireMicrophoneStream(
  holder: { current: MediaStream | null },
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not available in this browser');
  }
  holder.current?.getTracks().forEach((track) => track.stop());
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: SOFTPHONE_AUDIO_CONSTRAINTS,
  });
  holder.current = stream;
  return stream;
}

function releaseMicrophoneStream(holder: { current: MediaStream | null }) {
  holder.current?.getTracks().forEach((track) => track.stop());
  holder.current = null;
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

function normalizeCallPrevState(call: Call): string {
  const extended = call as Call & { prevState?: string | number };
  if (typeof extended.prevState === 'number' && Number.isFinite(extended.prevState)) {
    return TELNYX_STATE_BY_NUMBER[extended.prevState] ?? String(extended.prevState);
  }
  return String(extended.prevState ?? '').trim().toLowerCase();
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
  localPartyNumber?: string;
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

function resolveCallDisplayNumber(
  call: Call,
  fallback = '',
  notification?: TelnyxNotificationPayload,
  ownNumbers: string[] = [],
  pstnCallerHint = '',
) {
  const extended = call as CallDisplayFields;

  if (isInboundCall(call)) {
    const resolution = resolveInboundCallerDisplay(extended, {
      ownNumbers,
      pstnCallerHint,
      notification: notification as InboundCallerNotification | undefined,
    });
    logInboundCallerResolution(resolution);
    return resolution.chosenDisplayNumber;
  }

  const options = extended.options;
  return (
    options?.destinationNumber
    || options?.remoteCallerNumber
    || options?.callerNumber
    || extended.callerNumber
    || fallback
    || 'Unknown'
  );
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

  const {
    orchestrator,
    snapshot: telephonySnapshot,
    primeAudio,
    uiCallState,
    durationSeconds: telephonyDurationSeconds,
    isConnected: telephonyConnected,
    isOnHold: telephonyOnHold,
    isMuted: telephonyMuted,
    hasLiveCall,
    inCallMediaReady,
    callDirection: telephonyCallDirection,
    displayNumber: telephonyDisplayNumber,
    callerNameHint: telephonyCallerNameHint,
    incomingReceivedAt: telephonyIncomingReceivedAt,
    showIncomingOverlay,
    telnyxReady,
    telnyxSocketConnected,
    reconnecting,
    connectionStatus,
    reconnectAttempt,
  } = useSoftphoneTelephony(getRemoteAudioElement);

  const [destination, setDestination] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [tenantNumbers, setTenantNumbers] = useState<{ id: string; number: string }[]>([]);
  const [bootStatus, setBootStatus] = useState('');
  const [lastReconnectTime, setLastReconnectTime] = useState<string | null>(null);
  const [presenceStatus, setPresenceStatus] = useState<SoftphonePresenceStatus>('offline');
  const [extensionNumber, setExtensionNumber] = useState<string | null>(null);
  const [lastDtmf, setLastDtmf] = useState('');
  const [speakerOn, setSpeakerOn] = useState(true);
  const [callHistory, setCallHistory] = useState<CallHistoryRecord[]>([]);
  const [missedCallToast, setMissedCallToast] = useState<{ number: string } | null>(null);
  const [activeTab, setActiveTab] = useState<PhoneTab>('recents');
  const [recentsSearch, setRecentsSearch] = useState('');
  const [recentsFilter, setRecentsFilter] = useState<RecentsFilter>('all');
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsSearch, setContactsSearch] = useState('');
  const [selectedRecent, setSelectedRecent] = useState<CallHistoryRecord | null>(null);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [voicemailBadge, setVoicemailBadge] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastTelemetryEvent, setLastTelemetryEvent] = useState<SoftphoneTelemetrySnapshot | null>(null);

  const callSessionRef = useRef<ActiveCallSession | null>(null);
  const callerNumberRef = useRef('');
  const displayNumberRef = useRef('');
  const tenantNumbersRef = useRef<string[]>([]);
  const saveCallToHistoryRef = useRef<() => void>(() => {});
  const connectedTelemetryRef = useRef<string | null>(null);
  /** Telnyx SDK may emit hangup → destroy/purge for one call; block duplicate history saves. */
  const finalizedCallIdsRef = useRef<Set<string>>(new Set());
  const incomingRingtoneRef = useRef<IncomingRingtoneHandle | null>(null);
  const missedToastTimerRef = useRef<number | null>(null);
  const stopIncomingRingtoneRef = useRef<() => void>(() => {});
  const tearingDownRef = useRef(false);
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const reconnectControllerRef = useRef<TelnyxReconnectController | null>(null);
  const registrationSuccessEmittedRef = useRef(false);
  const unwireCallAudioRef = useRef<(() => void) | null>(null);
  const sendPathProbeStopRef = useRef<(() => void) | null>(null);
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
    logDiagnosticTimeline('media.detachCallMedia', orchestrator.getSnapshot(), { source: 'clearCallMedia' });
    sendPathProbeStopRef.current?.();
    sendPathProbeStopRef.current = null;
    clearWebRtcDiagnosticsSnapshot();
    unwireCallAudioRef.current?.();
    unwireCallAudioRef.current = null;
    detachRemoteCallAudio(getRemoteAudioElement());
  };

  const attachCallMedia = (call: Call, label: string, options?: { forceRewire?: boolean }) => {
    const audioEl = getRemoteAudioElement();
    const snap = orchestrator.getSnapshot();
    logDiagnosticTimeline('media.attachCallMedia', snap, {
      label,
      forceRewire: options?.forceRewire ?? false,
      sdkState: normalizeCallState(call.state),
      sdkPrevState: normalizeCallPrevState(call),
      callPhase: snap.callPhase,
      ringbackSource: getActiveLocalToneSourceForDiagnostics(),
      hasRemoteAudioEl: Boolean(audioEl),
    });

    if (options?.forceRewire) {
      unwireCallAudioRef.current?.();
      unwireCallAudioRef.current = null;
    }

    const wireOnce = () => {
      if (unwireCallAudioRef.current) return true;
      if (!canWireRemoteCallAudio(call)) return false;
      void attachRemoteCallAudio(call, audioEl);
      const pc = resolvePeerConnection(call);
      unwireCallAudioRef.current = wireWebCallAudio(call, audioEl, () => {
        logTelnyx('media.playback-blocked', { label });
      });
      if (pc) {
        registerWebRtcDiagnosticsSnapshot(call, pc);
        sendPathProbeStopRef.current?.();
        sendPathProbeStopRef.current = startWebRtcSendPathProbe(call, label);
        void logPeerConnectionDiagnostics(call, label).then(() => {
          logTelnyx('media.diagnostics', { label });
        });
      }
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

  const resetInCallControls = () => {
    setLastDtmf('');
    orchestrator.setMuted(false);
    setSpeakerOn(true);
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
      : displayNumberRef.current || orchestrator.getSnapshot().session?.remoteLabel || 'Unknown';

    const duration = session.reachedActive
      ? (orchestrator.getSnapshot().session?.durationSeconds ?? telephonyDurationSeconds)
      : 0;

    const record: CallHistoryRecord = {
      id: crypto.randomUUID(),
      number: historyNumber,
      phoneNumber: historyNumber,
      remotePartyNumber: historyNumber,
      direction: session.direction,
      duration,
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
    trackCallStarted(callId, sessionNumber, direction);
    postServerCallLog({
      callSid: callId,
      from: parties.from,
      to: parties.to,
      direction,
      status: 'started',
    });
  };

  const resetCallSideEffects = () => {
    connectedTelemetryRef.current = null;
  };

  const finalizeCallSession = () => {
    saveCallToHistory();
    resetCallTelemetry();
    resetCallSideEffects();
    callSessionRef.current = null;
    orchestrator.reset();
  };

  useEffect(() => {
    callerNumberRef.current = callerNumber;
  }, [callerNumber]);

  useEffect(() => {
    displayNumberRef.current = telephonyDisplayNumber;
  }, [telephonyDisplayNumber]);

  useEffect(() => {
    tenantNumbersRef.current = tenantNumbers.map((entry) => entry.number);
  }, [tenantNumbers]);

  useEffect(() => {
    if (!telnyxReady) return undefined;
    return startSoftphonePresenceHeartbeat(undefined, setPresenceStatus);
  }, [telnyxReady]);

  useEffect(() => {
    return subscribeSoftphoneTelemetry(setLastTelemetryEvent);
  }, []);

  useEffect(() => {
    const session = telephonySnapshot.session;
    const callId = session?.callId;
    if (telephonySnapshot.callPhase !== 'connected' || !callId || callId === 'pending') return;
    if (connectedTelemetryRef.current === callId) return;
    connectedTelemetryRef.current = callId;
    if (callSessionRef.current?.callId === callId) {
      callSessionRef.current.reachedActive = true;
      logDiagnosticTimeline('session.markCallSessionActive', telephonySnapshot, {
        callId,
        reachedActive: true,
        connectedAt: telephonySnapshot.session?.connectedAt,
        durationSeconds: telephonySnapshot.session?.durationSeconds,
      });
    }
    trackCallConnected(callId, session.remoteLabel, session.direction);
    postServerCallLog({
      callSid: callId,
      from: session.logFrom,
      to: session.logTo,
      direction: session.direction,
      status: 'connected',
    });
  }, [telephonySnapshot.callPhase, telephonySnapshot.session?.callId, telephonySnapshot.session?.remoteLabel, telephonySnapshot.session?.direction, telephonySnapshot.session?.logFrom, telephonySnapshot.session?.logTo]);

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
    setCallHistory(loadCallHistory());
  }, []);

  useEffect(() => {
    if (showIncomingOverlay) {
      stopIncomingRingtone();
      incomingRingtoneRef.current = startIncomingRingtoneLoop();
    } else {
      stopIncomingRingtone();
    }
    return () => stopIncomingRingtone();
  }, [showIncomingOverlay]);

  useEffect(() => {
    if (!telephonyConnected) return;
    const call = callRef.current;
    const snap = orchestrator.getSnapshot();
    if (!call || snap.session?.kind !== 'internal_extension') return;
    attachCallMedia(call, 'internal_extension:bridge-connected', { forceRewire: true });
  }, [telephonyConnected]);

  useEffect(() => () => {
    stopIncomingRingtone();
    stopOutboundRingback(callRef.current);
    if (missedToastTimerRef.current != null) {
      window.clearTimeout(missedToastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let client: TelnyxRTC | null = null;
    let unbindTokenLifecycle: (() => void) | null = null;
    tearingDownRef.current = false;

    async function boot() {
      try {
        logTelnyx('boot.start');

        const [config, me] = await Promise.all([getSoftphoneConfig(), getMe()]);
        const defaultCallerId = config.defaultCallerId || config.numbers[0]?.number || '';
        if (!defaultCallerId) {
          if (mounted) setBootStatus('No caller ID — assign a tenant number first');
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
            setBootStatus('Empty login token from /api/softphone/token');
            trackSoftphoneEvent('Registration Failed', { reason: 'empty_login_token', phase: 'boot' });
          }
          logTelnyx('boot.empty-token');
          return;
        }

        client = new TelnyxRTC(buildTelnyxClientOptions(tokenRes.loginToken));

        unbindTokenLifecycle = bindTelnyxTokenLifecycle(client, {
          expiresInSeconds: tokenRes.expiresInSeconds,
          fetchLoginToken: async () => (await getSoftphoneToken()).loginToken,
          isAborted: () => tearingDownRef.current || !mounted,
          onRefreshed: () => logTelnyx('token.refresh.success'),
          onRefreshError: (error) => {
            logTelnyx('token.refresh.error', error);
            if (tearingDownRef.current || !mounted || !client) return;
            const activeClient = client;
            void getSoftphoneToken()
              .then((next) => {
                const loginToken = next.loginToken?.trim();
                if (!loginToken) throw new Error('Empty login token during recovery');
                const tokenClient = activeClient as TelnyxRTC & { updateToken?: (token: string) => void };
                if (typeof tokenClient.updateToken === 'function') {
                  tokenClient.updateToken(loginToken);
                  return;
                }
                reconnectControllerRef.current?.schedule();
              })
              .catch(() => {
                reconnectControllerRef.current?.schedule();
              });
          },
        });

        let audioEl = getRemoteAudioElement();
        if (!audioEl) {
          try {
            audioEl = await waitForRemoteAudioElement(
              { current: null },
              REMOTE_AUDIO_ID,
            );
          } catch (err) {
            logTelnyx('boot.remote-audio-missing', err);
          }
        }
        if (audioEl) {
          bindRemoteAudioTarget(client, audioEl);
          logTelnyx('boot.remote-audio-bound', { id: audioEl.id });
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
              orchestrator.reconnectAttempt(attempt);
            }
          },
        });

        client.on('telnyx.socket.open', () => {
          logTelnyx('telnyx.socket.open');
          orchestrator.dispatchConnection({ type: 'CONN_SOCKET_OPEN' });
        });

        client.on('telnyx.socket.close', (event: unknown) => {
          logTelnyx('telnyx.socket.close', event);
          orchestrator.dispatchConnection({ type: 'CONN_SOCKET_CLOSE' });
          if (tearingDownRef.current || !mounted) return;
          const snap = orchestrator.getSnapshot();
          if (snap.callPhase === 'idle' && snap.connection === 'ready') {
            return;
          }
          reconnectControllerRef.current?.schedule();
        });

        client.on('telnyx.ready', () => {
          logTelnyx('telnyx.ready');
          const attempts = reconnectControllerRef.current?.getAttempt() ?? 0;
          reconnectControllerRef.current?.reset();
          if (mounted) {
            if (attempts > 0) {
              const reconnectedAt = new Date().toISOString();
              setLastReconnectTime(reconnectedAt);
              trackSoftphoneEvent('Registration Restored', { attempts, reconnectedAt });
            } else if (!registrationSuccessEmittedRef.current) {
              registrationSuccessEmittedRef.current = true;
              trackSoftphoneEvent('Registration Success');
            }
            orchestrator.dispatchConnection({ type: 'CONN_READY' });
          }
        });

        client.on('telnyx.notification', (notification: unknown) => {
          logTelnyx('telnyx.notification', notification);
          const payload = notification as TelnyxNotificationPayload;
          const notificationCall = extractCallFromNotification(payload) ?? payload.call ?? null;
          if (notificationCall) {
            callRef.current = notificationCall;
            const normalized = normalizeCallState(notificationCall.state);
            const prevState = normalizeCallPrevState(notificationCall);
            logTelnyx('telnyx.notification.call', {
              type: payload.type,
              id: notificationCall.id,
              state: notificationCall.state,
              direction: (notificationCall as Call & { direction?: string }).direction,
            });
            logDiagnosticTimeline('sdk.notification', orchestrator.getSnapshot(), {
              notificationType: payload.type,
              sdkState: normalized,
              sdkPrevState: prevState,
              rawState: notificationCall.state,
              callId: notificationCall.id,
              callSessionId: (payload as { call_session_id?: string }).call_session_id
                ?? (notificationCall as Call & { callSessionId?: string }).callSessionId
                ?? null,
              direction: (notificationCall as Call & { direction?: string }).direction,
              ringbackSource: getActiveLocalToneSourceForDiagnostics(),
            });
            if (mounted) {
              const ownedInboundNumbers = getOwnedInboundNumbers();
              const snap = orchestrator.getSnapshot();
              const callId = notificationCall.id ?? '';
              const terminal = isTerminalSdkState(normalized);
              const callAlreadyFinalized = Boolean(
                callId && finalizedCallIdsRef.current.has(callId),
              );
              const outboundSessionLive = snap.session?.direction === 'outbound'
                && LIVE_CALL_PHASES.has(snap.callPhase);
              const notificationIsInbound = isLikelyInboundRingingInvite(
                notificationCall,
                outboundSessionLive,
              );
              const notificationIsOutboundLeg = snap.session?.direction === 'outbound'
                || callSessionRef.current?.direction === 'outbound';

              const pstnCallerHint = callSessionRef.current?.pstnCaller || '';
              const prevLabel = snap.session?.remoteLabel ?? displayNumberRef.current;
              const resolved = resolveCallDisplayNumber(
                notificationCall,
                prevLabel,
                payload,
                ownedInboundNumbers,
                pstnCallerHint,
              );

              if (isInboundCall(notificationCall) || notificationIsInbound) {
                const hint = resolveInboundCallerNameHint(notificationCall as CallDisplayFields);
                const retained = prevLabel
                  || callSessionRef.current?.number
                  || '';
                const next = resolved !== 'Unknown' ? resolved : retained;
                displayNumberRef.current = next;
                orchestrator.updateSessionLabel(next, hint);
              } else if (resolved !== 'Unknown') {
                displayNumberRef.current = resolved;
                orchestrator.updateSessionLabel(resolved);
              }

              if (
                notificationIsInbound
                && callId
                && !terminal
                && !callAlreadyFinalized
              ) {
                const inboundNumber = resolveCallDisplayNumber(
                  notificationCall,
                  '',
                  payload,
                  ownedInboundNumbers,
                  pstnCallerHint,
                );
                if (
                  !callSessionRef.current
                  || callSessionRef.current.callId !== callId
                ) {
                  const parties = resolveCallLogParties(
                    'inbound',
                    inboundNumber,
                    callerNumberRef.current,
                  );
                  orchestrator.receiveInbound({
                    callId,
                    remoteLabel: inboundNumber,
                    logFrom: parties.from,
                    logTo: parties.to,
                    callerNameHint: resolveInboundCallerNameHint(notificationCall as CallDisplayFields),
                  });
                  beginCallSession(callId, inboundNumber, 'inbound');
                } else if (inboundNumber !== 'Unknown') {
                  const historySession = callSessionRef.current;
                  const normalizedNumber = normalizeDialNumber(inboundNumber) || inboundNumber;
                  if (historySession.direction === 'inbound' && historySession.number !== normalizedNumber) {
                    const parties = resolveCallLogParties('inbound', normalizedNumber, callerNumberRef.current);
                    historySession.number = normalizedNumber;
                    historySession.logFrom = parties.from;
                    historySession.logTo = parties.to;
                    orchestrator.updateSessionLabel(normalizedNumber);
                    orchestrator.updateSessionLogParties(parties.from, parties.to);
                  }
                }
              }

              const sessionKind = snap.session?.kind;
              const isInternalExtension = sessionKind === 'internal_extension';

              if (
                callId
                && payload.type
                && !terminal
                && (notificationIsInbound
                  || (!notificationIsInbound && notificationIsOutboundLeg))
              ) {
                orchestrator.dispatchSdkNotification(notificationCall, payload.type);
              }

              const snapAfterDispatch = orchestrator.getSnapshot();
              const bridgeConnected = selectIsConnected(snapAfterDispatch);
              const shouldAttachMedia = (
                (normalized === 'early' && !notificationIsInbound && !isInternalExtension)
                || (normalized === 'active' && notificationIsInbound && bridgeConnected)
                || (normalized === 'active' && !notificationIsInbound && (
                  bridgeConnected
                  || (!isInternalExtension && sessionKind === 'pstn')
                ))
              );

              if (shouldAttachMedia && callId) {
                attachCallMedia(
                  notificationCall,
                  notificationIsInbound
                    ? `inbound:${normalized}`
                    : `outbound:${normalized}`,
                  {
                    forceRewire: bridgeConnected && isInternalExtension,
                  },
                );
                stopIncomingRingtoneRef.current();
              }

              if (terminal) {
                orchestrator.terminal(normalized === 'error' ? 'failed' : normalized);
                if (callSessionRef.current) {
                  callSessionRef.current.terminationReason = extractHangupCause(
                    notificationCall,
                    payload,
                  );
                }
                clearCallMedia();
                releaseMicrophoneStream(localMediaStreamRef);
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
                resetCallSideEffects();
                callSessionRef.current = null;
                setLastDtmf('');
                setSpeakerOn(true);
                orchestrator.reset();
              }
            }
          }
        });

        client.on('telnyx.error', (event: unknown) => {
          logTelnyx('telnyx.error', event);
          trackSoftphoneEvent('Registration Failed', {
            reason: formatTelnyxErrorMessage(event),
            phase: 'runtime',
          });
          if (mounted) {
            orchestrator.dispatchConnection({
              type: 'CONN_AUTH_FAILED',
              reason: formatTelnyxErrorMessage(event),
            });
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
          if (mounted && !callSessionRef.current?.reachedActive) {
            setLastDtmf('');
            setSpeakerOn(true);
            orchestrator.reset();
          }
          if (!tearingDownRef.current && mounted) {
            reconnectControllerRef.current?.schedule();
          }
        });

        clientRef.current = client;
        if (mounted) orchestrator.dispatchConnection({ type: 'CONN_CONNECTING' });
        logTelnyx('boot.connect');
        client.connect();
      } catch (err) {
        logTelnyx('boot.error', err);
        trackSoftphoneEvent('Registration Failed', {
          reason: err instanceof Error ? err.message : 'boot.error',
          phase: 'boot',
        });
        if (mounted) {
          setBootStatus(err instanceof Error ? err.message : 'Boot failed');
        }
      }
    }

    void boot();

    return () => {
      mounted = false;
      tearingDownRef.current = true;
      unbindTokenLifecycle?.();
      unbindTokenLifecycle = null;
      reconnectControllerRef.current?.cancel();
      reconnectControllerRef.current = null;
      orchestrator.dispatchConnection({ type: 'CONN_DISCONNECTED' });
      setPresenceStatus('offline');
      logTelnyx('boot.cleanup');
      stopIncomingRingtoneRef.current();
      stopOutboundRingback(callRef.current);
      clearCallMedia();
      releaseMicrophoneStream(localMediaStreamRef);
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

  const onCallWithDestination = async (number: string) => {
    const client = clientRef.current;
    const { destinationNumber, isExtension } = resolveOutboundDestination(number);
    logTelnyx('call.click', { destinationNumber, callerNumber, isExtension });

    if (!telnyxReady || !telnyxSocketConnected || reconnecting) {
      logTelnyx('call.blocked', 'not registered');
      orchestrator.setConnectionStatus('Softphone not registered — wait for Ready status');
      return;
    }
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

    await primeAudio();

    const outboundCallerId = normalizeDialNumber(callerNumber);
    resetInCallControls();
    resetCallSideEffects();
    orchestrator.reset();

    try {
      await orchestrator.beginOutboundDial(
        destinationNumber,
        isExtension ? 'internal_extension' : 'pstn',
      );
      const audioEl = getRemoteAudioElement();
      const localStream = await acquireMicrophoneStream(localMediaStreamRef);
      logTelnyx('outbound.localStream', {
        trackCount: localStream.getAudioTracks().length,
        tracks: localStream.getAudioTracks().map((track) => ({
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
        })),
        isExtension,
      });

      const call = client.newCall({
        destinationNumber,
        callerNumber: outboundCallerId,
        audio: true,
        localStream,
        remoteElement: audioEl ?? REMOTE_AUDIO_ID,
      });
      callRef.current = call;
      const parties = resolveCallLogParties('outbound', destinationNumber, outboundCallerId);
      orchestrator.updateSessionLogParties(parties.from, parties.to);
      if (isExtension) {
        orchestrator.updateSessionLabel(`Ext ${destinationNumber}`);
      }
      beginCallSession(call.id, destinationNumber, 'outbound');
      orchestrator.acceptDial(call.id);
      logTelnyx('newCall.returned', {
        id: call.id,
        state: call.state,
        isExtension,
        keys: Object.keys(call as object),
      });
      trackSoftphoneEvent('Call Started', {
        callId: call.id,
        number: destinationNumber,
        direction: 'outbound',
      });
    } catch (err) {
      logTelnyx('newCall.error', err);
      if (isExtension) {
        orchestrator.failDial(err instanceof Error ? err.message : 'newCall.error');
        orchestrator.setConnectionStatus(err instanceof Error ? err.message : 'Internal call failed');
      }
      trackSoftphoneEvent('Call Failed', {
        callId: 'unknown',
        number: destinationNumber,
        direction: 'outbound',
        reason: err instanceof Error ? err.message : 'newCall.error',
      });
    }
  };

  const onCall = () => {
    if (!canPlaceCall) {
      logTelnyx('call.blocked.ui', {
        telnyxReady,
        reconnecting,
        destination,
        callerNumber,
        validDial: isValidDialInput(destination),
      });
      if (!telnyxReady) {
        orchestrator.setConnectionStatus('Softphone not registered — wait for Ready status');
      }
      return;
    }
    void onCallWithDestination(destination).catch((err) => {
      logTelnyx('call.unhandled-error', err);
      orchestrator.setConnectionStatus(err instanceof Error ? err.message : 'Call failed');
    });
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
      const localStream = await acquireMicrophoneStream(localMediaStreamRef);

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
            orchestrator.updateSessionLabel(normalized);
            orchestrator.updateSessionLogParties(parties.from, parties.to);
            logTelnyx('answer.pstnCaller', { pstnCaller: normalized });
          }
        }).catch((err) => {
          logTelnyx('answer.callAccepted.error', err);
        });
      }

      await call.answer();
      attachCallMedia(call, isInbound ? 'inbound:answer' : 'outbound:answer');
      void logPeerConnectionDiagnostics(call, 'answer:after');
      const resolved = resolveCallDisplayNumber(
        call,
        orchestrator.getSnapshot().session?.remoteLabel ?? '',
        undefined,
        getOwnedInboundNumbers(),
        callSessionRef.current?.pstnCaller || '',
      );
      if (resolved !== 'Unknown') {
        orchestrator.updateSessionLabel(resolved);
      }
      if (isInbound && call.id) {
        orchestrator.dispatchCall({
          type: 'REMOTE_ANSWER_CONFIRMED',
          callId: call.id,
          source: 'inbound_user_answer',
        });
      }
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
    resetInCallControls();
  };

  const onHangup = () => {
    const call = callRef.current;
    logTelnyx('hangup.click', call ? { id: call.id, state: call.state } : null);
    if (!call) return;
    stopIncomingRingtone();
    stopOutboundRingback(call);
    orchestrator.requestHangup();
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
    resetInCallControls();
  };

  const onCallBack = (record: CallHistoryRecord) => {
    const callbackNumber = record.number || record.phoneNumber || record.remotePartyNumber || '';
    setDestination(callbackNumber);
    logTelnyx('history.callback', { number: callbackNumber });
    if (!hasLiveCall) {
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
    if (!call || !inCallMediaReady) return;

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
    if (!call || !inCallMediaReady) return;
    try {
      const nextMuted = !telephonyMuted;
      setLocalAudioMuted(call, nextMuted);
      orchestrator.setMuted(nextMuted);
      logTelnyx('mute.toggle', { muted: nextMuted });
    } catch (err) {
      logTelnyx('mute.error', err);
    }
  };

  const onToggleHold = () => {
    const call = callRef.current as CallWithControls | null;
    if (!call || !inCallMediaReady) return;
    const nextHold = !telephonyOnHold;
    void (async () => {
      try {
        if (nextHold) {
          if (typeof call.hold !== 'function') {
            logTelnyx('hold.unavailable');
            return;
          }
          await call.hold();
          orchestrator.holdStarted();
        } else {
          if (typeof call.unhold !== 'function') {
            logTelnyx('unhold.unavailable');
            return;
          }
          await call.unhold();
          orchestrator.holdEnded();
        }
        logTelnyx('hold.toggle', { onHold: nextHold });
      } catch (err) {
        logTelnyx('hold.error', err);
      }
    })();
  };

  const onToggleSpeaker = () => {
    const audioEl = document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
    if (!audioEl) return;
    const next = !speakerOn;
    audioEl.volume = next ? 1 : 0.35;
    setSpeakerOn(next);
    logDiagnosticTimeline('media.speaker.routing', orchestrator.getSnapshot(), {
      speakerOn: next,
      remoteVolume: audioEl.volume,
    });
    logTelnyx('speaker.toggle', { speakerOn: next });
  };

  const onTransfer = async () => {
    if (transferBusy || telephonyCallDirection !== 'inbound' || !inCallMediaReady) return;

    const destination = window.prompt('Transfer to (extension or phone number):');
    if (!destination?.trim()) return;

    setTransferBusy(true);
    orchestrator.setConnectionStatus('Transferring call…');
    logTelnyx('transfer.blind.start', { destination: destination.trim() });

    try {
      const result = await postBlindTransfer(destination.trim());
      if (!result.success) {
        orchestrator.setConnectionStatus(result.error || 'Transfer failed');
        logTelnyx('transfer.blind.failed', result);
        return;
      }
      orchestrator.setConnectionStatus('Transfer in progress…');
      orchestrator.dispatchCall({ type: 'TRANSFER_STARTED' });
      logTelnyx('transfer.blind.accepted', result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transfer failed';
      orchestrator.setConnectionStatus(message);
      logTelnyx('transfer.blind.error', { message });
    } finally {
      setTransferBusy(false);
    }
  };

  const onCallerIdChange = (value: string) => {
    setCallerNumber(value);
    callerNumberRef.current = value;
    persistStoredCallerId(value);
    logTelnyx('caller-id.changed', { callerNumber: value });
  };

  const canPlaceCall = orchestrator.canPlaceCall({
    destination,
    callerNumber,
    isValidDial: isValidDialInput(destination),
  });
  const displayStatus = bootStatus || connectionStatus;
  const activeCallCount = hasLiveCall ? 1 : 0;
  const failedCallCount = callHistory.filter((record) => record.status !== 'completed').length;
  const missedCallCount = callHistory.filter((record) => isInboundMissedStatus(record.status)).length;

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
      isCallActive={telephonyConnected}
      callState={uiCallState}
      callDirection={telephonyCallDirection}
      displayNumber={telephonyDisplayNumber}
      callerDisplayNameHint={telephonyCallerNameHint}
      incomingReceivedAt={telephonyIncomingReceivedAt}
      callSeconds={telephonyDurationSeconds}
      muted={telephonyMuted}
      speakerOn={speakerOn}
      onHold={telephonyOnHold}
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
      onTransfer={onTransfer}
      transferBusy={transferBusy}
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
