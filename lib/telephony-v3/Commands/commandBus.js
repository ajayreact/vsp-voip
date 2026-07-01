const commandOutbox = require('../Outbox/commandOutbox');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const eventBus = require('../Events/domainEventBus');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');

/**
 * Enqueue a command intent to the durable outbox (no Telnyx execution).
 * @param {import('../types').V3EnqueueCommandIntentInput} input
 */
async function enqueueIntent(input) {
  const target = input.targetCallControlId || input.legId || 'none';
  const idempotencyKey = commandOutbox.buildIdempotencyKey(
    input.sessionId,
    input.commandType,
    `${target}:${input.sequence ?? 0}`,
  );

  const row = await commandOutbox.enqueueCommand({
    sessionId: input.sessionId,
    legId: input.legId || null,
    commandType: input.commandType,
    idempotencyKey,
    payload: {
      ...input.payload,
      intentReason: input.reason || null,
      phase: 2,
    },
  });

  metrics.commandIntentEnqueued({ command_type: input.commandType });
  v3Logger.info('command.intent_enqueued', {
    commandId: row.id,
    sessionId: input.sessionId,
    commandType: input.commandType,
    reason: input.reason,
  });

  await eventBus.publish({
    eventId: `command.enqueued:${row.id}`,
    eventType: DOMAIN_EVENTS.COMMAND_ENQUEUED,
    occurredAt: new Date().toISOString(),
    sessionId: input.sessionId,
    tenantId: input.tenantId || null,
    correlationId: input.correlationId || null,
    payload: {
      commandId: row.id,
      commandType: input.commandType,
      idempotencyKey,
    },
  });

  return row;
}

/**
 * @param {import('../types').V3CommandIntent[]} intents
 * @param {import('../types').V3CommandIntentContext} ctx
 */
async function enqueueIntents(intents, ctx) {
  const rows = [];
  let sequence = ctx.sequenceStart ?? 0;
  for (const intent of intents) {
    const row = await enqueueIntent({
      sessionId: ctx.sessionId,
      legId: ctx.legId || null,
      tenantId: ctx.tenantId || null,
      correlationId: ctx.correlationId || null,
      commandType: intent.commandType,
      targetCallControlId: ctx.targetCallControlId || null,
      reason: intent.reason,
      payload: intent.payload || {},
      sequence,
    });
    rows.push(row);
    sequence += 1;
  }
  return rows;
}

/**
 * Publish domain events for commands already written to the outbox.
 * @param {Array<{ id: string, commandType: string, idempotencyKey?: string }>} rows
 * @param {{ sessionId: string, tenantId?: string|null, correlationId?: string|null }} ctx
 */
async function publishEnqueuedCommands(rows, ctx) {
  for (const row of rows) {
    metrics.commandIntentEnqueued({ command_type: row.commandType });
    v3Logger.info('command.intent_enqueued', {
      commandId: row.id,
      sessionId: ctx.sessionId,
      commandType: row.commandType,
    });
    await eventBus.publish({
      eventId: `command.enqueued:${row.id}`,
      eventType: DOMAIN_EVENTS.COMMAND_ENQUEUED,
      occurredAt: new Date().toISOString(),
      sessionId: ctx.sessionId,
      tenantId: ctx.tenantId || null,
      correlationId: ctx.correlationId || null,
      payload: {
        commandId: row.id,
        commandType: row.commandType,
        idempotencyKey: row.idempotencyKey || null,
      },
    });
  }
}

module.exports = { enqueueIntent, enqueueIntents, publishEnqueuedCommands };

require('../Routing/deskRouter').register();
require('../Sidecar/sidecarCoordinator').registerSidecarCoordinator();
