/**
 * Temporary Desk→Desk trace — logs only. No routing/DB/Telnyx behavior changes.
 *
 * Enable server: TELEPHONY_DESK_DESK_TRACE=1 (api + telephony-v3-worker)
 * Grep: [TRACE]
 */
function isDeskDeskTraceEnabled() {
  const v = process.env.TELEPHONY_DESK_DESK_TRACE;
  return v === '1' || v === 'true';
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
    connectionId: fields.connectionId ?? null,
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

module.exports = {
  isDeskDeskTraceEnabled,
  traceDeskDesk,
};
