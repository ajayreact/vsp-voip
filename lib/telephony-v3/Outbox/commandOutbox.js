const crypto = require('crypto');
const { getPrisma } = require('../internal/prisma');
const { OUTBOX } = require('../constants');
const { V3DuplicateError, V3ConflictError } = require('../errors');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');

/**
 * @param {import('../types').V3OutboxCommandInput} input
 */
async function enqueueCommand(input) {
  const prisma = await getPrisma();
  try {
    const row = await prisma.v3CommandOutbox.create({
      data: {
        sessionId: input.sessionId,
        legId: input.legId || null,
        commandType: input.commandType,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        maxAttempts: input.maxAttempts ?? OUTBOX.DEFAULT_MAX_ATTEMPTS,
        status: 'PENDING',
        nextAttemptAt: new Date(),
      },
    });
    metrics.outboxEnqueued({ command_type: input.commandType });
    v3Logger.info('outbox.enqueued', {
      commandId: row.id,
      sessionId: input.sessionId,
      commandType: input.commandType,
    });
    return row;
  } catch (error) {
    if (error?.code === 'P2002') {
      const existing = await prisma.v3CommandOutbox.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
      throw new V3DuplicateError('Duplicate outbox command');
    }
    throw error;
  }
}

/**
 * Atomically claim commands with PROCESSING status + lease.
 * Reclaims expired PROCESSING rows (crash recovery).
 * @param {string} workerId
 * @param {number} [batchSize]
 */
async function claimPendingCommands(workerId, batchSize = OUTBOX.POLL_BATCH) {
  if (!workerId) {
    throw new Error('workerId is required to claim outbox commands');
  }

  const prisma = await getPrisma();
  const leaseSec = OUTBOX.CLAIM_LEASE_SEC;

  const rows = await prisma.$queryRaw`
    UPDATE "V3CommandOutbox" AS o
    SET
      "status" = 'PROCESSING'::"V3OutboxStatus",
      "claimOwner" = ${workerId},
      "claimedUntil" = NOW() + (${leaseSec} * INTERVAL '1 second'),
      "updatedAt" = NOW()
    FROM (
      SELECT id FROM "V3CommandOutbox"
      WHERE (
        "status" = 'PENDING'::"V3OutboxStatus"
        OR "status" = 'FAILED'::"V3OutboxStatus"
        OR ("status" = 'PROCESSING'::"V3OutboxStatus" AND "claimedUntil" < NOW())
      )
      AND "nextAttemptAt" <= NOW()
      AND "attempts" < "maxAttempts"
      ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    ) AS sub
    WHERE o.id = sub.id
    RETURNING o.*
  `;

  if (rows.length) {
    metrics.outboxClaimed({ worker_id: workerId }, rows.length);
  }
  return rows;
}

/**
 * @param {string} commandId
 * @param {string} workerId
 * @param {{ telnyxRequestId?: string }} [meta]
 */
