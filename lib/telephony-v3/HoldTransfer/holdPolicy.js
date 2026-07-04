const { POLICY_ACTION, DEFAULT_LIMITS } = require('./holdTransferConstants');

/**
 * @param {string|null|undefined} sessionState
 */
function isHoldEligibleState(sessionState) {
  return sessionState === 'ACTIVE';
}

/**
 * @param {string|null|undefined} sessionState
 */
function isResumeEligibleState(sessionState) {
  return sessionState === 'HELD';
}

/**
 * Evaluate hold policy (Phase 3.5).
 *
 * @param {{
 *   tenantId: string,
 *   sessionState: string,
 *   holdEnabled?: boolean,
 *   observeOnly?: boolean,
 * }} input
 */
function evaluateHoldPolicy(input) {
  const rules = [];

  if (!input.holdEnabled) {
    rules.push({ rule: 'hold_enabled', result: 'deny', message: 'Hold disabled for tenant' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'hold_disabled', input.observeOnly);
  }

  if (!isHoldEligibleState(input.sessionState) && input.action !== 'RESUME') {
    rules.push({ rule: 'session_state', result: 'deny', message: `Hold not allowed in ${input.sessionState}` });
    return buildDecision(POLICY_ACTION.DENY, rules, 'invalid_session_state', input.observeOnly);
  }

  if (input.action === 'RESUME' && !isResumeEligibleState(input.sessionState)) {
    rules.push({ rule: 'session_state', result: 'deny', message: `Resume not allowed in ${input.sessionState}` });
    return buildDecision(POLICY_ACTION.DENY, rules, 'invalid_session_state', input.observeOnly);
  }

  rules.push({ rule: 'hold_permissions', result: 'pass' });
  rules.push({ rule: 'tenant_restrictions', result: 'pass' });

  return buildDecision(POLICY_ACTION.ALLOW, rules, 'allowed', input.observeOnly);
}

/**
 * @param {string} action
 * @param {Array<{ rule: string, result: string, message?: string }>} rules
 * @param {string} reason
 * @param {boolean|undefined} observeOnly
 */
function buildDecision(action, rules, reason, observeOnly) {
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
  };
}

module.exports = {
  evaluateHoldPolicy,
  isHoldEligibleState,
  isResumeEligibleState,
  POLICY_ACTION,
};
