/**
 * Call lifecycle state adapter (V2 scaffold).
 * Production sessions remain in callControlSessionStore until Phase 3 wiring.
 */
const {
  saveSession,
  getSession,
} = require('../callControlSession');
const { logDeskTelephonyEvent } = require('./deskOutboundLogger');

const CALL_STATES = {
  NEW: 'NEW',
  RINGING: 'RINGING',
  ANSWERED: 'ANSWERED',
  HELD: 'HELD',
  RESUMED: 'RESUMED',
  TRANSFERRED: 'TRANSFERRED',
  ENDED: 'ENDED',
};

async function createSession(callControlId, session) {
  await saveSession(callControlId, session);
  logDeskTelephonyEvent('session.created', {
    callControlId,
    tenantId: session?.tenantId ?? null,
    callKind: session?.callKind ?? null,
    targetExtensionNumber: session?.targetExtensionNumber ?? null,
  });
  return session;
}

async function getCallSession(callControlId) {
  return getSession(callControlId);
}

async function transition(_callControlId, _fromState, _toState, _metadata = {}) {
  throw new Error('CallStateManager.transition is not implemented');
}

async function endSession(_callControlId, _reason) {
  throw new Error('CallStateManager.endSession is not implemented');
}

module.exports = {
  CALL_STATES,
  createSession,
  getCallSession,
  transition,
  endSession,
};
