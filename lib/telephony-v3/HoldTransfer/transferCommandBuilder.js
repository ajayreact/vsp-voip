const { POLICY_ACTION } = require('./transferPolicy');
const { TRANSFER_TYPE } = require('./holdTransferConstants');

/**
 * @param {{
 *   transferType: string,
 *   policy: { effectiveAction: string, reason?: string, transferTimeoutSec?: number },
 *   originCallControlId: string,
 *   target?: string|null,
 *   consultCallControlId?: string|null,
 *   connectionId?: string|null,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildTransferCommands(input) {
  if (input.policy?.effectiveAction === POLICY_ACTION.DENY) {
    return [{
      commandType: 'REJECT',
      reason: 'transfer_policy_deny',
      payload: { phase: 3.5, policyReason: input.policy.reason || 'denied' },
    }];
  }

  if (input.transferType === TRANSFER_TYPE.BLIND) {
    return [{
      commandType: 'TRANSFER',
      reason: 'transfer_blind',
      payload: {
        phase: 3.5,
        callControlId: input.originCallControlId,
        to: input.target,
        transferType: TRANSFER_TYPE.BLIND,
        timeoutSecs: input.policy?.transferTimeoutSec ?? 30,
      },
    }];
  }

  if (input.transferType === TRANSFER_TYPE.ATTENDED && input.action === 'COMPLETE') {
    const commands = [];
    if (input.consultCallControlId) {
      commands.push({
        commandType: 'BRIDGE',
        reason: 'transfer_attended_bridge',
        payload: {
          phase: 3.5,
          callControlId: input.originCallControlId,
          otherCallControlId: input.consultCallControlId,
        },
      });
    }
    commands.push({
      commandType: 'HANGUP',
      reason: 'transfer_attended_teardown_consult',
      payload: {
        phase: 3.5,
        callControlId: input.consultCallControlId || input.originCallControlId,
        note: 'Consult leg teardown after attended transfer complete',
      },
    });
    return commands;
  }

  if (input.transferType === TRANSFER_TYPE.ATTENDED && input.action === 'CANCEL') {
    return [{
      commandType: 'HANGUP',
      reason: 'transfer_attended_cancel',
      payload: {
        phase: 3.5,
        callControlId: input.consultCallControlId || input.originCallControlId,
      },
    }];
  }

  if (input.transferType === TRANSFER_TYPE.ATTENDED && input.action === 'FAIL') {
    return [
      {
        commandType: 'HANGUP',
        reason: 'transfer_attended_fail_consult',
        payload: { phase: 3.5, callControlId: input.consultCallControlId },
      },
      {
        commandType: 'UNHOLD',
        reason: 'transfer_fail_restore',
        payload: { phase: 3.5, callControlId: input.originCallControlId },
      },
    ].filter((c) => c.payload.callControlId);
  }

  // Attended transfer start: hold origin, dial consult
  return [
    {
      commandType: 'HOLD',
      reason: 'transfer_attended_hold_origin',
      payload: { phase: 3.5, callControlId: input.originCallControlId },
    },
    {
      commandType: 'DIAL',
      reason: 'transfer_attended_dial_consult',
      payload: {
        phase: 3.5,
        to: input.target,
        connectionId: input.connectionId || undefined,
        transferType: TRANSFER_TYPE.ATTENDED,
        timeoutSecs: input.policy?.transferTimeoutSec ?? 30,
      },
    },
  ];
}

module.exports = {
  buildTransferCommands,
};
