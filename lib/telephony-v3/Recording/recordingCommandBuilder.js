const { POLICY_ACTION } = require('./recordingPolicy');
const { RECORDING_ACTION } = require('./recordingConstants');

/**
 * @param {{
 *   callControlId: string,
 *   policy: { effectiveAction: string, reason?: string, retentionDays?: number },
 *   legId?: string|null,
 *   action?: string,
 *   mode?: string,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildRecordingCommands(input) {
  if (input.policy?.effectiveAction === POLICY_ACTION.DENY) {
    return [{
      commandType: 'REJECT',
      reason: 'recording_policy_deny',
      payload: { phase: 3.6, policyReason: input.policy.reason || 'denied' },
    }];
  }

  if (input.action === RECORDING_ACTION.STOP) {
    return [{
      commandType: 'STOP_RECORDING',
      reason: 'recording_stop',
      payload: {
        phase: 3.6,
        callControlId: input.callControlId,
        legId: input.legId || null,
      },
    }];
  }

  return [{
    commandType: 'START_RECORDING',
    reason: input.mode === 'AUTOMATIC' ? 'recording_auto_start' : 'recording_manual_start',
    payload: {
      phase: 3.6,
      callControlId: input.callControlId,
      legId: input.legId || null,
      mode: input.mode || 'MANUAL',
      retentionDays: input.policy?.retentionDays ?? 90,
    },
  }];
}

module.exports = {
  buildRecordingCommands,
};
