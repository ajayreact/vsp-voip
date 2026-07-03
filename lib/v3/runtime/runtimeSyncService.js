/**
 * V3 Runtime Sync Service — job queue, processing, resync, and repair orchestration.
 */

const { randomUUID } = require('crypto');
const auditService = require('../auditService');
const runtimeAdapter = require('./runtimeAdapter');
const { isRuntimeSyncEnabledForTenant } = require('./runtimeFeatureFlag');

const ADAPTERS = {
  ring_group: require('./ringGroupRuntimeAdapter'),
  queue: require('./queueRuntimeAdapter'),
  business_hours: require('./businessHoursRuntimeAdapter'),
  holiday: require('./holidayRuntimeAdapter'),
  voicemail: require('./voicemailRuntimeAdapter'),
  call_flow: require('./callFlowRuntimeAdapter'),
  extension: require('./extensionRuntimeAdapter'),
  number: require('./numberRuntimeAdapter'),
  device: require('./deviceRuntimeAdapter'),
};

const RETRYABLE = new Set(['PENDING', 'FAILED', 'RETRYING']);

function getAdapter(entityType) {
  const adapter = ADAPTERS[entityType];
  if (!adapter) {
    throw Object.assign(new Error(`Unknown runtime entity type: ${entityType}`), { status: 400 });
  }
  return adapter;
}

async function enqueue(prisma, tenantId, { entityType, entityId, action = 'sync', payload, req } = {}) {
  if (!isRuntimeSyncEnabledForTenant(tenantId)) {
    throw Object.assign(new Error('Runtime sync is disabled'), { status: 403, code: 'RUNTIME_SYNC_DISABLED' });
  }

  const idempotencyKey = runtimeAdapter.buildIdempotencyKey(tenantId, entityType, entityId, action, payload);
  const existing = await prisma.v3RuntimeSyncJob.findUnique({ where: { idempotencyKey } });
  if (existing && RETRYABLE.has(existing.status)) {
    return existing;
  }
  if (existing?.status === 'SUCCESS') {
    return existing;
  }

  const job = await prisma.v3RuntimeSyncJob.create({
    data: {
      id: randomUUID(),
      tenantId,
      entityType,
      entityId,
      action,
      status: 'PENDING',
      payload: payload || null,
      idempotencyKey,
      scheduledAt: new Date(),
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.runtime.sync.enqueued',
    entityType: 'V3RuntimeSyncJob',
    entityId: job.id,
    newValue: { entityType, entityId, action },
    extra: { tenantId },
  });

  return job;
}

async function processJob(prisma, job, { req } = {}) {
  const adapter = getAdapter(job.entityType);
  await prisma.v3RuntimeSyncJob.update({
    where: { id: job.id },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  });

  try {
    const result = await adapter.sync(prisma, job.tenantId, job.entityId, {
      action: job.action,
      payload: job.payload,
    });

    const updated = await prisma.v3RuntimeSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'SUCCESS',
        result,
        finishedAt: new Date(),
        lastError: null,
      },
    });

    await auditService.log(prisma, req, {
      action: 'v3.runtime.sync.completed',
      entityType: 'V3RuntimeSyncJob',
      entityId: job.id,
      newValue: { entityType: job.entityType, entityId: job.entityId, result },
      extra: { tenantId: job.tenantId },
    });

    return updated;
  } catch (error) {
    const attempts = job.attempts + 1;
    const dead = attempts >= job.maxAttempts;
    const updated = await prisma.v3RuntimeSyncJob.update({
      where: { id: job.id },
      data: {
        status: dead ? 'DEAD_LETTER' : 'RETRYING',
        lastError: error.message,
        finishedAt: new Date(),
        scheduledAt: dead ? job.scheduledAt : new Date(Date.now() + Math.min(attempts * 5000, 60000)),
      },
    });

    await auditService.log(prisma, req, {
      action: dead ? 'v3.runtime.sync.dead_letter' : 'v3.runtime.sync.failed',
      entityType: 'V3RuntimeSyncJob',
      entityId: job.id,
      newValue: { error: error.message, attempts },
      extra: { tenantId: job.tenantId },
    });

    if (!dead) throw error;
    return updated;
  }
}

