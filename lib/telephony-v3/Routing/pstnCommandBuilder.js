const { POLICY_ACTION, ROUTING_FLOW } = require('./pstnRouteResult');

/**
 * Build command intents from a PSTN route plan. Does not execute Telnyx APIs.
 *
 * @param {{
 *   routingFlow: string,
 *   policy: { effectiveAction: string, reason?: string, targets?: object[] },
 *   originCallControlId: string,
 *   destination: object|null,
 *   tenantId: string,
 *   connectionId?: string|null,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildPstnCommands(input) {
  const policy = input.policy || { effectiveAction: POLICY_ACTION.ALLOW };
  const commands = [];

  if (policy.effectiveAction === POLICY_ACTION.DENY) {
    commands.push({
      commandType: 'REJECT',
      reason: 'pstn_policy_deny',
      payload: {
        phase: 3.4,
        policyReason: policy.reason || 'denied',
        cause: 'CALL_REJECTED',
      },
    });
    return commands;
  }

  if (policy.effectiveAction === POLICY_ACTION.VOICEMAIL) {
    commands.push({
      commandType: 'SPEAK',
      reason: 'pstn_policy_voicemail_stub',
      payload: {
        phase: 3.4,
        text: 'The person you are trying to reach is unavailable. Please leave a message after the tone.',
        stub: true,
      },
    });
    commands.push({
      commandType: 'HANGUP',
      reason: 'pstn_policy_voicemail_teardown',
      payload: { phase: 3.4, stub: true },
    });
    return commands;
  }

  if (policy.effectiveAction === POLICY_ACTION.FORWARD && policy.targets?.length) {
    const forwardTarget = policy.targets[0];
    const dialTo = forwardTarget.phone
      || forwardTarget.sipUsername
      || forwardTarget.user?.telnyxSipUsername;

    commands.push({
      commandType: 'ANSWER',
      reason: 'pstn_route_answer_origin',
      payload: {
        phase: 3.4,
        callControlId: input.originCallControlId,
      },
    });

    commands.push({
      commandType: 'FORWARD',
      reason: 'pstn_policy_forward',
      payload: {
        phase: 3.4,
        to: dialTo,
        target: forwardTarget,
        connectionId: input.connectionId || undefined,
        forwardReason: policy.reason,
      },
    });

    commands.push({
      commandType: 'BRIDGE',
      reason: 'pstn_forward_bridge_pending',
      payload: {
        phase: 3.4,
        otherCallControlId: null,
        pendingTargetLeg: true,
        note: 'Bridge executes when forward target leg is known',
      },
    });
    return commands;
  }

  if (input.routingFlow === ROUTING_FLOW.PSTN_TO_IVR) {
    return [];
  }

  if (input.routingFlow === ROUTING_FLOW.UNKNOWN) {
    commands.push({
      commandType: 'SPEAK',
      reason: 'pstn_unknown_did',
      payload: {
        phase: 3.4,
        text: 'Welcome. This number is not configured.',
      },
    });
    commands.push({
      commandType: 'HANGUP',
      reason: 'pstn_unknown_did_teardown',
      payload: { phase: 3.4 },
    });
    return commands;
  }

  if (input.routingFlow === ROUTING_FLOW.PSTN_TO_PSTN_OUTBOUND_STUB) {
    commands.push({
      commandType: 'SPEAK',
      reason: 'pstn_outbound_stub',
      payload: {
        phase: 3.4,
        text: 'Outbound PSTN routing is not yet available.',
        stub: true,
      },
    });
    commands.push({
      commandType: 'HANGUP',
      reason: 'pstn_outbound_stub_teardown',
      payload: { phase: 3.4, stub: true },
    });
    return commands;
  }

  if (input.routingFlow === ROUTING_FLOW.PSTN_TO_RING_GROUP) {
    commands.push(...buildRingGroupCommands(input));
    return commands;
  }

  commands.push(...buildConnectCommands(input));
  return commands;
}

/**
 * @param {object} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildRingGroupCommands(input) {
  const commands = [];
  const dialTargets = input.destination?.dialTargets
    || (input.destination?.targets || []).map((t) => t.phone || t.sipUsername || t.user?.telnyxSipUsername)
      .filter(Boolean);

  commands.push({
    commandType: 'ANSWER',
    reason: 'pstn_route_answer_origin',
    payload: {
      phase: 3.4,
      callControlId: input.originCallControlId,
    },
  });

  if (!dialTargets?.length) {
    commands.push({
      commandType: 'HANGUP',
      reason: 'pstn_ring_group_empty',
      payload: { phase: 3.4 },
    });
    return commands;
  }

  for (let i = 0; i < dialTargets.length; i += 1) {
    const dialTo = typeof dialTargets[i] === 'string'
      ? dialTargets[i]
      : (dialTargets[i]?.phone || dialTargets[i]);
    commands.push({
      commandType: 'DIAL',
      reason: `pstn_ring_group_dial_member_${i + 1}`,
      payload: {
        phase: 3.4,
        to: dialTo,
        connectionId: input.connectionId || undefined,
        routingFlow: ROUTING_FLOW.PSTN_TO_RING_GROUP,
        ringGroupId: input.destination?.ringGroupId,
        memberIndex: i,
        sequential: true,
        simultaneous: false,
      },
    });
  }

  commands.push({
    commandType: 'BRIDGE',
    reason: 'pstn_ring_group_bridge_pending',
    payload: {
      phase: 3.4,
      otherCallControlId: null,
      pendingTargetLeg: true,
      ringGroupId: input.destination?.ringGroupId,
      sequential: true,
      note: 'Sequential ring group — bridge when target leg is known',
    },
  });

  return commands;
}

/**
 * @param {object} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildConnectCommands(input) {
  const commands = [];
  const dialTo = input.destination?.dialTo || input.destination?.pstnNumber;

  commands.push({
    commandType: 'ANSWER',
    reason: 'pstn_route_answer_origin',
    payload: {
      phase: 3.4,
      callControlId: input.originCallControlId,
    },
  });

  if (!dialTo) {
    commands.push({
      commandType: 'HANGUP',
      reason: 'pstn_route_missing_dial_target',
      payload: { phase: 3.4 },
    });
    return commands;
  }

  commands.push({
    commandType: 'DIAL',
    reason: `pstn_route_dial_${String(input.routingFlow || 'target').toLowerCase()}`,
    payload: {
      phase: 3.4,
      to: dialTo,
      connectionId: input.connectionId || undefined,
      routingFlow: input.routingFlow,
    },
  });

  commands.push({
    commandType: 'BRIDGE',
    reason: 'pstn_route_bridge_pending',
    payload: {
      phase: 3.4,
      otherCallControlId: null,
      pendingTargetLeg: true,
      note: 'Bridge executes when target leg callControlId is known (FSM/webhook)',
    },
  });

  return commands;
}

module.exports = {
  buildPstnCommands,
  buildConnectCommands,
  buildRingGroupCommands,
};