async function markCommandSent(commandId, workerId, meta = {}) {
  const prisma = await getPrisma();
  const result = await prisma.v3CommandOutbox.updateMany({
    where: {
      id: commandId,
      claimOwner: workerId,
      status: 'PROCESSING',
    },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      telnyxRequestId: meta.telnyxRequestId || null,
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new V3ConflictError('Outbox command not owned by worker or not PROCESSING');
  }

  const row = await prisma.v3CommandOutbox.findUnique({ where: { id: commandId } });
  if (row) metrics.outboxSent({ command_type: row.commandType });
  return row;
}

/**
 * @param {string} commandId
 * @param {string} [workerId]
 */
async function acknowledgeCommand(commandId, workerId = null) {
  const prisma = await getPrisma();
  const where = { id: commandId, status: 'SENT' };
  if (workerId) where.claimOwner = workerId;

  const result = await prisma.v3CommandOutbox.updateMany({
    where,
    data: {
      status: 'ACKED',
      ackedAt: new Date(),
      claimOwner: null,
      claimedUntil: null,
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new V3ConflictError('Outbox command not in SENT state for ack');
  }

  return prisma.v3CommandOutbox.findUnique({ where: { id: commandId } });
}

/**
 * @param {string} commandId
 * @param {string} errorMessage
 * @param {string} [workerId]
 */
async function markCommandFailed(commandId, errorMessage, workerId = null) {
  const prisma = await getPrisma();
  const where = { id: commandId };
  if (workerId) {
    where.claimOwner = workerId;
    where.status = 'PROCESSING';
  }

  const existing = await prisma.v3CommandOutbox.findFirst({ where });
  if (!existing) return null;

  const attempts = existing.attempts + 1;
  const isDead = attempts >= existing.maxAttempts;
  const delayMs = Math.min(
    OUTBOX.BASE_RETRY_MS * 2 ** (attempts - 1),
    OUTBOX.MAX_RETRY_MS,
  );

  const row = await prisma.v3CommandOutbox.update({
    where: { id: commandId },
    data: {
      status: isDead ? 'DEAD' : 'FAILED',
      attempts,
      lastError: errorMessage,
      claimOwner: null,
      claimedUntil: null,
      nextAttemptAt: isDead ? existing.nextAttemptAt : new Date(Date.now() + delayMs),
      updatedAt: new Date(),
    },
  });

  if (isDead) {
    metrics.outboxDead({ command_type: row.commandType });
    v3Logger.error('outbox.dead', { commandId, error: errorMessage });
  }
  return row;
}

async function countOutboxByStatus() {
  const prisma = await getPrisma();
  const [pending, processing, sent, failed, dead] = await Promise.all([
    prisma.v3CommandOutbox.count({ where: { status: 'PENDING' } }),
    prisma.v3CommandOutbox.count({ where: { status: 'PROCESSING' } }),
    prisma.v3CommandOutbox.count({ where: { status: 'SENT' } }),
    prisma.v3CommandOutbox.count({ where: { status: 'FAILED' } }),
    prisma.v3CommandOutbox.count({ where: { status: 'DEAD' } }),
  ]);
  return { pending, processing, sent, failed, dead };
}

function buildIdempotencyKey(sessionId, commandType, target) {
  return `${sessionId}:${commandType}:${target}`;
}

/**
 * @param {Record<string, unknown>|null|undefined} existingPayload
 * @param {Record<string, unknown>} execution
 */
function mergeExecutionPayload(existingPayload, execution) {
  const payload = typeof existingPayload === 'object' && existingPayload
    ? { ...existingPayload }
    : {};
  payload.execution = {
    ...(typeof payload.execution === 'object' && payload.execution ? payload.execution : {}),
    ...execution,
  };
  return payload;
}

/**
 * Record execution start metadata while command remains PROCESSING.
 * @param {string} commandId
 * @param {string} workerId
 * @param {Record<string, unknown>} execution
 */
async function recordCommandExecutionStarted(commandId, workerId, execution) {
  const prisma = await getPrisma();
  const existing = await prisma.v3CommandOutbox.findFirst({
    where: { id: commandId, claimOwner: workerId, status: 'PROCESSING' },
  });
  if (!existing) {
    throw new V3ConflictError('Outbox command not owned by worker or not PROCESSING');
  }

  const payload = mergeExecutionPayload(existing.payload, {
    ...execution,
    status: 'started',
  });

  return prisma.v3CommandOutbox.update({
    where: { id: commandId },
    data: {
      payload,
      updatedAt: new Date(),
    },
  });
}

/**
 * Mark command ACKED with execution result (Phase 3.1).
 * @param {string} commandId
 * @param {string} workerId
 * @param {{ telnyxRequestId?: string|null, result?: Record<string, unknown>, execution?: Record<string, unknown> }} meta
 */
async function completeCommand(commandId, workerId, meta = {}) {
  const prisma = await getPrisma();
  const existing = await prisma.v3CommandOutbox.findFirst({
    where: { id: commandId, claimOwner: workerId, status: 'PROCESSING' },
  });
  if (!existing) {
    throw new V3ConflictError('Outbox command not owned by worker or not PROCESSING');
  }

  const now = new Date();
  const execution = {
    ...(typeof existing.payload?.execution === 'object' ? existing.payload.execution : {}),
    ...(meta.execution || {}),
    completedAt: meta.execution?.completedAt || now.toISOString(),
    status: 'completed',
    result: meta.result ?? null,
    lastError: null,
  };

  const payload = mergeExecutionPayload(existing.payload, execution);

  const result = await prisma.v3CommandOutbox.updateMany({
    where: { id: commandId, claimOwner: workerId, status: 'PROCESSING' },
    data: {
      status: 'ACKED',
      sentAt: execution.startedAt ? new Date(String(execution.startedAt)) : now,
      ackedAt: now,
      telnyxRequestId: meta.telnyxRequestId || null,
      payload,
      claimOwner: null,
      claimedUntil: null,
      updatedAt: now,
    },
  });

  if (result.count === 0) {
    throw new V3ConflictError('Outbox command not owned by worker or not PROCESSING');
  }

  metrics.outboxSent({ command_type: existing.commandType });
  return prisma.v3CommandOutbox.findUnique({ where: { id: commandId } });
}

/**
 * @param {string} commandId
 * @param {string} workerId
 * @param {{ errorMessage: string, failureClass?: string, retryable?: boolean, execution?: Record<string, unknown> }} options
 */
async function markCommandExecutionFailed(commandId, workerId, options) {
  const prisma = await getPrisma();
  const where = {
    id: commandId,
    claimOwner: workerId,
    status: 'PROCESSING',
  };

  const existing = await prisma.v3CommandOutbox.findFirst({ where });
  if (!existing) return null;

  const retryable = options.retryable !== false;
  const attempts = existing.attempts + 1;
  const forceDead = !retryable || attempts >= existing.maxAttempts;
  const isDead = forceDead;
  const delayMs = Math.min(
    OUTBOX.BASE_RETRY_MS * 2 ** (attempts - 1),
    OUTBOX.MAX_RETRY_MS,
  );

  const execution = {
    ...(typeof existing.payload?.execution === 'object' ? existing.payload.execution : {}),
    ...(options.execution || {}),
    status: isDead ? 'dead' : 'failed',
    lastError: options.errorMessage,
    failureClass: options.failureClass || null,
    attemptCount: attempts,
  };

  const payload = mergeExecutionPayload(existing.payload, execution);

  const row = await prisma.v3CommandOutbox.update({
    where: { id: commandId },
    data: {
      status: isDead ? 'DEAD' : 'FAILED',
      attempts,
      lastError: options.errorMessage,
      payload,
      claimOwner: null,
      claimedUntil: null,
      nextAttemptAt: isDead ? existing.nextAttemptAt : new Date(Date.now() + delayMs),
      updatedAt: new Date(),
    },
  });

  if (isDead) {
    metrics.outboxDead({ command_type: row.commandType });
    v3Logger.error('outbox.dead', {
      commandId,
      error: options.errorMessage,
      failureClass: options.failureClass,
    });
  }
  return row;
}

/**
 * Enqueue within an open Prisma transaction (Phase 2.6 atomic persist).
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../types').V3OutboxCommandInput} input
 */
async function enqueueCommandInTransaction(tx, input) {
  try {
    const row = await tx.v3CommandOutbox.create({
      data: {
        sessionId: input.sessionId,
        legId: input.legId || null,
        commandType: input.commandType,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        maxAttempts: input.maxAttempts ?? OUTBOX.DEFAULT_MAX_ATTEMPTS,
        status: 'PENDING',
        nextAttemptAt: new Date(),
      },
    });
    return row;
  } catch (error) {
    if (error?.code === 'P2002') {
      const existing = await tx.v3CommandOutbox.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
      throw new V3DuplicateError('Duplicate outbox command');
    }
    throw error;
  }
}

async function renewCommandLease(commandId, workerId) {
  const prisma = await getPrisma();
  const leaseSec = OUTBOX.CLAIM_LEASE_SEC;
  const result = await prisma.v3CommandOutbox.updateMany({
    where: {
      id: commandId,
      claimOwner: workerId,
      status: 'PROCESSING',
    },
    data: {
      claimedUntil: new Date(Date.now() + leaseSec * 1000),
      updatedAt: new Date(),
    },
  });
  return result.count > 0;
}

module.exports = {
  enqueueCommand,
  enqueueCommandInTransaction,
  claimPendingCommands,
  markCommandSent,
  acknowledgeCommand,
  markCommandFailed,
  recordCommandExecutionStarted,
  completeCommand,
  markCommandExecutionFailed,
  mergeExecutionPayload,
  countOutboxByStatus,
  buildIdempotencyKey,
  renewCommandLease,
};
