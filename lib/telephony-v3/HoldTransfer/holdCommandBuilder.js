const { POLICY_ACTION } = require('./holdPolicy');

/**
 * @param {{
 *   callControlId: string,
 *   policy: { effectiveAction: string, reason?: string },
 *   legId?: string|null,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildHoldCommands(input) {
  if (input.policy?.effectiveAction === POLICY_ACTION.DENY) {
    return [{
      commandType: 'REJECT',
      reason: 'hold_policy_deny',
      payload: { phase: 3.5, policyReason: input.policy.reason || 'denied' },
    }];
  }

  return [{
    commandType: 'HOLD',
    reason: 'hold_start',
    payload: {
      phase: 3.5,
      callControlId: input.callControlId,
      legId: input.legId || null,
    },
  }];
}

/**
 * @param {{
 *   callControlId: string,
 *   policy: { effectiveAction: string, reason?: string },
 *   legId?: string|null,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildResumeCommands(input) {
  if (input.policy?.effectiveAction === POLICY_ACTION.DENY) {
    return [{
      commandType: 'REJECT',
      reason: 'hold_resume_policy_deny',
      payload: { phase: 3.5, policyReason: input.policy.reason || 'denied' },
    }];
  }

  return [{
    commandType: 'UNHOLD',
    reason: 'hold_resume',
    payload: {
      phase: 3.5,
      callControlId: input.callControlId,
      legId: input.legId || null,
    },
  }];
}

module.exports = {
  buildHoldCommands,
  buildResumeCommands,
};
