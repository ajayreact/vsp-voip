const crypto = require('crypto');
const { ENGINE_VERSION } = require('../constants');

/**
 * Normalize Telnyx JSON webhook to minimal ingress fields.
 * @param {Record<string, unknown>} body
 * @param {{ source?: string }} [meta]
 * @returns {import('../types').V3NormalizedWebhook}
 */
function normalizeTelnyxWebhook(body, meta = {}) {
  const data = body?.data || {};
  const payload = data?.payload || {};
  const telnyxEventId = data?.id != null && data.id !== '' ? String(data.id) : null;
  const eventType = String(data?.event_type || 'unknown');
  const callControlId = payload?.call_control_id ? String(payload.call_control_id) : null;
  const callSessionId = payload?.call_session_id ? String(payload.call_session_id) : null;
  const correlationId = callSessionId || callControlId || telnyxEventId || crypto.randomUUID();

  return {
    telnyxEventId,
    eventType,
    callControlId,
    callSessionId,
    direction: payload?.direction ? String(payload.direction) : null,
    state: payload?.state ? String(payload.state) : null,
    from: payload?.from ? String(payload.from) : null,
    to: payload?.to ? String(payload.to) : null,
    connectionId: payload?.connection_id ? String(payload.connection_id) : null,
    correlationId,
    raw: {
      body,
      source: meta.source || null,
    },
  };
}

/**
 * Validate minimum payload shape for enqueue.
 * @param {Record<string, unknown>} body
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateWebhookPayload(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, reason: 'invalid_body' };
  }
  if (!body.data || typeof body.data !== 'object') {
    return { valid: false, reason: 'missing_data' };
  }
  return { valid: true };
}

module.exports = { normalizeTelnyxWebhook, validateWebhookPayload, ENGINE_VERSION };
