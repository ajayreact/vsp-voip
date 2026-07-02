/**
 * V3 Queue Service — configuration-only call queues for Call Flow Builder.
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');

const STRATEGIES = ['ROUND_ROBIN', 'LONGEST_IDLE', 'LEAST_CALLS', 'RANDOM'];

const DEFAULT_STATS = Object.freeze({
  callsOffered: 0,
  callsAnswered: 0,
  callsAbandoned: 0,
  avgWaitSeconds: 0,
});

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    queueNumber: row.queueNumber,
    strategy: row.strategy,
    agentExtensionIds: row.agentExtensionIds || [],
    wrapUpTimeSeconds: row.wrapUpTimeSeconds,
    maxWaiting: row.maxWaiting,
    queueTimeoutSeconds: row.queueTimeoutSeconds,
    overflowDestination: row.overflowDestination,
    musicOnHold: row.musicOnHold,
    stats: row.stats || DEFAULT_STATS,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function validateQueue(prisma, tenantId, data, { excludeId } = {}) {
  const issues = [];
  const name = String(data.name || '').trim();
  if (!name) issues.push({ severity: 'error', code: 'MISSING_NAME', message: 'Queue name is required' });

  const strategy = String(data.strategy || 'ROUND_ROBIN').toUpperCase();
  if (!STRATEGIES.includes(strategy)) {
    issues.push({ severity: 'error', code: 'INVALID_STRATEGY', message: `Invalid strategy: ${strategy}` });
  }

  const agents = Array.isArray(data.agentExtensionIds) ? data.agentExtensionIds : [];
  if (!agents.length) {
    issues.push({ severity: 'error', code: 'MISSING_AGENTS', message: 'At least one agent extension is required' });
  }

  for (const extId of agents) {
    const ext = await prisma.extension.findFirst({ where: { id: extId, tenantId }, select: { id: true } });
    if (!ext) issues.push({ severity: 'error', code: 'INVALID_AGENT', message: `Agent extension not found: ${extId}` });
  }

  if (name) {
    const selfId = excludeId || data.id || null;
    const dup = await prisma.v3Queue.findFirst({
      where: {
        tenantId,
        name,
        removedAt: null,
        ...(selfId ? { id: { not: selfId } } : {}),
      },
    });
    if (dup) issues.push({ severity: 'error', code: 'DUPLICATE_NAME', message: 'Queue name already exists' });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
}

async function listQueues(prisma, tenantId, { search, limit = 100, offset = 0 } = {}) {
  const where = { tenantId, removedAt: null };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  const [rows, total] = await Promise.all([
    prisma.v3Queue.findMany({ where, orderBy: { name: 'asc' }, take: limit, skip: offset }),
    prisma.v3Queue.count({ where }),
  ]);
  return { items: rows.map(serialize), total };
}

async function getQueue(prisma, tenantId, id) {
  const row = await prisma.v3Queue.findFirst({ where: { id, tenantId, removedAt: null } });
  return serialize(row);
}

async function createQueue(prisma, tenantId, data, { req, actor } = {}) {
  const validation = await validateQueue(prisma, tenantId, data);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const row = await prisma.v3Queue.create({
    data: {
      id: randomUUID(),
      tenantId,
      name: String(data.name).trim(),
      queueNumber: data.queueNumber || null,
      strategy: String(data.strategy || 'ROUND_ROBIN').toUpperCase(),
      agentExtensionIds: data.agentExtensionIds || [],
      wrapUpTimeSeconds: Number(data.wrapUpTimeSeconds) || 0,
      maxWaiting: Number(data.maxWaiting) || 50,
      queueTimeoutSeconds: Number(data.queueTimeoutSeconds) || 120,
      overflowDestination: data.overflowDestination || null,
      musicOnHold: data.musicOnHold || null,
      stats: data.stats || DEFAULT_STATS,
      isActive: data.isActive !== false,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.queue.created',
    entityType: 'V3Queue',
    entityId: row.id,
    newValue: { name: row.name, strategy: row.strategy },
    extra: { tenantId, actor: actor?.sub },
  });

  return serialize(row);
}

async function updateQueue(prisma, tenantId, id, data, { req, actor } = {}) {
  const existing = await prisma.v3Queue.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Queue not found'), { status: 404 });

  const merged = { ...serialize(existing), ...data };
  const validation = await validateQueue(prisma, tenantId, merged, { excludeId: id });
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const row = await prisma.v3Queue.update({
    where: { id },
    data: {
      name: merged.name,
      queueNumber: merged.queueNumber,
      strategy: merged.strategy,
      agentExtensionIds: merged.agentExtensionIds,
      wrapUpTimeSeconds: merged.wrapUpTimeSeconds,
      maxWaiting: merged.maxWaiting,
      queueTimeoutSeconds: merged.queueTimeoutSeconds,
      overflowDestination: merged.overflowDestination,
      musicOnHold: merged.musicOnHold,
      stats: merged.stats,
      isActive: merged.isActive,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.queue.updated',
    entityType: 'V3Queue',
    entityId: id,
    oldValue: { name: existing.name },
    newValue: { name: row.name },
    extra: { tenantId, actor: actor?.sub },
  });

  return serialize(row);
}

async function removeQueue(prisma, tenantId, id, { req, actor } = {}) {
  const existing = await prisma.v3Queue.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Queue not found'), { status: 404 });

  const row = await prisma.v3Queue.update({
    where: { id },
    data: { removedAt: new Date(), isActive: false },
  });

  await auditService.log(prisma, req, {
    action: 'v3.queue.deleted',
    entityType: 'V3Queue',
    entityId: id,
    oldValue: { name: existing.name },
    newValue: { removedAt: row.removedAt },
    extra: { tenantId, actor: actor?.sub },
  });

  return serialize(row);
}

module.exports = {
  STRATEGIES,
  DEFAULT_STATS,
  listQueues,
  getQueue,
  createQueue,
  updateQueue,
  removeQueue,
  validateQueue,
};
