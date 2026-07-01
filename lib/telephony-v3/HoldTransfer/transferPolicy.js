const { getPrisma } = require('../internal/prisma');
const { POLICY_ACTION, DEFAULT_LIMITS, TRANSFER_TYPE } = require('./holdTransferConstants');

/** @type {Map<string, { count: number, startedAt: number }>} */
const transferAttemptsBySession = new Map();

function resetTransferPolicyForTests() {
  transferAttemptsBySession.clear();
}

/**
 * @param {string|null|undefined} sessionState
 * @param {string} transferType
 */
function isTransferEligibleState(sessionState, transferType) {
  if (transferType === TRANSFER_TYPE.BLIND) {
    return sessionState === 'ACTIVE' || sessionState === 'HELD';
  }
  return sessionState === 'ACTIVE' || sessionState === 'TRANSFER_PENDING';
}

/**
 * Evaluate transfer policy (Phase 3.5).
 *
 * @param {{
 *   tenantId: string,
 *   sessionId: string,
 *   sessionState: string,
 *   transferType: string,
 *   transferEnabled?: boolean,
 *   observeOnly?: boolean,
 *   transferTimeoutSec?: number,
 *   maxTransferAttempts?: number,
 *   target?: string|null,
 * }} input
 */
async function evaluateTransferPolicy(input) {
  const prisma = await getPrisma();
  const rules = [];
  const limits = {
    transferTimeoutSec: input.transferTimeoutSec ?? DEFAULT_LIMITS.transferTimeoutSec,
    maxTransferAttempts: input.maxTransferAttempts ?? DEFAULT_LIMITS.maxTransferAttempts,
  };

  if (!input.transferEnabled) {
    rules.push({ rule: 'transfer_enabled', result: 'deny', message: 'Transfer disabled for tenant' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'transfer_disabled', input.observeOnly, limits);
  }

  if (!input.target && input.transferType === TRANSFER_TYPE.BLIND) {
    rules.push({ rule: 'transfer_target', result: 'deny', message: 'Missing transfer target' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'missing_target', input.observeOnly, limits);
  }

  if (!isTransferEligibleState(input.sessionState, input.transferType)) {
    rules.push({ rule: 'session_state', result: 'deny', message: `Transfer not allowed in ${input.sessionState}` });
    return buildDecision(POLICY_ACTION.DENY, rules, 'invalid_session_state', input.observeOnly, limits);
  }

  const attempt = transferAttemptsBySession.get(input.sessionId) || { count: 0, startedAt: Date.now() };
  if (attempt.count >= limits.maxTransferAttempts) {
    rules.push({ rule: 'max_transfer_attempts', result: 'deny', message: 'Maximum transfer attempts exceeded' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'max_attempts', input.observeOnly, limits);
  }

  if (input.tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) {
      rules.push({ rule: 'tenant', result: 'deny', message: 'Tenant not found' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'tenant_not_found', input.observeOnly, limits);
    }
    rules.push({ rule: 'tenant_restrictions', result: 'pass', message: tenant.id });
  }

  rules.push({ rule: 'transfer_permissions', result: 'pass' });
  rules.push({ rule: 'transfer_timeout', result: 'pass', message: String(limits.transferTimeoutSec) });

  return buildDecision(POLICY_ACTION.ALLOW, rules, 'allowed', input.observeOnly, {
    ...limits,
    attemptCount: attempt.count,
  });
}

/**
 * @param {string} sessionId
 */
function recordTransferAttempt(sessionId) {
  const prev = transferAttemptsBySession.get(sessionId) || { count: 0, startedAt: Date.now() };
  transferAttemptsBySession.set(sessionId, { count: prev.count + 1, startedAt: prev.startedAt });
}

/**
 * @param {string} sessionId
 */
function clearTransferAttempts(sessionId) {
  transferAttemptsBySession.delete(sessionId);
}

/**
 * @param {string} sessionId
 * @param {number} timeoutSec
 */
function isTransferTimedOut(sessionId, timeoutSec = DEFAULT_LIMITS.transferTimeoutSec) {
  const attempt = transferAttemptsBySession.get(sessionId);
  if (!attempt) return false;
  return Date.now() - attempt.startedAt >= timeoutSec * 1000;
}

function buildDecision(action, rules, reason, observeOnly, extra = {}) {
  const enforced = !observeOnly;
  const effectiveAction = observeOnly && action === POLICY_ACTION.DENY
    ? POLICY_ACTION.ALLOW
    : action;

  return {
    action,
    effectiveAction,
    enforced,
    observeOnly: Boolean(observeOnly),
    allowed: effectiveAction === POLICY_ACTION.ALLOW,
    reason,
    rules,
    ...extra,
  };
}

module.exports = {
  evaluateTransferPolicy,
  isTransferEligibleState,
  recordTransferAttempt,
  clearTransferAttempts,
  isTransferTimedOut,
  resetTransferPolicyForTests,
  POLICY_ACTION,
};
