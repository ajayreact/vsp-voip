const { POLICY_ACTION } = require('./queuePolicy');
const { QUEUE_ACTION } = require('./queueConstants');

/**
 * @param {{
 *   action: string,
 *   policy: { effectiveAction: string, reason?: string, overflow?: boolean },
 *   callerCallControlId: string,
 *   agents?: Array<Record<string, unknown>>,
 *   connectionId?: string|null,
 *   overflowDestination?: string|null,
 *   queueId?: string|null,
 *   recording?: boolean,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildQueueCommands(input) {
  if (input.policy?.effectiveAction === POLICY_ACTION.DENY && !input.policy?.overflow) {
    return [{
      commandType: 'REJECT',
      reason: 'queue_policy_deny',
      payload: { phase: 3.8, policyReason: input.policy.reason || 'denied' },
    }];
  }

  switch (input.action) {
    case QUEUE_ACTION.JOIN:
    case QUEUE_ACTION.CREATE:
      return [{
        commandType: 'ENQUEUE',
        reason: 'queue_join',
        payload: {
          phase: 3.8,
          callControlId: input.callerCallControlId,
          queueId: input.queueId,
        },
      }];

    case QUEUE_ACTION.LEAVE:
    case QUEUE_ACTION.AGENT_ANSWERED:
      return [
        {
          commandType: 'DEQUEUE',
          reason: 'queue_dequeue',
          payload: {
            phase: 3.8,
            callControlId: input.callerCallControlId,
            queueId: input.queueId,
          },
        },
        ...(input.agents?.length ? [{
          commandType: 'BRIDGE',
          reason: 'queue_bridge_agent',
          payload: {
            phase: 3.8,
            callControlId: input.callerCallControlId,
            otherCallControlId: input.agents[0]?.callControlId || null,
            pendingTargetLeg: !input.agents[0]?.callControlId,
            agentExtensionId: input.agents[0]?.extensionId,
          },
        }] : []),
      ];

    case QUEUE_ACTION.ASSIGN:
    case QUEUE_ACTION.RETRY:
      return (input.agents || []).map((agent) => ({
        commandType: 'DIAL',
        reason: input.action === QUEUE_ACTION.RETRY ? 'queue_retry_dial' : 'queue_agent_dial',
        payload: {
          phase: 3.8,
          to: agent.sipUsername ? `sip:${agent.sipUsername}@sip.telnyx.com` : agent.dialTo,
          connectionId: input.connectionId || agent.connectionId || undefined,
          agentExtensionId: agent.extensionId,
          queueId: input.queueId,
          timeoutSecs: agent.timeoutSecs ?? 25,
        },
      }));

    case QUEUE_ACTION.OVERFLOW:
      if (input.overflowDestination) {
        return [
          {
            commandType: 'DEQUEUE',
            reason: 'queue_overflow_dequeue',
            payload: { phase: 3.8, callControlId: input.callerCallControlId, queueId: input.queueId },
          },
          {
            commandType: 'DIAL',
            reason: 'queue_overflow_dial',
            payload: {
              phase: 3.8,
              to: input.overflowDestination,
              connectionId: input.connectionId || undefined,
              queueId: input.queueId,
            },
          },
        ];
      }
      return [
        {
          commandType: 'DEQUEUE',
          reason: 'queue_overflow_dequeue',
          payload: { phase: 3.8, callControlId: input.callerCallControlId },
        },
        {
          commandType: 'HANGUP',
          reason: 'queue_overflow_hangup',
          payload: { phase: 3.8, callControlId: input.callerCallControlId },
        },
      ];

    case QUEUE_ACTION.CLEANUP:
      return [{
        commandType: 'DEQUEUE',
        reason: 'queue_cleanup',
        payload: { phase: 3.8, callControlId: input.callerCallControlId, queueId: input.queueId },
      }];

    case QUEUE_ACTION.START_RECORDING:
      return [{
        commandType: 'START_RECORDING',
        reason: 'queue_recording_start',
        payload: {
          phase: 3.8,
          callControlId: input.callerCallControlId,
          queueId: input.queueId,
          scope: 'queue',
        },
      }];

    case QUEUE_ACTION.STOP_RECORDING:
      return [{
        commandType: 'STOP_RECORDING',
        reason: 'queue_recording_stop',
        payload: {
          phase: 3.8,
          callControlId: input.callerCallControlId,
          queueId: input.queueId,
          scope: 'queue',
        },
      }];

    default:
      return [{
        commandType: 'REJECT',
        reason: 'queue_unknown_action',
        payload: { phase: 3.8, action: input.action },
      }];
  }
}

module.exports = {
  buildQueueCommands,
};
