/**
 * Outbound runtime trace — structured logs only. Zero routing/behavior change.
 *
 * Enable on API container:
 *   TELEPHONY_OUTBOUND_RUNTIME_TRACE=1
 *   or TELEPHONY_DIAGNOSTICS=true
 *
 * Grep: outbound.runtime.trace
 */
const { isTelephonyDiagnosticsEnabled } = require('./telephonyDiagnostics');

function isOutboundRuntimeTraceEnabled() {
  const v = process.env.TELEPHONY_OUTBOUND_RUNTIME_TRACE;
  if (v === '1' || v === 'true') return true;
  return isTelephonyDiagnosticsEnabled();
}

/**
 * @param {string} step Canonical pipeline step name
 * @param {Record<string, unknown>} [fields]
 */
function traceOutbound(step, fields = {}) {
  if (!isOutboundRuntimeTraceEnabled()) return;
  console.log(JSON.stringify({
    event: 'outbound.runtime.trace',
    ts: new Date().toISOString(),
    step,
    flow: fields.flow ?? null,
    callControlId: fields.callControlId ?? fields.call_control_id ?? null,
    callSessionId: fields.callSessionId ?? fields.call_session_id ?? null,
    ...fields,
  }));
}

function traceOutboundIfInternalSession(session, step, fields = {}) {
  if (session?.callKind !== 'internal') return;
  traceOutbound(step, {
    flow: 'desk_to_desk',
    callControlId: session.callControlId ?? null,
    callSessionId: session.callSessionId ?? null,
    targetExtensionNumber: session.targetExtensionNumber ?? null,
    tenantId: session.tenantId ?? null,
    ...fields,
  });
}

function snapshotCaller(caller) {
  if (!caller) {
    return {
      callerResolved: false,
      callerTenantId: null,
      callerUserId: null,
      callerExtensionId: null,
      callerExtensionNumber: null,
      callerSipUsername: null,
      callerResolvedVia: null,
    };
  }
  return {
    callerResolved: Boolean(caller.tenantId),
    callerTenantId: caller.tenantId ?? null,
    callerUserId: caller.user?.id ?? null,
    callerExtensionId: caller.callerExtension?.id ?? null,
    callerExtensionNumber: caller.callerExtension?.extensionNumber ?? null,
    callerSipUsername: caller.sipUsername ?? caller.user?.telnyxSipUsername ?? null,
    callerResolvedVia: caller.resolvedVia ?? null,
  };
}

function snapshotOutboundGate(gate, payload, platform) {
  const { getV3CallControlApplicationId } = require('../telnyxCallControlSetup');
  return {
    outboundGateOk: gate?.ok ?? null,
    outboundGateReason: gate?.reason ?? null,
    outboundGateAcceptedAs: gate?.acceptedAs ?? null,
    connection_id: payload?.connection_id ?? null,
    expectedCredentialConnectionId: gate?.expectedCredentialConnectionId ?? null,
    expectedCallControlApplicationId: gate?.expectedCallControlApplicationId ?? null,
    expectedV3CallControlApplicationId: getV3CallControlApplicationId() || null,
    direction: payload?.direction ?? null,
    state: payload?.state ?? null,
    platformSource: platform?.source ?? null,
  };
}

module.exports = {
  isOutboundRuntimeTraceEnabled,
  traceOutbound,
  traceOutboundIfInternalSession,
  snapshotCaller,
  snapshotOutboundGate,
};
