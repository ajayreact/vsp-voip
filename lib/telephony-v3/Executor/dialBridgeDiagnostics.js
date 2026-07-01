const { v3Logger } = require('../Utils/v3Logger');

const DIAL_BRIDGE_TYPES = new Set(['DIAL', 'BRIDGE']);

/**
 * @param {string|null|undefined} commandType
 */
function isDialBridgeCommand(commandType) {
  return DIAL_BRIDGE_TYPES.has(String(commandType || '').toUpperCase());
}

/**
 * @param {Record<string, unknown>|null|undefined} payload
 */
function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  if (out.client_state) out.client_state = '[redacted]';
  if (out.clientState) out.clientState = '[redacted]';
  return out;
}

/**
 * @param {string} commandType
 * @param {Record<string, unknown>|null|undefined} payload
 */
function resolveDestination(commandType, payload) {
  const upper = String(commandType || '').toUpperCase();
  if (upper === 'DIAL') {
    return payload?.to || payload?.target || null;
  }
  if (upper === 'BRIDGE') {
    const other = payload?.otherCallControlId
      || payload?.other_call_control_id
      || payload?.targetCallControlId;
    if (other) return String(other);
    if (payload?.pendingTargetLeg) return 'pending_target_leg';
    return null;
  }
  return null;
}

/**
 * Structured INFO log for DIAL/BRIDGE command execution tracing.
 *
 * @param {string} phase
 * @param {Record<string, unknown>} fields
 */
function logDialBridge(phase, fields) {
  const payload = /** @type {Record<string, unknown>|undefined} */ (
    fields.requestPayload || fields.payload
  );
  const record = {
    phase,
    commandType: fields.commandType ?? null,
    destination: fields.destination ?? resolveDestination(
      String(fields.commandType || ''),
      payload,
    ),
    callControlId: fields.callControlId ?? null,
    targetLegId: fields.targetLegId ?? fields.legId ?? null,
    commandId: fields.commandId ?? null,
    sessionId: fields.sessionId ?? null,
    telnyxEndpoint: fields.telnyxEndpoint ?? null,
    requestPayload: fields.requestPayload
      ? sanitizePayload(/** @type {Record<string, unknown>} */ (fields.requestPayload))
      : (fields.payload
        ? sanitizePayload(/** @type {Record<string, unknown>} */ (fields.payload))
        : null),
    responseStatus: fields.responseStatus ?? null,
    responseBody: fields.responseBody ?? null,
    exceptionMessage: fields.exceptionMessage ?? null,
    exceptionStack: fields.exceptionStack ?? null,
    skipReason: fields.skipReason ?? null,
  };

  console.log('[V3] dial_bridge.diagnostic', record);
  v3Logger.info('dial_bridge.diagnostic', record);
}

module.exports = {
  isDialBridgeCommand,
  logDialBridge,
  sanitizePayload,
  resolveDestination,
};
