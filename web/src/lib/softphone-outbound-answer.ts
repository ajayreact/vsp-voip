import type { Call } from '@telnyx/webrtc';

/** Telnyx states that mean the far end is still ringing (not yet answered). */
export const OUTBOUND_REMOTE_RING_STATES = new Set([
  'trying',
  'ringing',
  'early',
  'answering',
]);

export type OutboundAnswerTracker = {
  remoteRingSeen: boolean;
  lastProgressState: string;
};

export function createOutboundAnswerTracker(): OutboundAnswerTracker {
  return { remoteRingSeen: false, lastProgressState: '' };
}

export function resetOutboundAnswerTracker(tracker: OutboundAnswerTracker) {
  tracker.remoteRingSeen = false;
  tracker.lastProgressState = '';
}

export function noteOutboundProgress(
  tracker: OutboundAnswerTracker,
  state: string,
) {
  const normalized = state.trim().toLowerCase();
  if (!normalized || normalized === 'active') return;
  tracker.lastProgressState = normalized;
  if (OUTBOUND_REMOTE_RING_STATES.has(normalized)) {
    tracker.remoteRingSeen = true;
  }
}

function normalizeCallPrevState(call: Call): string {
  const extended = call as Call & { prevState?: string | number };
  if (typeof extended.prevState === 'number' && Number.isFinite(extended.prevState)) {
    const states = [
      'new', 'requesting', 'trying', 'recovering', 'ringing', 'answering',
      'early', 'active', 'held', 'hangup', 'destroy', 'purge',
    ];
    return states[extended.prevState] ?? String(extended.prevState);
  }
  return String(extended.prevState ?? '').trim().toLowerCase();
}

/**
 * Outbound WebRTC can reach `active` before the PSTN/SIP far end answers (early media).
 * Require a prior ringing phase before treating the call as connected.
 */
export function canConfirmOutboundAnswer(
  call: Call,
  tracker: OutboundAnswerTracker,
): boolean {
  const state = String(call.state ?? '').trim().toLowerCase();
  if (state !== 'active' && state !== 'held') return false;

  if (tracker.remoteRingSeen) return true;

  const prev = normalizeCallPrevState(call);
  return OUTBOUND_REMOTE_RING_STATES.has(prev);
}

const OUTBOUND_RINGBACK_PLAY_STATES = new Set([
  'new',
  'requesting',
  'trying',
  'ringing',
  'early',
  'answering',
]);

const OUTBOUND_RINGBACK_STOP_TERMINAL = new Set([
  'hangup',
  'destroy',
  'error',
  'busy',
  'failed',
  'rejected',
  'cancelled',
  'no-answer',
  '',
]);

/** Keep local ringback until the far end is confirmed answered or the call ends. */
export function shouldPlayOutboundRingback(
  callDirection: 'inbound' | 'outbound' | '',
  callAnswered: boolean,
  callState: string,
): boolean {
  if (callDirection !== 'outbound' || callAnswered) return false;
  const normalized = callState.trim().toLowerCase();
  if (OUTBOUND_RINGBACK_PLAY_STATES.has(normalized)) return true;
  // Answer gate / internal bridge: WebRTC may be active while the desk phone still rings.
  if (normalized === 'active' || normalized === 'early') return true;
  return false;
}

export function shouldStopOutboundRingback(
  callState: string,
  callAnswered: boolean,
): boolean {
  const normalized = callState.trim().toLowerCase();
  if (OUTBOUND_RINGBACK_STOP_TERMINAL.has(normalized)) return true;
  return callAnswered && (normalized === 'active' || normalized === 'held');
}

/**
 * Internal Call Control bridge: the agent WebRTC leg goes active when auto-answered.
 * Confirm only after a second active transition (desk bridged) or standard PSTN-style
 * progress on the same leg (trying/ringing then active).
 */
export function canConfirmInternalBridgeAnswer(
  call: Call,
  tracker: OutboundAnswerTracker,
  activeTransitionCount: number,
): boolean {
  const state = String(call.state ?? '').trim().toLowerCase();
  if (state !== 'active' && state !== 'held') return false;
  if (activeTransitionCount >= 2) return true;
  return canConfirmOutboundAnswer(call, tracker);
}

/** UI label state — keep "Calling…" until the remote party is confirmed answered. */
export function resolveOutboundUiCallState(
  callState: string,
  callDirection: 'inbound' | 'outbound' | '',
  callAnswered: boolean,
): string {
  if (
    callDirection === 'outbound'
    && !callAnswered
    && (callState === 'active' || callState === 'early')
  ) {
    return 'ringing';
  }
  return callState;
}
