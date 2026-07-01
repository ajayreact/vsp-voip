/** Frozen V3 Leg FSM transition table (ADR-003). */

const TERMINAL = new Set(['ENDED', 'FAILED']);

/**
 * @type {Record<string, string>}
 */
const LEG_TRANSITIONS = {
  'NEW:leg.created': 'DIALING',
  'NEW:leg.hangup': 'ENDED',

  'DIALING:call.ringing': 'RINGING',
  'DIALING:call.failed': 'FAILED',
  'DIALING:leg.hangup': 'ENDED',

  'RINGING:call.answered': 'ANSWERED',
  'RINGING:timer.expired': 'FAILED',
  'RINGING:call.failed': 'FAILED',
  'RINGING:leg.hangup': 'ENDED',

  'ANSWERED:bridge.completed': 'BRIDGED',
  'ANSWERED:hold.started': 'HELD',
  'ANSWERED:leg.hangup': 'ENDED',

  'BRIDGED:hold.started': 'HELD',
  'BRIDGED:leg.hangup': 'ENDED',

  'HELD:hold.ended': 'BRIDGED',
  'HELD:leg.hangup': 'ENDED',
};

function legTransitionKey(fromState, triggerEvent) {
  return `${fromState}:${triggerEvent}`;
}

function resolveLegTransition(fromState, triggerEvent) {
  if (TERMINAL.has(fromState)) return null;
  const direct = LEG_TRANSITIONS[legTransitionKey(fromState, triggerEvent)];
  if (direct) return direct;
  if (triggerEvent === 'call.failed') return 'FAILED';
  if (triggerEvent === 'leg.hangup' || triggerEvent === 'leg.ended') return 'ENDED';
  return null;
}

function isTerminalLegState(state) {
  return TERMINAL.has(state);
}

module.exports = {
  LEG_TRANSITIONS,
  resolveLegTransition,
  isTerminalLegState,
};
