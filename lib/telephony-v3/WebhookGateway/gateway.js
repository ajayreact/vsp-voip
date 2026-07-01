const crypto = require('crypto');
const { normalizeTelnyxWebhook, validateWebhookPayload } = require('./normalize');
const streams = require('../Redis/streams');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { withSpan, newTraceId } = require('../Utils/tracing');
const { V3DuplicateError } = require('../errors');
const { GLOBAL_FLAGS } = require('../constants');
const { isDurableDuplicate, markWebhookProcessed } = require('../Replay/replayService');
const { extractTelnyxEventId } = require('../../telnyxWebhookDedup');

function isIngressEnabled() {
  return process.env[GLOBAL_FLAGS.TELEPHONY_V3_INGRESS_ENABLED] === 'true';
}

/**
 * Webhook Gateway — verify (middleware), durable enqueue, then mark processed.
 * Phase 3.9.5: never mark duplicate before stream enqueue.
 *
 * @param {Record<string, unknown>} body
 * @param {{ source?: string }} meta
 */
async function handleV3WebhookIngress(body, meta = {}) {
  if (!isIngressEnabled()) {
    return { accepted: false, reason: 'ingress_disabled' };
  }

  const traceId = newTraceId();

  return withSpan('telephony.webhook.receive', { source: meta.source || 'unknown', traceId }, async () => {
    const validation = validateWebhookPayload(body);
    if (!validation.valid) {
      v3Logger.warn('ingress.invalid_payload', { reason: validation.reason, traceId });
      return { accepted: false, reason: validation.reason, traceId };
    }

    const normalized = normalizeTelnyxWebhook(body, meta);
    const eventId = normalized.telnyxEventId || extractTelnyxEventId(body);
    const eventType = normalized.eventType || body?.data?.event_type || '(unknown)';

    metrics.ingressReceived({ event_type: eventType, source: meta.source || 'unknown' });

    if (eventId && await isDurableDuplicate(eventId)) {
      metrics.ingressDuplicate({ event_type: eventType });
      v3Logger.info('ingress.duplicate', { eventId, traceId, layer: 'durable' });
      return { accepted: true, duplicate: true, correlationId: normalized.correlationId, traceId };
    }

    const payloadRef = streams.newIngressPayloadRef(body);
    await streams.storeIngressPayload(payloadRef, body);

    let ingressId;
    try {
      ingressId = await streams.enqueueIngressJob({
        telnyxEventId: eventId || '',
        eventType,
        callControlId: normalized.callControlId || '',
        callSessionId: normalized.callSessionId || '',
        correlationId: normalized.correlationId,
        traceId,
        source: meta.source || '',
        receivedAt: new Date().toISOString(),
        payloadRef,
      });
    } catch (enqueueError) {
      v3Logger.error('ingress.enqueue_failed', {
        eventId,
        error: enqueueError.message,
        traceId,
      });
      throw enqueueError;
    }

    try {
      await markWebhookProcessed(normalized, {
        source: meta.source,
        tenantId: null,
      });
    } catch (error) {
      if (error instanceof V3DuplicateError) {
        metrics.ingressDuplicate({ event_type: eventType });
        return { accepted: true, duplicate: true, correlationId: normalized.correlationId, traceId };
      }
      v3Logger.warn('ingress.mark_processed_failed', {
        eventId,
        ingressId,
        error: error.message,
        traceId,
      });
    }

    v3Logger.info('ingress.accepted', {
      ingressId,
      eventType,
      callControlId: normalized.callControlId,
      correlationId: normalized.correlationId,
      traceId,
    });

    return {
      accepted: true,
      duplicate: false,
      ingressId,
      correlationId: normalized.correlationId,
      traceId,
    };
  });
}

/** @deprecated use replayService.markWebhookProcessed */
async function persistProcessedEvent(normalized, meta = {}) {
  return markWebhookProcessed(normalized, meta);
}

module.exports = { handleV3WebhookIngress, isIngressEnabled, persistProcessedEvent };
