/** Desk routing result contract (Phase 3.2). */

const ROUTING_FLOW = {
  DESK_TO_DESK: 'DESK_TO_DESK',
  DESK_TO_MOBILE: 'DESK_TO_MOBILE',
  DESK_TO_PSTN: 'DESK_TO_PSTN',
  RING_GROUP: 'RING_GROUP',
  UNKNOWN: 'UNKNOWN',
};

const DESTINATION_TYPE = {
  EXTENSION: 'EXTENSION',
  EMPLOYEE_SIP: 'EMPLOYEE_SIP',
  DESK_SIP: 'DESK_SIP',
  PSTN: 'PSTN',
  RING_GROUP: 'RING_GROUP',
  UNKNOWN: 'UNKNOWN',
};

const POLICY_ACTION = {
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  FORWARD: 'FORWARD',
  VOICEMAIL: 'VOICEMAIL',
};

/**
 * @param {Partial<{
 *   sessionId: string,
 *   tenantId: string|null,
 *   routingFlow: string,
 *   destinationType: string,
 *   destination: Record<string, unknown>|null,
 *   caller: Record<string, unknown>|null,
 *   targetExtension: Record<string, unknown>|null,
 *   policy: Record<string, unknown>|null,
 *   commands: import('../types').V3CommandIntent[],
 *   observeOnly: boolean,
 *   enforced: boolean,
 *   traceId?: string|null,
 *   error?: string|null,
 * }>} input
 */
function createDeskRouteResult(input) {
  return {
    sessionId: input.sessionId,
    tenantId: input.tenantId ?? null,
    routingFlow: input.routingFlow || ROUTING_FLOW.UNKNOWN,
    destinationType: input.destinationType || DESTINATION_TYPE.UNKNOWN,
    destination: input.destination ?? null,
    caller: input.caller ?? null,
    targetExtension: input.targetExtension ?? null,
    policy: input.policy ?? null,
    commands: input.commands || [],
    observeOnly: Boolean(input.observeOnly),
    enforced: Boolean(input.enforced),
    traceId: input.traceId ?? null,
    error: input.error ?? null,
  };
}

module.exports = {
  ROUTING_FLOW,
  DESTINATION_TYPE,
  POLICY_ACTION,
  createDeskRouteResult,
};
