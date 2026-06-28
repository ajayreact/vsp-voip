/**
 * Telnyx webhook event deduplication (Phase 3.2.1).
 *
 * Telnyx delivers webhooks at-least-once and may retry on timeout. Official guidance:
 * use the unique event id at `data.id` as the idempotency key, respond 2xx immediately,
 * and skip duplicate processing.
 *
 * @see https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-webhooks
 * @see https://developers.telnyx.com/development/api-fundamentals/webhooks/receiving-webhooks
 */

const { getRedisClient } = require('./redis');
const { logger } = require('./logger');

const DEFAULT_TTL_SEC = 86400;
const memoryClaims = new Map();

/** Call Control lifecycle events that must be idempotent under duplicate delivery. */
const CALL_CONTROL_LIFECYCLE_EVENTS = new Set([
  'call.initiated',
  'call.ringing',
  'call.answered',
  'call.bridged',
  'call.hangup',
  'call.dial.answered',
  'call.dial.ringing',
  'call.dial.hangup',
  'call.dial.failed',
  'call.dial.busy',
  'call.dial.no_answer',
  'call.machine.detection.ended',
  'call.machine.greeting.ended',
  'call.recording.saved',
  'call.recording.error',
  'call.speak.ended',
  'call.gather.ended',
  'call.playback.ended',
  'call.fork.started',
  'call.fork.stopped',
  'call.transcription',
]);

function getDedupTtlSec() {
  const raw = Number(process.env.TELNYX_WEBHOOK_DEDUP_TTL_SEC);
  if (Number.isFinite(raw) && raw >= 60) return Math.min(Math.round(raw), 604800);
  return DEFAULT_TTL_SEC;
}

function buildDedupKey(eventId) {
  return `telnyx:webhook:event:${eventId}`;
}

/**
 * Extract Telnyx webhook event UUID from JSON body (`data.id`).
 * Returns null when absent (legacy TeXML/form callbacks — not deduplicated here).
 */
function extractTelnyxEventId(body) {
  const id = body?.data?.id;
  if (id == null || id === '') return null;
  return String(id);
}

function shouldDedupEventType(eventType) {
  if (!eventType || typeof eventType !== 'string') return false;
  if (eventType.startsWith('call.')) return true;
  return CALL_CONTROL_LIFECYCLE_EVENTS.has(eventType);
}

function pruneMemoryClaims(ttlMs) {
  const now = Date.now();
  for (const [key, ts] of memoryClaims) {
    if (now - ts >= ttlMs) memoryClaims.delete(key);
  }
}

/**
 * Atomically claim a Telnyx webhook event for processing.
 * @returns {Promise<boolean>} true if this delivery should be processed; false if duplicate.
 */
async function claimTelnyxWebhookEvent(eventId, { eventType, source } = {}) {
  if (!eventId) return true;

  const ttlSec = getDedupTtlSec();
  const key = buildDedupKey(eventId);
  const redis = await getRedisClient().catch(() => null);

  if (redis) {
    const result = await redis.set(key, JSON.stringify({ eventType, source, at: Date.now() }), 'EX', ttlSec, 'NX');
    return result === 'OK';
  }

  const ttlMs = ttlSec * 1000;
  pruneMemoryClaims(ttlMs);
  const lastClaimed = memoryClaims.get(key);
  const now = Date.now();
  if (lastClaimed != null && now - lastClaimed < ttlMs) return false;
  memoryClaims.set(key, now);
  return true;
}

/**
 * Decide whether an inbound Telnyx JSON webhook should be processed.
 * Logs and returns duplicate=true when the event id was already claimed.
 */
async function evaluateTelnyxWebhookDedup(body, { source } = {}) {
  const eventType = body?.data?.event_type || '(unknown)';
  const eventId = extractTelnyxEventId(body);

  if (!eventId) {
    return { process: true, duplicate: false, eventId: null, eventType, reason: 'no_event_id' };
  }

  if (!shouldDedupEventType(eventType)) {
    return { process: true, duplicate: false, eventId, eventType, reason: 'event_type_exempt' };
  }

  const claimed = await claimTelnyxWebhookEvent(eventId, { eventType, source });
  if (!claimed) {
    logger.info('telnyx_webhook_duplicate_ignored', {
      eventId,
      eventType,
      source,
      attempt: body?.meta?.attempt ?? null,
      deliveredTo: body?.meta?.delivered_to ?? null,
    });
    return { process: false, duplicate: true, eventId, eventType, reason: 'duplicate_event_id' };
  }

  return { process: true, duplicate: false, eventId, eventType, reason: 'claimed' };
}

/** Test helper — clears in-process fallback store only. */
function resetTelnyxWebhookDedupMemoryForTests() {
  memoryClaims.clear();
}

module.exports = {
  CALL_CONTROL_LIFECYCLE_EVENTS,
  extractTelnyxEventId,
  shouldDedupEventType,
  claimTelnyxWebhookEvent,
  evaluateTelnyxWebhookDedup,
  resetTelnyxWebhookDedupMemoryForTests,
  getDedupTtlSec,
};
