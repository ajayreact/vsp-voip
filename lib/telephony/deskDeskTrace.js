/**
 * Temporary Desk→Desk trace — logs only. No routing/DB/Telnyx behavior changes.
 *
 * Enable server (either flag):
 *   TELEPHONY_DESK_DESK_TRACE=1   — desk-desk focused trace
 *   TELEPHONY_DIAGNOSTICS=true    — full telephony diagnostics mode
 * (api + telephony-v3-worker)
 * Grep: [TRACE]
 */
function isDeskDeskTraceEnabled() {
  const v = process.env.TELEPHONY_DESK_DESK_TRACE;
  if (v === '1' || v === 'true') return true;
  const { isTelephonyDiagnosticsEnabled } = require('./telephonyDiagnostics');
  return isTelephonyDiagnosticsEnabled();
}

/**
 * @param {string} label Human-readable stage (e.g. "Webhook Received")
 * @param {Record<string, unknown>} [fields]
 */
function traceDeskDesk(label, fields = {}) {
  if (!isDeskDeskTraceEnabled()) return;
  const payload = {
    message: `[TRACE] ${label}`,
    ts: new Date().toISOString(),
    tenantId: fields.tenantId ?? null,
    extensionNumber: fields.extensionNumber ?? fields.extension ?? null,
    targetExtension: fields.targetExtension ?? fields.targetExtensionNumber ?? fields.destination ?? null,
    callControlId: fields.callControlId ?? null,
    callSessionId: fields.callSessionId ?? fields.call_session_id ?? null,
    callLegId: fields.callLegId ?? fields.call_leg_id ?? null,
    connectionId: fields.connectionId ?? null,
    direction: fields.direction ?? null,
    state: fields.state ?? null,
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

module.exports = {
  isDeskDeskTraceEnabled,
  traceDeskDesk,
};
