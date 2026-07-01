const { v3Logger } = require('../Utils/v3Logger');
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
  let zeroReason = null;

  if (policy.effectiveAction === POLICY_ACTION.DENY) {
    zeroReason = 'policy_deny';
    commands.push({
      commandType: 'REJECT',
      reason: 'desk_policy_deny',
      payload: {
        phase: 3.2,
        policyReason: policy.reason || 'denied',
        cause: 'CALL_REJECTED',
      },
    });
    logDeskCommandBuilderOutput(input, commands, zeroReason);
    return commands;
  }

  if (policy.effectiveAction === POLICY_ACTION.VOICEMAIL) {
    zeroReason = 'policy_voicemail_stub';
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
    logDeskCommandBuilderOutput(input, commands, zeroReason);
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
    logDeskCommandBuilderOutput(input, commands, 'policy_forward');
    return commands;
  }

  if (input.routingFlow === ROUTING_FLOW.RING_GROUP) {
    zeroReason = 'ring_group_stub';
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
    logDeskCommandBuilderOutput(input, commands, zeroReason);
    return commands;
  }

  if (input.routingFlow === ROUTING_FLOW.UNKNOWN) {
    zeroReason = 'unknown_routing_flow';
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
    logDeskCommandBuilderOutput(input, commands, zeroReason);
    return commands;
  }

  commands.push(...buildConnectCommands(input));
  logDeskCommandBuilderOutput(input, commands, null);
  return commands;
}

/**
 * @param {object} input
 * @param {import('../types').V3CommandIntent[]} commands
 * @param {string|null} branchReason
 */
function logDeskCommandBuilderOutput(input, commands, branchReason) {
  const dialTo = input.destination?.dialTo || input.destination?.pstnNumber || null;
  const bridgeCmd = commands.find((c) => c.commandType === 'BRIDGE');
  const bridgeTarget = bridgeCmd?.payload?.otherCallControlId
    ?? (bridgeCmd?.payload?.pendingTargetLeg ? 'pending_target_leg' : null);
  const summary = {
    routingFlow: input.routingFlow ?? null,
    policyEffectiveAction: input.policy?.effectiveAction ?? null,
    originCallControlId: input.originCallControlId ?? null,
    dialTarget: dialTo,
    bridgeTarget,
    commandCount: commands.length,
    commandTypes: commands.map((c) => c.commandType),
    zeroCommandsReason: commands.length ? null : (branchReason || 'no_commands_generated'),
    branchReason,
  };

  if (!commands.length) {
    summary.zeroCommandsReason = branchReason || 'no_commands_generated';
    console.log('[V3] deskCommandBuilder zero commands', summary);
    v3Logger.info('desk.command_builder.zero_commands', summary);
    return;
  }

  console.log('[V3] deskCommandBuilder output', summary);
  v3Logger.info('desk.command_builder.output', {
    ...summary,
    commands: commands.map((c) => ({
      commandType: c.commandType,
      reason: c.reason,
      payload: c.payload,
    })),
  });
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
    v3Logger.info('desk.command_builder.missing_dial_target', {
      routingFlow: input.routingFlow,
      originCallControlId: input.originCallControlId,
      destination: input.destination,
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
