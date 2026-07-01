const crypto = require('crypto');
const { getPrisma } = require('../internal/prisma');
const commandOutbox = require('../Outbox/commandOutbox');
const { executeCommand, logDialBridgeDiagnostic } = require('./telnyxAdapter');
const { classifyFailure } = require('./failureClassifier');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const domainEventBus = require('../Events/domainEventBus');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { OUTBOX, EXECUTOR } = require('../constants');
const locks = require('../Redis/locks');

/**
 * @param {string} commandType
 */
function isDialBridgeCommand(commandType) {
  const upper = String(commandType || '').toUpperCase();
  return upper === 'DIAL' || upper === 'BRIDGE';
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {Record<string, unknown>} context
 */
function resolveDialBridgeDestination(row) {
  const payload = /** @type {Record<string, unknown>} */ (row.payload || {});
  const upper = String(row.commandType || '').toUpperCase();
  if (upper === 'DIAL') {
    return payload.to || payload.target || null;
  }
  if (upper === 'BRIDGE') {
    return payload.otherCallControlId
      || payload.other_call_control_id
      || payload.targetCallControlId
      || (payload.pendingTargetLeg ? 'pending_target_leg' : null);
  }
  return null;
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {Record<string, unknown>} context
 * @param {string} event
 * @param {Record<string, unknown>} [extra]
 */
function logDialBridgeExecutor(row, context, event, extra = {}) {
  if (!isDialBridgeCommand(row.commandType)) return;
  logDialBridgeDiagnostic(event, {
    commandType: row.commandType,
    destination: resolveDialBridgeDestination(row),
    callControlId: context.callControlId ?? null,
    targetLegId: row.legId ?? context.legId ?? null,
    commandId: row.id,
    ...extra,
  });
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 */
async function resolveCommandContext(row) {
  const payload = /** @type {Record<string, unknown>} */ (row.payload || {});
  let callControlId = payload.callControlId
    || payload.targetCallControlId
    || null;
  let tenantId = payload.tenantId || null;
  let correlationId = payload.correlationId || null;

  const prisma = await getPrisma();

  if (row.legId) {
    const leg = await prisma.v3CallLeg.findUnique({ where: { id: row.legId } });
    if (leg) {
      callControlId = callControlId || leg.callControlId;
    }
  }

  const session = await prisma.v3CallSession.findUnique({ where: { id: row.sessionId } });
  if (session) {
    callControlId = callControlId || session.primaryCallControlId;
    tenantId = tenantId || session.tenantId;
    correlationId = correlationId || session.correlationId;
  }

  return {
    sessionId: row.sessionId,
    legId: row.legId,
    tenantId,
    correlationId,
    callControlId,
    traceId: payload.traceId || payload.sourceEventId || row.id,
  };
}

/**
 * @param {import('../types').V3DomainEvent} event
 */
async function publishDomainEvent(event) {
  await domainEventBus.publish(event);
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {Record<string, unknown>} context
 * @param {Record<string, unknown>} execution
 */
async function emitCommandStarted(row, context, execution) {
  await publishDomainEvent({
    eventId: crypto.randomUUID(),
    eventType: DOMAIN_EVENTS.COMMAND_STARTED,
    occurredAt: new Date().toISOString(),
    sessionId: row.sessionId,
    tenantId: context.tenantId,
    correlationId: context.correlationId,
    callControlId: context.callControlId,
    payload: {
      commandId: row.id,
      commandType: row.commandType,
      legId: row.legId,
      traceId: context.traceId,
      workerId: execution.workerId,
      retryCount: row.attempts,
      execution,
    },
  });
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {Record<string, unknown>} context
 * @param {Record<string, unknown>} execution
 * @param {Record<string, unknown>} result
 */
async function emitCommandCompleted(row, context, execution, result) {
  await publishDomainEvent({
    eventId: crypto.randomUUID(),
    eventType: DOMAIN_EVENTS.COMMAND_COMPLETED,
    occurredAt: new Date().toISOString(),
    sessionId: row.sessionId,
    tenantId: context.tenantId,
    correlationId: context.correlationId,
    callControlId: context.callControlId,
    payload: {
      commandId: row.id,
      commandType: row.commandType,
      legId: row.legId,
      traceId: context.traceId,
      workerId: execution.workerId,
      retryCount: row.attempts,
      execution,
      result,
    },
  });
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {Record<string, unknown>} context
 * @param {Record<string, unknown>} execution
 * @param {{ errorMessage: string, failureClass: string }} failure
 */
async function emitCommandFailed(row, context, execution, failure) {
  await publishDomainEvent({
    eventId: crypto.randomUUID(),
    eventType: DOMAIN_EVENTS.COMMAND_FAILED,
    occurredAt: new Date().toISOString(),
    sessionId: row.sessionId,
    tenantId: context.tenantId,
    correlationId: context.correlationId,
    callControlId: context.callControlId,
    payload: {
      commandId: row.id,
      commandType: row.commandType,
      legId: row.legId,
      traceId: context.traceId,
      workerId: execution.workerId,
      retryCount: row.attempts,
      execution,
      failure,
    },
  });
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {string} workerId
 * @param {{ telnyx?: import('./telnyxAdapter') }} [options]
 */
async function executeOneCommand(row, workerId, options = {}) {
  return locks.withSessionLock(
    row.sessionId,
    () => executeOneCommandLocked(row, workerId, options),
    { retries: 2 },
  );
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {string} workerId
 * @param {{ telnyx?: import('./telnyxAdapter') }} [options]
 */
async function executeOneCommandLocked(row, workerId, options = {}) {
  const startedMs = Date.now();
  const context = await resolveCommandContext(row);

  const execution = {
    startedAt: new Date().toISOString(),
    workerId,
    traceId: context.traceId,
    sessionId: context.sessionId,
    legId: context.legId,
    tenantId: context.tenantId,
    commandType: row.commandType,
    callControlId: context.callControlId,
    retryCount: row.attempts,
  };

  await commandOutbox.recordCommandExecutionStarted(row.id, workerId, execution);

  metrics.commandsStarted({
    command_type: row.commandType,
    tenant_id: context.tenantId || 'unknown',
  });

  await emitCommandStarted(row, context, execution);

  logDialBridgeExecutor(row, context, 'executor_start', {
    requestPayload: row.payload ?? null,
  });

  console.log('[V3] commandExecutor executing', {
    commandId: row.id,
    commandType: row.commandType,
    sessionId: row.sessionId,
    legId: row.legId,
    callControlId: context.callControlId,
    tenantId: context.tenantId,
    traceId: context.traceId,
    workerId,
    attempt: row.attempts,
    payload: row.payload,
  });
  v3Logger.info('command.executor.executing', {
    commandId: row.id,
    commandType: row.commandType,
    sessionId: row.sessionId,
    legId: row.legId,
    callControlId: context.callControlId,
    tenantId: context.tenantId,
    traceId: context.traceId,
    workerId,
    attempt: row.attempts,
  });

  const metricLabels = {
    command_type: row.commandType,
    tenant_id: context.tenantId || 'unknown',
  };

  const renewInterval = setInterval(() => {
    commandOutbox.renewCommandLease(row.id, workerId).then((renewed) => {
      if (renewed) {
        metrics.executorLeaseRenewal({ command_type: row.commandType });
      }
    }).catch(() => {});
  }, EXECUTOR.LEASE_RENEW_INTERVAL_MS);

  try {
    const adapterResult = await executeCommand({
      commandType: row.commandType,
      callControlId: context.callControlId,
      payload: row.payload,
      commandId: row.id,
      targetLegId: row.legId ?? context.legId ?? null,
      telnyx: options.telnyx,
    });

    execution.executionTimeMs = Date.now() - startedMs;
    execution.completedAt = new Date().toISOString();
    execution.attemptCount = row.attempts + 1;

    await commandOutbox.completeCommand(row.id, workerId, {
      telnyxRequestId: adapterResult.telnyxRequestId,
      result: adapterResult,
      execution,
    });

    metrics.commandsCompleted(metricLabels);
    metrics.observeCommandDuration(execution.executionTimeMs, metricLabels);

    await emitCommandCompleted(row, context, execution, adapterResult);

    if (adapterResult.skipped) {
      logDialBridgeExecutor(row, context, 'executor_skipped', {
        message: adapterResult.reason || 'unknown',
        responseBody: adapterResult,
      });
      console.log('[V3] commandExecutor skipped', {
        commandId: row.id,
        commandType: row.commandType,
        sessionId: row.sessionId,
        skipReason: adapterResult.reason || 'unknown',
        action: adapterResult.action || null,
      });
      v3Logger.info('command.executor.skipped', {
        commandId: row.id,
        commandType: row.commandType,
        sessionId: row.sessionId,
        skipReason: adapterResult.reason || 'unknown',
        action: adapterResult.action || null,
      });
    } else {
      logDialBridgeExecutor(row, context, 'executor_completed', {
        responseStatus: 200,
        responseBody: adapterResult.telnyxResult ?? adapterResult,
      });
      console.log('[V3] commandExecutor completed', {
        commandId: row.id,
        commandType: row.commandType,
        sessionId: row.sessionId,
        action: adapterResult.action || null,
        telnyxRequestId: adapterResult.telnyxRequestId || null,
        executionTimeMs: execution.executionTimeMs,
      });
    }

    v3Logger.info('command.completed', {
      commandId: row.id,
      commandType: row.commandType,
      sessionId: row.sessionId,
      workerId,
      traceId: context.traceId,
      skipped: adapterResult.skipped || false,
      executionTimeMs: execution.executionTimeMs,
    });

    return { ok: true, commandId: row.id, result: adapterResult };
  } catch (error) {
    const classification = classifyFailure(error);
    execution.executionTimeMs = Date.now() - startedMs;
    execution.completedAt = new Date().toISOString();
    execution.failureClass = classification.class;

    if (classification.idempotent) {
      const idempotentResult = {
        ok: true,
        skipped: true,
        reason: 'idempotent',
        message: error.message,
        failureClass: classification.class,
      };

      execution.attemptCount = row.attempts + 1;
      execution.result = idempotentResult;

      await commandOutbox.completeCommand(row.id, workerId, {
        telnyxRequestId: null,
        result: idempotentResult,
        execution,
      });

      metrics.commandsCompleted(metricLabels);
      metrics.observeCommandDuration(execution.executionTimeMs, metricLabels);

      await emitCommandCompleted(row, context, execution, idempotentResult);

      logDialBridgeExecutor(row, context, 'executor_idempotent', {
        message: error.message,
        responseStatus: error.status ?? null,
        responseBody: error.telnyx ?? null,
        exceptionStack: error.stack ?? null,
      });

      v3Logger.info('command.idempotent_complete', {
        commandId: row.id,
        commandType: row.commandType,
        sessionId: row.sessionId,
        workerId,
        traceId: context.traceId,
        failureClass: classification.class,
      });

      return { ok: true, commandId: row.id, idempotent: true };
    }

    const retryable = classification.retryable !== false;
    if (row.attempts > 0 && retryable) {
      metrics.commandRetry(metricLabels);
    }

    const failedRow = await commandOutbox.markCommandExecutionFailed(row.id, workerId, {
      errorMessage: error.message,
      failureClass: classification.class,
      retryable,
      execution,
    });

    metrics.commandsFailed({
      ...metricLabels,
      failure_class: classification.class,
    });
    metrics.observeCommandDuration(execution.executionTimeMs, metricLabels);

    if (failedRow?.status === 'DEAD') {
      metrics.commandDlq(metricLabels);
    }

    await emitCommandFailed(row, context, execution, {
      errorMessage: error.message,
      failureClass: classification.class,
      retryable,
      status: failedRow?.status || 'FAILED',
    });

    logDialBridgeExecutor(row, context, 'executor_failed', {
      message: error.message,
      responseStatus: error.status ?? null,
      responseBody: error.telnyx ?? null,
      exceptionStack: error.stack ?? null,
    });

    v3Logger.error('command.failed', {
      commandId: row.id,
      commandType: row.commandType,
      sessionId: row.sessionId,
      workerId,
      traceId: context.traceId,
      failureClass: classification.class,
      retryable,
      status: failedRow?.status,
      error: error.message,
      telnyxStatus: error.status,
      telnyxResponse: error.telnyx ?? null,
    });

    console.log('[V3] commandExecutor failed', {
      commandId: row.id,
      commandType: row.commandType,
      sessionId: row.sessionId,
      error: error.message,
      telnyxStatus: error.status ?? null,
      telnyxResponse: error.telnyx ?? null,
      failureClass: classification.class,
      retryable,
      status: failedRow?.status,
    });

    return {
      ok: false,
      commandId: row.id,
      error: error.message,
      failureClass: classification.class,
      status: failedRow?.status,
    };
  } finally {
    clearInterval(renewInterval);
  }
}

/**
 * Claim and execute a batch of outbox commands via Telnyx.
 * @param {string} workerId
 * @param {number} [batchSize]
 * @param {{ telnyx?: import('./telnyxAdapter') }} [options]
 */
async function processCommandBatch(workerId, batchSize = OUTBOX.POLL_BATCH, options = {}) {
  const rows = await commandOutbox.claimPendingCommands(workerId, batchSize);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  /** @type {Map<string, import('@prisma/client').V3CommandOutbox[]>} */
  const bySession = new Map();
  for (const row of rows) {
    const list = bySession.get(row.sessionId) || [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }

  for (const sessionRows of bySession.values()) {
    for (const row of sessionRows) {
      const outcome = await executeOneCommand(row, workerId, options);
      processed += 1;
      if (outcome.ok) succeeded += 1;
      else failed += 1;
    }
  }

  return { processed, succeeded, failed, paused: false };
}

module.exports = {
  resolveCommandContext,
  executeOneCommand,
  processCommandBatch,
};
