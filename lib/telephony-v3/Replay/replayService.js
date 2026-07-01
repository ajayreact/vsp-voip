const streams = require('../Redis/streams');
const { getPrisma } = require('../internal/prisma');
const { claimTelnyxWebhookEvent } = require('../../telnyxWebhookDedup');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { V3DuplicateError } = require('../errors');

/**
 * Re-enqueue DLQ messages back to ingress stream (idempotent processing downstream).
 * @param {number} [limit]
 */
async function replayDlqMessages(limit = 50) {
  const messages = await streams.readDlqMessages(limit);
  let replayed = 0;

  for (const msg of messages) {
    const payloadRef = msg.fields.payloadRef;
    if (!payloadRef) continue;

    await streams.enqueueIngressJob({
      ...msg.fields,
      traceId: msg.fields.traceId || `dlq-replay-${msg.id}`,
      source: 'dlq-replay',
      receivedAt: new Date().toISOString(),
      payloadRef,
      replay: 'true',
    });
    await streams.ackDlqMessage(msg.id);
    replayed += 1;
  }

  metrics.replayTotal({ scope: 'dlq' }, replayed);
  v3Logger.info('replay.dlq', { replayed, limit });
  return { ok: true, replayed };
}

/**
 * Mark webhook processed after durable enqueue (PG + Redis).
 * @param {import('../types').V3NormalizedWebhook} normalized
 * @param {{ source?: string, workerId?: string, tenantId?: string|null }} meta
 */
async function markWebhookProcessed(normalized, meta = {}) {
  if (!normalized.telnyxEventId) return;

  const prisma = await getPrisma();
  try {
    await prisma.processedTelnyxEvent.create({
      data: {
        id: normalized.telnyxEventId,
        eventType: normalized.eventType,
        callControlId: normalized.callControlId,
        callSessionId: normalized.callSessionId,
        tenantId: meta.tenantId || null,
        source: meta.source || null,
        workerId: meta.workerId || null,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new V3DuplicateError('Duplicate Telnyx event in database');
    }
    throw error;
  }

  if (normalized.telnyxEventId) {
    await claimTelnyxWebhookEvent(normalized.telnyxEventId, {
      eventType: normalized.eventType,
      source: meta.source,
    });
  }
}

/**
 * Check durable duplicate without claiming Redis first.
 * @param {string|null|undefined} eventId
 */
async function isDurableDuplicate(eventId) {
  if (!eventId) return false;
  const prisma = await getPrisma();
  const row = await prisma.processedTelnyxEvent.findUnique({ where: { id: eventId } });
  return Boolean(row);
}

/**
 * Replay processed events for a tenant (bounded batch).
 * @param {string} tenantId
 * @param {number} [limit]
 */
async function replayTenantEvents(tenantId, limit = 100) {
  const prisma = await getPrisma();
  const events = await prisma.processedTelnyxEvent.findMany({
    where: { tenantId },
    orderBy: { processedAt: 'desc' },
    take: limit,
  });

  metrics.replayTotal({ scope: 'tenant' }, events.length);
  return { ok: true, replayed: events.length, note: 'metadata_only_replay_requires_payload' };
}

/**
 * Replay session event metadata count (payload replay requires DLQ or stored payloadRef).
 * @param {string} sessionId
 */
async function replaySessionEvents(sessionId) {
  const prisma = await getPrisma();
  const session = await prisma.v3CallSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, reason: 'session_not_found' };

  const events = await prisma.processedTelnyxEvent.findMany({
    where: { callSessionId: session.telnyxCallSessionId || undefined },
    orderBy: { processedAt: 'asc' },
    take: 500,
  });

  metrics.replayTotal({ scope: 'session' }, events.length);
  return { ok: true, replayed: events.length, note: 'metadata_only_replay_requires_payload' };
}

module.exports = {
  replaySessionEvents,
  replayTenantEvents,
  replayDlqMessages,
  markWebhookProcessed,
  isDurableDuplicate,
};
