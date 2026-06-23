import type { Call } from '@telnyx/webrtc';
import { isTerminalCallState, normalizeCallState } from '@/lib/telnyx-debug';

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

  if (direction === 'inbound') return true;

  const options = (call as Call & {
    options?: { destinationNumber?: string; remoteCallerNumber?: string };
  }).options;

  // Outbound calls always set destinationNumber; inbound INVITEs expose remote caller instead.
  return Boolean(options?.remoteCallerNumber && !options?.destinationNumber);
}

export function resolveRemoteCallerNumber(call: Call | null | undefined) {
  if (!call) return '';

  const options = (call as Call & {
    options?: {
      remoteCallerNumber?: string;
      callerNumber?: string;
      callerName?: string;
      remoteCallerName?: string;
    };
  }).options;

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

  const type = String(notification.type || '');
  if (CALL_NOTIFICATION_TYPES.has(type) || type.includes('invite') || type.includes('attach')) {
    return notification.call;
  }

  return null;
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
