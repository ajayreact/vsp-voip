const crypto = require('crypto');
const { IVR_STATUS } = require('./ivrConstants');

/** @type {Set<string>} */
const activeIvrSessions = new Set();

function resetIvrStateForTests() {
  activeIvrSessions.clear();
}

function generateIvrSessionId() {
  return `ivr-${crypto.randomUUID()}`;
}

/**
 * @param {Record<string, unknown>|null|undefined} snapshot
 */
function getIvrFromSnapshot(snapshot) {
  const ivr = snapshot?.ivr;
  if (!ivr || typeof ivr !== 'object') return null;
  return /** @type {Record<string, unknown>} */ (ivr);
}

/**
 * @param {Record<string, unknown>} input
 */
function buildInitialIvrState(input) {
  return {
    ivrSessionId: input.ivrSessionId || generateIvrSessionId(),
    status: IVR_STATUS.ACTIVE,
    currentMenuId: input.rootMenuId || 'root',
    menuStack: [input.rootMenuId || 'root'],
    callControlId: input.callControlId ?? null,
    legId: input.legId ?? null,
    retryCount: 0,
    invalidCount: 0,
    timeoutCount: 0,
    startedAt: new Date().toISOString(),
    lastInput: null,
    routeSelected: null,
    recordingActive: false,
  };
}

/**
 * @param {Record<string, unknown>} ivr
 * @param {string} menuId
 */
function pushMenuStack(ivr, menuId) {
  const stack = Array.isArray(ivr.menuStack) ? [...ivr.menuStack] : [];
  stack.push(menuId);
  return { ...ivr, currentMenuId: menuId, menuStack: stack, status: IVR_STATUS.GATHERING };
}

/**
 * @param {Record<string, unknown>} ivr
 */
function popMenuStack(ivr) {
  const stack = Array.isArray(ivr.menuStack) ? [...ivr.menuStack] : ['root'];
  if (stack.length > 1) stack.pop();
  const menuId = stack[stack.length - 1] || 'root';
  return { ...ivr, currentMenuId: menuId, menuStack: stack };
}

/**
 * @param {string} sessionId
 */
function registerActiveIvr(sessionId) {
  activeIvrSessions.add(sessionId);
}

/**
 * @param {string} sessionId
 */
function unregisterActiveIvr(sessionId) {
  activeIvrSessions.delete(sessionId);
}

/**
 * @param {string} sessionId
 */
function isIvrActive(sessionId) {
  return activeIvrSessions.has(sessionId);
}

module.exports = {
  resetIvrStateForTests,
  generateIvrSessionId,
  getIvrFromSnapshot,
  buildInitialIvrState,
  pushMenuStack,
  popMenuStack,
  registerActiveIvr,
  unregisterActiveIvr,
  isIvrActive,
};
