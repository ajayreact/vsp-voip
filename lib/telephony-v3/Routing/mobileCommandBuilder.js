const { POLICY_ACTION, ROUTING_FLOW } = require('./mobileRouteResult');

/**
 * Build command intents from a mobile route plan. Does not execute Telnyx APIs.
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
function buildMobileCommands(input) {
  const policy = input.policy || { effectiveAction: POLICY_ACTION.ALLOW };
  const commands = [];

  if (policy.effectiveAction === POLICY_ACTION.DENY) {
    commands.push({
      commandType: 'REJECT',
      reason: 'mobile_policy_deny',
      payload: {
        phase: 3.3,
        policyReason: policy.reason || 'denied',
        cause: 'CALL_REJECTED',
      },
    });
    return commands;
  }

  if (policy.effectiveAction === POLICY_ACTION.VOICEMAIL) {
    commands.push({
      commandType: 'SPEAK',
      reason: 'mobile_policy_voicemail_stub',
      payload: {
        phase: 3.3,
        text: 'The person you are trying to reach is unavailable.',
        stub: true,
      },
    });
    commands.push({
      commandType: 'HANGUP',
      reason: 'mobile_policy_voicemail_teardown',
      payload: { phase: 3.3, stub: true },
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
      routingFlow: ROUTING_FLOW.MOBILE_TO_PSTN,
    }));
    return commands;
  }

  if (input.routingFlow === ROUTING_FLOW.UNKNOWN) {
    commands.push({
      commandType: 'SPEAK',
      reason: 'mobile_unknown_destination',
      payload: {
        phase: 3.3,
        text: 'We could not complete your call to that destination.',
      },
    });
    commands.push({
      commandType: 'HANGUP',
      reason: 'mobile_unknown_teardown',
      payload: { phase: 3.3 },
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
    reason: 'mobile_route_answer_origin',
    payload: {
      phase: 3.3,
      callControlId: input.originCallControlId,
    },
  });

  if (!dialTo) {
    commands.push({
      commandType: 'HANGUP',
      reason: 'mobile_route_missing_dial_target',
      payload: { phase: 3.3 },
    });
    return commands;
  }

  commands.push({
    commandType: 'DIAL',
    reason: `mobile_route_dial_${String(input.routingFlow || 'target').toLowerCase()}`,
    payload: {
      phase: 3.3,
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
    reason: 'mobile_route_bridge_pending',
    payload: {
      phase: 3.3,
      otherCallControlId: null,
      pendingTargetLeg: true,
      note: 'Bridge executes when target leg callControlId is known (FSM/webhook)',
    },
  });

  return commands;
}

module.exports = {
  buildMobileCommands,
  buildConnectCommands,
};
