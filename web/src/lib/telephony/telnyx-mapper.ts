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

function canConfirmFromSession(call: Call): boolean {
  const state = normalizeSdkCallState(call.state);
  if (state !== 'active' && state !== 'held') return false;
  const prev = normalizeCallPrevState(call);
  return ANSWER_CONFIRM_PREV_STATES.has(prev);
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
  } else if (session.kind === 'internal_extension' && !session.bridgeAutoAnswered) {
    result = { confirmed: false, source: 'internal_pre_bridge' };
  } else if (session.awaitingDeskBridge) {
    if (session.activeTransitionCount >= 2) {
      result = { confirmed: true, source: 'internal_bridge_second_active' };
    } else {
      result = { confirmed: false, source: 'internal_bridge_deferred' };
    }
  } else if (canConfirmFromSession(call)) {
    result = { confirmed: true, source: eventType ? `pstn_${eventType}` : 'pstn_active' };
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
    awaitingDeskBridge: session.awaitingDeskBridge,
    bridgeAutoAnswered: session.bridgeAutoAnswered,
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
