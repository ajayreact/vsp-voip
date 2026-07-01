const { POLICY_ACTION, ROUTING_FLOW } = require('./deskRouteResult');

/**
 * Build command intents from a desk route plan. Does not execute Telnyx APIs.
 *
 * @param {{
 *   routingFlow: string,
 *   policy: { effectiveAction: string, reason?: string, targets?: object[], callerId?: object|null },
 *   originCallControlId: string,
 *   destination: object|null,
 *   callerExtension: object|null,
 *   tenantId: string,
 *   connectionId?: string|null,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildDeskCommands(input) {
  const policy = input.policy || { effectiveAction: POLICY_ACTION.ALLOW };
  const commands = [];

  if (policy.effectiveAction === POLICY_ACTION.DENY) {
    commands.push({
      commandType: 'REJECT',
      reason: 'desk_policy_deny',
      payload: {
        phase: 3.2,
        policyReason: policy.reason || 'denied',
        cause: 'CALL_REJECTED',
      },
    });
    return commands;
  }

  if (policy.effectiveAction === POLICY_ACTION.VOICEMAIL) {
    commands.push({
      commandType: 'SPEAK',
      reason: 'desk_policy_voicemail_stub',
      payload: {
        phase: 3.2,
        text: 'The person you are trying to reach is unavailable.',
        stub: true,
      },
    });
    commands.push({
      commandType: 'HANGUP',
      reason: 'desk_policy_voicemail_teardown',
      payload: { phase: 3.2, stub: true },
    });
    return commands;
  }

  if (policy.effectiveAction === POLICY_ACTION.FORWARD && policy.targets?.length) {
    const forwardTarget = policy.targets[0];
    commands.push(...buildConnectCommands({
      ...input,
      destination: {
        dialTo: forwardTarget.phone || forwardTarget.sipUsername || forwardTarget.user?.telnyxSipUsername,
        forwardReason: policy.reason,
      },
      routingFlow: ROUTING_FLOW.DESK_TO_PSTN,
    }));
    return commands;
  }

  if (input.routingFlow === ROUTING_FLOW.RING_GROUP) {
    commands.push({
      commandType: 'SPEAK',
      reason: 'desk_ring_group_stub',
      payload: {
        phase: 3.2,
        text: 'Ring group routing is not yet available.',
        stub: true,
      },
    });
    commands.push({
      commandType: 'HANGUP',
      reason: 'desk_ring_group_teardown',
      payload: { phase: 3.2, stub: true },
    });
    return commands;
  }

  if (input.routingFlow === ROUTING_FLOW.UNKNOWN) {
    commands.push({
      commandType: 'SPEAK',
      reason: 'desk_unknown_destination',
      payload: {
        phase: 3.2,
        text: 'We could not complete your call to that destination.',
      },
    });
    commands.push({
      commandType: 'HANGUP',
      reason: 'desk_unknown_teardown',
      payload: { phase: 3.2 },
    });
    return commands;
  }

  commands.push(...buildConnectCommands(input));
  return commands;
}

/**
 * @param {object} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildConnectCommands(input) {
  const commands = [];
  const dialTo = input.destination?.dialTo || input.destination?.pstnNumber;
  const callerId = input.policy?.callerId;

  commands.push({
    commandType: 'ANSWER',
    reason: 'desk_route_answer_origin',
    payload: {
      phase: 3.2,
      callControlId: input.originCallControlId,
    },
  });

  if (!dialTo) {
    commands.push({
      commandType: 'HANGUP',
      reason: 'desk_route_missing_dial_target',
      payload: { phase: 3.2 },
    });
    return commands;
  }

  commands.push({
    commandType: 'DIAL',
    reason: `desk_route_dial_${String(input.routingFlow || 'target').toLowerCase()}`,
    payload: {
      phase: 3.2,
      to: dialTo,
      from: callerId?.outboundNumber || input.callerExtension?.primaryPhoneNumber || undefined,
      fromDisplayName: callerId?.displayName || input.callerExtension?.displayName || undefined,
      connectionId: input.connectionId || undefined,
      routingFlow: input.routingFlow,
      hideCallerId: callerId?.hideCallerId || false,
    },
  });

  commands.push({
    commandType: 'BRIDGE',
    reason: 'desk_route_bridge_pending',
    payload: {
      phase: 3.2,
      otherCallControlId: null,
      pendingTargetLeg: true,
      note: 'Bridge executes when target leg callControlId is known (FSM/webhook)',
    },
  });

  return commands;
}

module.exports = {
  buildDeskCommands,
  buildConnectCommands,
};
