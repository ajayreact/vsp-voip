import type { Call } from '@telnyx/webrtc';
import { isTerminalCallState, normalizeCallState } from '@/lib/telnyx-debug';
import { resolveInboundCallerDisplay } from './inbound-caller-display';

export type TelnyxSoftphoneNotification = {
  type?: string;
  call?: Call;
  error?: unknown;
};

/** Telnyx JS SDK notification types that may carry an active call. */
export const CALL_NOTIFICATION_TYPES = new Set([
  'callUpdate',
  'invite',
  'participantData',
  'telnyx_rtc.attach',
  'telnyx_rtc.display',
]);

export function isInboundCall(call: Call | null | undefined) {
  if (!call) return false;

  const direction = String(
    (call as Call & { direction?: string }).direction || '',
  ).toLowerCase();

  if (direction === 'outbound') return false;
  if (direction === 'inbound' || direction === 'incoming') return true;

  const extended = call as Call & {
    remotePartyNumber?: string;
    options?: { destinationNumber?: string; remoteCallerNumber?: string };
  };

  // Telnyx JS SDK: inbound caller on call.remotePartyNumber (call-state-lifecycle.md).
  if (extended.remotePartyNumber) return true;

  const options = extended.options;

  // Outbound calls always set destinationNumber; inbound INVITEs expose remote caller instead.
  return Boolean(options?.remoteCallerNumber && !options?.destinationNumber);
}

/**
 * Inbound INVITE heuristic when Telnyx omits direction on the first callUpdate.
 * Idle client + ringing/progress state + no outbound destinationNumber ⇒ inbound.
 */
export function isLikelyInboundRingingInvite(
  call: Call | null | undefined,
  hasOutboundLiveSession: boolean,
  hasInboundLiveSession = false,
): boolean {
  if (hasOutboundLiveSession || hasInboundLiveSession) return false;
  if (isInboundCall(call)) return true;
  if (!call) return false;

  const state = normalizeCallState(call.state);
  if (!isConnectingCallState(state)) return false;

  const options = (call as Call & {
    options?: { destinationNumber?: string };
  }).options;

  return !options?.destinationNumber;
}

/** Telnyx auto-generated SIP usernames must not replace human-readable call labels. */
export function looksLikeTelnyxCredentialUsername(value: string | null | undefined): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (/^gencred[a-z0-9]+$/i.test(trimmed)) return true;
  if (/^sip:gencred[a-z0-9]+@/i.test(trimmed)) return true;
  return /^[a-z0-9]{20,}$/i.test(trimmed) && !/\d{7,}/.test(trimmed);
}

export function shouldIgnoreOutboundStrayLeg(
  sessionCallId: string | null | undefined,
  notificationCallId: string | null | undefined,
  hasOutboundLiveSession: boolean,
): boolean {
  if (!hasOutboundLiveSession) return false;
  const watched = String(sessionCallId || '').trim();
  const incoming = String(notificationCallId || '').trim();
  if (!watched || !incoming || watched === 'pending') return false;
  return watched !== incoming;
}

/** Ignore bridge/reinvite legs while an inbound session is already live. */
export function shouldIgnoreInboundStrayLeg(
  sessionCallId: string | null | undefined,
  notificationCallId: string | null | undefined,
  hasInboundLiveSession: boolean,
): boolean {
  if (!hasInboundLiveSession) return false;
  const watched = String(sessionCallId || '').trim();
  const incoming = String(notificationCallId || '').trim();
  if (!watched || !incoming || watched === 'pending') return false;
  return watched !== incoming;
}

const INBOUND_CONNECTED_PHASES = new Set([
  'connected',
  'hold',
  'recording',
  'transferring',
]);

/**
 * After inbound connect, Telnyx may emit another invite/callUpdate with ringing
 * or a different call.id for the bridge leg — never treat that as a new call.
 */
export function shouldIgnoreDuplicateInboundNotification(input: {
  sessionDirection?: string;
  sessionCallId?: string | null;
  callPhase?: string;
  notificationCallId?: string | null;
  notificationState?: string;
}): boolean {
  if (input.sessionDirection !== 'inbound') return false;

  const watched = String(input.sessionCallId || '').trim();
  const incoming = String(input.notificationCallId || '').trim();
  if (!incoming) return false;

  if (watched && watched !== incoming) {
    return Boolean(input.callPhase && INBOUND_CONNECTED_PHASES.has(input.callPhase));
  }

  if (!watched || watched !== incoming) return false;
  if (!input.callPhase || !INBOUND_CONNECTED_PHASES.has(input.callPhase)) return false;
  return isConnectingCallState(input.notificationState);
}

export function resolveRemoteCallerNumber(call: Call | null | undefined) {
  if (!call) return '';

  const extended = call as Call & {
    remotePartyNumber?: string;
    options?: {
      remoteCallerNumber?: string;
      remotePartyNumber?: string;
      callerNumber?: string;
      callerName?: string;
      remoteCallerName?: string;
      destinationNumber?: string;
    };
  };
  const options = extended.options;

  // Telnyx JS SDK: inbound caller is call.remotePartyNumber (see call-state-lifecycle.md).
  if (isInboundCall(call)) {
    const { chosenDisplayNumber } = resolveInboundCallerDisplay(extended);
    return chosenDisplayNumber === 'Unknown' ? '' : chosenDisplayNumber;
  }

  return (
    options?.remoteCallerNumber
    || options?.callerNumber
    || options?.remoteCallerName
    || options?.callerName
    || ''
  );
}

export function isConnectingCallState(state: string | undefined) {
  const normalized = normalizeCallState(state);
  return normalized === 'new'
    || normalized === 'requesting'
    || normalized === 'trying'
    || normalized === 'ringing'
    || normalized === 'early'
    || normalized === 'answering';
}

export function extractCallFromNotification(notification: TelnyxSoftphoneNotification | null | undefined) {
  if (!notification?.call) return null;

  const type = String(notification.type || '').toLowerCase();
  if (type === 'error') return null;

  if (
    CALL_NOTIFICATION_TYPES.has(String(notification.type || ''))
    || type.includes('invite')
    || type.includes('attach')
    || type.includes('callupdate')
  ) {
    return notification.call;
  }

  // Some SDK builds emit call-bearing notifications with non-standard type strings.
  return notification.call;
}

export function shouldTrackInboundCall(call: Call, watchedCallId: string | null) {
  if (watchedCallId === call.id) return false;
  if (!isInboundCall(call)) return false;

  const state = normalizeCallState(call.state);
  return isConnectingCallState(state) || state === 'active';
}

export function isCallAlive(call: Call | null | undefined) {
  if (!call) return false;
  return !isTerminalCallState(call.state);
}