async function processPending(prisma, tenantId, { limit = 10, req } = {}) {
  if (!isRuntimeSyncEnabledForTenant(tenantId)) {
    return { processed: 0, reason: 'disabled' };
  }

  const jobs = await prisma.v3RuntimeSyncJob.findMany({
    where: {
      tenantId,
      status: { in: ['PENDING', 'RETRYING'] },
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
  });

  const results = [];
  for (const job of jobs) {
    try {
      results.push(await processJob(prisma, job, { req }));
    } catch {
      // logged in processJob
    }
  }
  return { processed: results.length, jobs: results };
}

async function syncNow(prisma, tenantId, { entityType, entityId, action = 'sync', req } = {}) {
  const job = await enqueue(prisma, tenantId, { entityType, entityId, action, req });
  return processJob(prisma, job, { req });
}

async function resyncAll(prisma, tenantId, { req } = {}) {
  const enqueued = [];
  const [
    ringGroups,
    queues,
    schedules,
    voicemails,
    flows,
    extensions,
    numbers,
    devices,
  ] = await Promise.all([
    prisma.v3RingGroup.findMany({ where: { tenantId, removedAt: null, isActive: true }, select: { id: true } }),
    prisma.v3Queue.findMany({ where: { tenantId, removedAt: null, isActive: true }, select: { id: true } }),
    prisma.v3BusinessHoursSchedule.findMany({ where: { tenantId, removedAt: null, isDefault: true }, select: { id: true } }),
    prisma.v3VoicemailBox.findMany({ where: { tenantId, removedAt: null, isActive: true }, select: { id: true } }),
    prisma.v3CallFlow.findMany({ where: { tenantId, removedAt: null, status: 'PUBLISHED' }, select: { id: true } }),
    prisma.extension.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true } }),
    prisma.phoneNumber.findMany({ where: { tenantId, isActive: { not: false } }, select: { id: true } }),
    prisma.v3DeskDevice.findMany({ where: { tenantId, removedAt: null }, select: { id: true } }),
  ]);

  const batches = [
    ...ringGroups.map((r) => ({ entityType: 'ring_group', entityId: r.id })),
    ...queues.map((q) => ({ entityType: 'queue', entityId: q.id })),
    ...schedules.map((s) => ({ entityType: 'business_hours', entityId: s.id })),
    { entityType: 'holiday', entityId: tenantId },
    ...voicemails.map((v) => ({ entityType: 'voicemail', entityId: v.id })),
    ...flows.map((f) => ({ entityType: 'call_flow', entityId: f.id })),
    ...extensions.map((e) => ({ entityType: 'extension', entityId: e.id })),
    ...numbers.map((n) => ({ entityType: 'number', entityId: n.id })),
    ...devices.map((d) => ({ entityType: 'device', entityId: d.id })),
  ];

  for (const item of batches) {
    enqueued.push(await enqueue(prisma, tenantId, { ...item, action: 'sync', req }));
  }

  const processed = await processPending(prisma, tenantId, { limit: batches.length, req });
  return { enqueued: enqueued.length, ...processed };
}

async function repairRuntime(prisma, tenantId, { entityType, entityId, req } = {}) {
  const repairs = [];

  async function repairOne(type, id) {
    const adapter = getAdapter(type);
    if (!adapter.repair) return null;
    const result = await adapter.repair(prisma, tenantId, id);
    if (result?.repaired) {
      repairs.push({ entityType: type, entityId: id, result });
    }
    return result;
  }

  if (entityType && entityId) {
    await repairOne(entityType, entityId);
  } else {
    const links = await prisma.v3RuntimeLink.findMany({ where: { tenantId } });
    for (const link of links) {
      const check = await getAdapter(link.v3EntityType).compare(prisma, tenantId, link.v3EntityId);
      if (check.level !== 'green') {
        await repairOne(link.v3EntityType, link.v3EntityId);
      }
    }
    await repairOne('holiday', tenantId);
  }

  await auditService.log(prisma, req, {
    action: 'v3.runtime.repair.completed',
    entityType: 'Tenant',
    entityId: tenantId,
    newValue: { repairs: repairs.length, items: repairs },
  });

  return { repairs, count: repairs.length };
}

async function getStatus(prisma, tenantId) {
  const [pending, running, success, failed, dead, lastSuccess, links] = await Promise.all([
    prisma.v3RuntimeSyncJob.count({ where: { tenantId, status: 'PENDING' } }),
    prisma.v3RuntimeSyncJob.count({ where: { tenantId, status: 'RUNNING' } }),
    prisma.v3RuntimeSyncJob.count({ where: { tenantId, status: 'SUCCESS' } }),
    prisma.v3RuntimeSyncJob.count({ where: { tenantId, status: { in: ['FAILED', 'RETRYING'] } } }),
    prisma.v3RuntimeSyncJob.count({ where: { tenantId, status: 'DEAD_LETTER' } }),
    prisma.v3RuntimeSyncJob.findFirst({
      where: { tenantId, status: 'SUCCESS' },
      orderBy: { finishedAt: 'desc' },
    }),
    prisma.v3RuntimeLink.count({ where: { tenantId } }),
  ]);

  return {
    enabled: isRuntimeSyncEnabledForTenant(tenantId),
    jobs: { pending, running, success, failed, deadLetter: dead },
    links: { total: links },
    lastSuccessfulSync: lastSuccess?.finishedAt || null,
    generatedAt: new Date().toISOString(),
  };
}

async function listJobs(prisma, tenantId, { status, limit = 50, offset = 0 } = {}) {
  const where = { tenantId };
  if (status) where.status = status;
  const [items, total] = await Promise.all([
    prisma.v3RuntimeSyncJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.v3RuntimeSyncJob.count({ where }),
  ]);
  return { items, total };
}

async function retryJob(prisma, tenantId, jobId, { req } = {}) {
  const job = await prisma.v3RuntimeSyncJob.findFirst({ where: { id: jobId, tenantId } });
  if (!job) throw Object.assign(new Error('Sync job not found'), { status: 404 });
  if (!['FAILED', 'RETRYING', 'DEAD_LETTER'].includes(job.status)) {
    throw Object.assign(new Error('Job is not in a retryable state'), { status: 400 });
  }

  const reset = await prisma.v3RuntimeSyncJob.update({
    where: { id: jobId },
    data: { status: 'PENDING', scheduledAt: new Date(), lastError: null, finishedAt: null },
  });

  await auditService.log(prisma, req, {
    action: 'v3.runtime.sync.retried',
    entityType: 'V3RuntimeSyncJob',
    entityId: jobId,
    extra: { tenantId },
  });

  return processJob(prisma, reset, { req });
}

module.exports = {
  ADAPTERS,
  enqueue,
  processJob,
  processPending,
  syncNow,
  resyncAll,
  repairRuntime,
  getStatus,
  listJobs,
  retryJob,
  getAdapter,
};
