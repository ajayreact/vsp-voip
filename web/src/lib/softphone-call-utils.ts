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
): boolean {
  if (hasOutboundLiveSession) return false;
  if (isInboundCall(call)) return true;
  if (!call) return false;

  const state = normalizeCallState(call.state);
  if (!isConnectingCallState(state)) return false;

  const options = (call as Call & {
    options?: { destinationNumber?: string };
  }).options;

  return !options?.destinationNumber;
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
