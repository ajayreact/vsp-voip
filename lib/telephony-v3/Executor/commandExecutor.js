const crypto = require('crypto');
const { getPrisma } = require('../internal/prisma');
const commandOutbox = require('../Outbox/commandOutbox');
const { executeCommand } = require('./telnyxAdapter');
const { classifyFailure } = require('./failureClassifier');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const domainEventBus = require('../Events/domainEventBus');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { OUTBOX, EXECUTOR } = require('../constants');
const locks = require('../Redis/locks');

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

/**
 * @param {string|null|undefined} commandType
 * @param {string|null|undefined} callControlId
 */
function inferTelnyxEndpoint(commandType, callControlId) {
  const upper = String(commandType || '').toUpperCase();
  if (upper === 'DIAL') {
    return `POST ${TELNYX_API_BASE}/calls`;
  }
  if (!callControlId) {
    return null;
  }
  const cc = encodeURIComponent(callControlId);
  const actionByType = {
    ANSWER: 'answer',
    BRIDGE: 'bridge',
    HANGUP: 'hangup',
    REJECT: 'reject',
    SPEAK: 'speak',
    HOLD: 'hold',
    UNHOLD: 'unhold',
    TRANSFER: 'transfer',
    RECORD_START: 'record_start',
    RECORD_STOP: 'record_stop',
    PLAY: 'playback_start',
    STOP_AUDIO: 'playback_stop',
    GATHER: 'gather_using_speak',
  };
  const action = actionByType[upper];
  if (action) {
    return `POST ${TELNYX_API_BASE}/calls/${cc}/actions/${action}`;
  }
  return `POST ${TELNYX_API_BASE}/calls/${cc}/actions/${upper.toLowerCase()}`;
}

/**
 * @param {Record<string, unknown>} context
 * @param {Error & { status?: number, code?: string, telnyx?: unknown }} error
 */
function inferFailurePhase(context, error) {
  if (!context.callControlId) {
    return {
      phase: 'pre_adapter_validation',
      reason: 'missing_call_control_id',
      adapterReached: false,
    };
  }
  if (error?.code === 'V3_VALIDATION') {
    return {
      phase: 'adapter_validation',
      reason: error.message || 'adapter_validation_failed',
      adapterReached: true,
    };
  }
  if (error?.status) {
    return {
      phase: 'telnyx_http',
      reason: error.message || 'telnyx_http_error',
      adapterReached: true,
    };
  }
  if (String(error?.message || '').toLowerCase().includes('outbox')) {
    return {
      phase: 'outbox',
      reason: error.message || 'outbox_error',
      adapterReached: false,
    };
  }
  return {
    phase: 'executor',
    reason: error?.message || 'executor_error',
    adapterReached: true,
  };
}

/**
 * Unified per-command trace log — every outbox command gets executing → completed|failed.
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {Record<string, unknown>} context
 * @param {'executing'|'completed'|'failed'} status
 * @param {Record<string, unknown>} [extra]
 */
function logCommandExecutionTrace(row, context, status, extra = {}) {
  const record = {
    status,
    commandType: row.commandType,
    commandId: row.id,
    sessionId: row.sessionId,
    legId: row.legId ?? context.legId ?? null,
    callControlId: context.callControlId ?? null,
    tenantId: context.tenantId ?? null,
    traceId: context.traceId ?? null,
    attempt: row.attempts,
    telnyxEndpoint: inferTelnyxEndpoint(row.commandType, context.callControlId),
    ...extra,
  };
  console.log('[V3] commandExecutor', record);
  if (status === 'failed') {
    v3Logger.error('command.executor.trace', record);
  } else {
    v3Logger.info('command.executor.trace', record);
  }
}

/**
 * @param {import('@prisma/client').V3CommandOutbox} row
 * @param {Record<string, unknown>} context
 * @param {Error & { status?: number, code?: string, telnyx?: unknown }} error
 * @param {Record<string, unknown>} [extra]
 */
function logCommandExecutorFailure(row, context, error, extra = {}) {
  const failurePhase = inferFailurePhase(context, error);
  logCommandExecutionTrace(row, context, 'failed', {
    requestPayload: row.payload ?? null,
    httpStatus: error?.status ?? null,
    responseBody: error?.telnyx ?? null,
    errorMessage: error?.message ?? String(error),
    errorStack: error?.stack ?? null,
    failurePhase: failurePhase.phase,
    validationFailed: failurePhase.reason,
    adapterReached: failurePhase.adapterReached,
    returnPath: extra.returnPath ?? 'executeOneCommandLocked.catch',
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

  logCommandExecutionTrace(row, context, 'executing', {
    requestPayload: row.payload ?? null,
    workerId,
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

    logCommandExecutionTrace(row, context, 'completed', {
      skipped: Boolean(adapterResult.skipped),
      skipReason: adapterResult.skipped ? (adapterResult.reason || 'unknown') : null,
      action: adapterResult.action || null,
      telnyxRequestId: adapterResult.telnyxRequestId || null,
      executionTimeMs: execution.executionTimeMs,
      responseBody: adapterResult.telnyxResult ?? null,
    });

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

      logCommandExecutionTrace(row, context, 'completed', {
        idempotent: true,
        executionTimeMs: execution.executionTimeMs,
        httpStatus: error?.status ?? null,
        responseBody: error?.telnyx ?? null,
        errorMessage: error?.message ?? null,
        failureClass: classification.class,
        returnPath: 'executeOneCommandLocked.idempotent_complete',
        note: 'Telnyx error treated as idempotent success',
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

    logCommandExecutorFailure(row, context, error, {
      returnPath: 'executeOneCommandLocked.mark_failed',
      failureClass: classification.class,
      retryable,
      outboxStatus: failedRow?.status || 'FAILED',
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
    sessionRows.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.id).localeCompare(String(b.id));
    });
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
