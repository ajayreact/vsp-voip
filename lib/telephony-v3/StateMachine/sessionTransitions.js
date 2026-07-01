/** Frozen V3 Session FSM transition table (ADR-003). */

const TERMINAL = new Set(['ENDED', 'FAILED']);

/**
 * @type {Record<string, string>}
 * Key: `${fromState}:${triggerEvent}`
 */
const SESSION_TRANSITIONS = {
  'NEW:call.initiated': 'ROUTING',
  'NEW:session.created': 'ROUTING',
  'NEW:origin.parked': 'ORIGIN_PARKED',

  'ORIGIN_PARKED:tenant.resolved': 'ROUTING',
  'ORIGIN_PARKED:route.decided': 'ROUTING',

  'ROUTING:route.decided': 'RINGING',
  'ROUTING:leg.created': 'RINGING',
  'ROUTING:policy.denied': 'FAILED',
  'ROUTING:route.failover': 'RINGING',
  'ROUTING:call.failed': 'FAILED',

  'RINGING:call.answered': 'BRIDGING',
  'RINGING:timer.expired': 'ROUTING',
  'RINGING:call.failed': 'FAILED',
  'RINGING:leg.ended': 'ENDING',

  'BRIDGING:bridge.completed': 'ACTIVE',
  'BRIDGING:bridge.failed': 'FAILED',
  'BRIDGING:leg.ended': 'ENDING',

  'ACTIVE:hold.started': 'HELD',
  'ACTIVE:transfer.started': 'TRANSFER_PENDING',
  'ACTIVE:leg.ended': 'ENDING',
  'ACTIVE:call.failed': 'FAILED',

  'HELD:hold.ended': 'ACTIVE',
  'HELD:leg.ended': 'ENDING',

  'TRANSFER_PENDING:transfer.completed': 'ACTIVE',
  'TRANSFER_PENDING:transfer.cancelled': 'ACTIVE',
  'TRANSFER_PENDING:timer.expired': 'ACTIVE',
  'TRANSFER_PENDING:leg.ended': 'ENDING',

  'ENDING:session.closed': 'ENDED',
  'ENDING:leg.ended': 'ENDED',
};

function sessionTransitionKey(fromState, triggerEvent) {
  return `${fromState}:${triggerEvent}`;
}

function resolveSessionTransition(fromState, triggerEvent) {
  if (TERMINAL.has(fromState)) return null;
  return SESSION_TRANSITIONS[sessionTransitionKey(fromState, triggerEvent)] || null;
}

function isTerminalSessionState(state) {
  return TERMINAL.has(state);
}

module.exports = {
  SESSION_TRANSITIONS,
  resolveSessionTransition,
  isTerminalSessionState,
};
