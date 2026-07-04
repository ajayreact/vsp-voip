/** PSTN routing result contract (Phase 3.4). */

const ROUTING_FLOW = {
  PSTN_TO_DESK: 'PSTN_TO_DESK',
  PSTN_TO_MOBILE: 'PSTN_TO_MOBILE',
  PSTN_TO_RING_GROUP: 'PSTN_TO_RING_GROUP',
  PSTN_TO_IVR: 'PSTN_TO_IVR',
  PSTN_TO_VOICEMAIL: 'PSTN_TO_VOICEMAIL',
  PSTN_TO_PSTN_OUTBOUND_STUB: 'PSTN_TO_PSTN_OUTBOUND_STUB',
  UNKNOWN: 'UNKNOWN',
};

const DESTINATION_TYPE = {
  DESK_SIP: 'DESK_SIP',
  EMPLOYEE_SIP: 'EMPLOYEE_SIP',
  RING_GROUP: 'RING_GROUP',
  IVR: 'IVR',
  PSTN: 'PSTN',
  VOICEMAIL: 'VOICEMAIL',
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
 *   phoneRecord: Record<string, unknown>|null,
 *   policy: Record<string, unknown>|null,
 *   commands: import('../types').V3CommandIntent[],
 *   observeOnly: boolean,
 *   enforced: boolean,
 *   traceId?: string|null,
 *   error?: string|null,
 * }>} input
 */
function createPstnRouteResult(input) {
  return {
    sessionId: input.sessionId,
    tenantId: input.tenantId ?? null,
    routingFlow: input.routingFlow || ROUTING_FLOW.UNKNOWN,
    destinationType: input.destinationType || DESTINATION_TYPE.UNKNOWN,
    destination: input.destination ?? null,
    caller: input.caller ?? null,
    targetExtension: input.targetExtension ?? null,
    phoneRecord: input.phoneRecord ?? null,
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
  createPstnRouteResult,
};
