const { isDeskCallRouterV2Enabled } = require('./constants');
const {
  isDeskOriginatedParkedOutbound,
  isCallControlApplicationOutbound,
  describeCredentialConnectionOutboundGate,
} = require('./PayloadNormalizer');

function deskOriginatedPayloadSnapshot(payload) {
  return {
    direction: payload?.direction ?? null,
    state: payload?.state ?? null,
    from: payload?.from ?? null,
    to: payload?.to ?? null,
    connection_id: payload?.connection_id ?? null,
    call_control_id: payload?.call_control_id ?? null,
    call_session_id: payload?.call_session_id ?? null,
    client_state: payload?.client_state ?? null,
  };
}

/**
 * Structured timeline for true desk-originated parked outbound only.
 * Grep: desk.outbound.originated.trace
 */
function logDeskOriginatedTrace(phase, payload, fields = {}) {
  if (!isDeskOriginatedParkedOutbound(payload)) return;
  console.log(JSON.stringify({
    event: 'desk.outbound.originated.trace',
    ts: new Date().toISOString(),
    phase,
    ...deskOriginatedPayloadSnapshot(payload),
    ...fields,
  }));
}

function logDeskOriginatedWebhookIngress(payload, webhookSource) {
  if (!isDeskOriginatedParkedOutbound(payload)) return;
  logDeskOriginatedTrace('webhook_received', payload, {
    webhookSource,
    note: 'Desk-originated parked outbound — not an inbound B-leg',
  });
}

function explainRouteDeskOutboundPrecheck(payload, platform) {
  const v2Enabled = isDeskCallRouterV2Enabled();
  const ccAppOutbound = isCallControlApplicationOutbound(payload, platform);
  if (!v2Enabled && !ccAppOutbound) {
    return 'desk_router_v2_disabled_and_not_call_control_app_outbound';
  }
  if (!v2Enabled) {
    return 'desk_router_v2_disabled';
  }
  if (!ccAppOutbound) {
    return 'not_call_control_application_outbound';
  }
  return null;
}

function logDeskOriginatedRouteDeskOutboundDecision(payload, platform, fields = {}) {
  if (!isDeskOriginatedParkedOutbound(payload)) return;
  const skipReason = explainRouteDeskOutboundPrecheck(payload, platform);
  logDeskOriginatedTrace(
    skipReason ? 'routeDeskOutbound_skipped' : 'routeDeskOutbound_called',
    payload,
    {
    routeDeskOutboundCalled: !skipReason,
    routeDeskOutboundSkipReason: skipReason,
    outboundGateOk: fields.outboundGateOk ?? null,
    outboundGateReason: fields.outboundGateReason ?? null,
    extensionNumber: fields.extensionNumber ?? null,
    callerResolved: fields.callerResolved ?? null,
    ...fields,
  });
}

function logDeskOriginatedOutboundGate(payload, platform) {
  if (!isDeskOriginatedParkedOutbound(payload)) return null;
  const gate = describeCredentialConnectionOutboundGate(payload, platform);
  logDeskOriginatedTrace('outbound_gate', payload, {
    outboundGateOk: gate.ok,
    outboundGateReason: gate.reason,
    outboundGateAcceptedAs: gate.acceptedAs ?? null,
    expectedCredentialConnectionId: gate.expectedCredentialConnectionId ?? null,
    expectedCallControlApplicationId: gate.expectedCallControlApplicationId ?? null,
  });
  return gate;
}

module.exports = {
  deskOriginatedPayloadSnapshot,
  logDeskOriginatedTrace,
  logDeskOriginatedWebhookIngress,
  explainRouteDeskOutboundPrecheck,
  logDeskOriginatedRouteDeskOutboundDecision,
  logDeskOriginatedOutboundGate,
  isDeskOriginatedParkedOutbound,
};
