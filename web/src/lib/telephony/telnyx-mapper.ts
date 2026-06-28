import type { Call } from '@telnyx/webrtc';
import { OUTBOUND_REMOTE_RING_STATES } from '@/lib/softphone-outbound-answer';
import { classifyAnswerConfirmReason } from './diagnostics';
import { logDiagnosticTimeline } from './logger';
import type { CallSessionContext, TelephonyCallEvent } from './types';

const TELNYX_STATE_BY_NUMBER = [
  'new', 'requesting', 'trying', 'recovering', 'ringing', 'answering',
  'early', 'active', 'held', 'hangup', 'destroy', 'purge',
] as const;

export function normalizeSdkCallState(state: string | number | undefined | null): string {
  if (typeof state === 'number' && Number.isFinite(state)) {
    return TELNYX_STATE_BY_NUMBER[state] ?? String(state);
  }
  return String(state ?? '').trim().toLowerCase();
}

export function mapSdkStateToCallEvents(
  normalized: string,
  callId: string,
): TelephonyCallEvent[] {
  switch (normalized) {
    case 'trying':
    case 'requesting':
      return [{ type: 'SDK_TRYING' }];
    case 'ringing':
      return [{ type: 'SDK_RINGING' }];
    case 'early':
      return [{ type: 'SDK_EARLY' }];
    case 'answering':
      return [{ type: 'SDK_ANSWERING' }];
    case 'active':
      return [{ type: 'SDK_ACTIVE', callId }];
    case 'held':
      return [{ type: 'SDK_HELD' }];
    case 'hangup':
    case 'destroy':
    case 'purge':
      return [{ type: 'SDK_TERMINAL', reason: normalized }];
    case 'error':
      return [{ type: 'SDK_TERMINAL', reason: 'failed' }];
    default:
      return [];
  }
}

function normalizeCallPrevState(call: Call): string {
  const extended = call as Call & { prevState?: string | number };
  if (typeof extended.prevState === 'number' && Number.isFinite(extended.prevState)) {
    return TELNYX_STATE_BY_NUMBER[extended.prevState] ?? String(extended.prevState);
  }
  return String(extended.prevState ?? '').trim().toLowerCase();
}

/** Telnyx early media can reach `active` before the far end answers — only prior ring/answer states count. */
const ANSWER_CONFIRM_PREV_STATES = new Set(['ringing', 'answering']);

function isActiveOrHeldSdkCall(call: Call): boolean {
  const state = normalizeSdkCallState(call.state);
  return state === 'active' || state === 'held';
}

function canConfirmFromSession(call: Call): boolean {
  if (!isActiveOrHeldSdkCall(call)) return false;
  const prev = normalizeCallPrevState(call);
  return ANSWER_CONFIRM_PREV_STATES.has(prev);
}

/** Source tag for the internal-extension early-media second-active answer fallback. */
export const PSTN_SECOND_ACTIVE_SOURCE = 'pstn_second_active';

/**
 * Bug #2: first `active` after `early` is early media, not a far-end answer.
 * Telnyx INotification documents `early` as a distinct pre-connect progress state.
 */
function isFirstActiveAfterEarlyMedia(session: CallSessionContext, call: Call): boolean {
  if (session.connectedAt != null) return false;
  if (session.activeTransitionCount > 1) return false;
  return normalizeCallPrevState(call) === 'early';
}

/**
 * Internal extension Park Outbound: server answers the parked WebRTC leg before the desk
 * phone bridges. Confirm only on the second documented `active` callUpdate (bridge complete).
 * @see Telnyx Pattern 1 — first active = parked leg answered; second active = bridge_on_answer
 */
function canConfirmInternalExtensionAnswer(session: CallSessionContext, call: Call): boolean {
  if (session.kind !== 'internal_extension') return false;
  if (session.connectedAt != null) return false;
  if (!isActiveOrHeldSdkCall(call)) return false;
  if (isFirstActiveAfterEarlyMedia(session, call)) return false;
  if (!session.remoteRingSeen) return false;
  if (session.activeTransitionCount < 2) return false;
  const callId = String(call.id ?? '').trim();
  if (!callId || callId !== session.callId) return false;
  return true;
}

/**
 * Outbound PSTN: Telnyx documents `callUpdate` + `state: active` as connected (start timer).
 * @see docs/telnyx/javascript-sdk/reference/inotification.md — `active` = media flowing
 * @see docs/telnyx/javascript-sdk/explanation/call-state-lifecycle.md — ringing → active
 */
function canConfirmPstnOutboundAnswer(session: CallSessionContext, call: Call): boolean {
  if (session.kind !== 'pstn') return false;
  if (session.connectedAt != null) return false;
  if (!isActiveOrHeldSdkCall(call)) return false;
  if (isFirstActiveAfterEarlyMedia(session, call)) return false;
  return true;
}

export function shouldConfirmRemoteAnswer(input: {
  call: Call;
  session: CallSessionContext;
  eventType?: string;
  userAnswered?: boolean;
}): { confirmed: boolean; source: string; reason: string } {
  const { call, session, eventType, userAnswered } = input;
  let result: { confirmed: boolean; source: string };

  if (session.direction === 'inbound') {
    if (userAnswered) {
      result = { confirmed: true, source: 'inbound_user_answer' };
    } else {
      result = { confirmed: false, source: 'inbound_deferred' };
    }
  } else if (session.connectedAt != null) {
    result = { confirmed: false, source: 'already_connected' };
  } else if (session.kind === 'pstn' && canConfirmPstnOutboundAnswer(session, call)) {
    result = { confirmed: true, source: eventType ? `pstn_${eventType}` : 'pstn_active' };
  } else if (canConfirmInternalExtensionAnswer(session, call)) {
    result = {
      confirmed: true,
      source: canConfirmFromSession(call)
        ? (eventType ? `pstn_${eventType}` : 'pstn_active')
        : PSTN_SECOND_ACTIVE_SOURCE,
    };
  } else {
    result = { confirmed: false, source: 'pstn_deferred' };
  }

  const reason = classifyAnswerConfirmReason(result.source);
  const prev = normalizeCallPrevState(call);
  logDiagnosticTimeline('answer.shouldConfirmRemoteAnswer', {}, {
    confirmed: result.confirmed,
    source: result.source,
    reason,
    sdkState: normalizeSdkCallState(call.state),
    sdkPrevState: prev,
    eventType,
    remoteRingSeen: session.remoteRingSeen,
    activeTransitionCount: session.activeTransitionCount,
    kind: session.kind,
    direction: session.direction,
  });

  return { ...result, reason };
}

export function isTerminalSdkState(state: string): boolean {
  return state === 'hangup' || state === 'destroy' || state === 'purge' || state === 'error';
}

export function noteSessionSdkProgress(session: CallSessionContext, normalizedState: string) {
  if (!normalizedState || normalizedState === 'active') return;
  if (OUTBOUND_REMOTE_RING_STATES.has(normalizedState)) {
    session.remoteRingSeen = true;
  }
}
