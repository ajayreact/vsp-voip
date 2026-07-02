/**
 * V3 Ring Group Service — configuration-only ring groups for Call Flow Builder.
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const { enqueueRuntimeSync } = require('./runtime/runtimeEnqueue');

const STRATEGIES = ['SEQUENTIAL', 'SIMULTANEOUS', 'ROUND_ROBIN', 'LONGEST_IDLE', 'RANDOM'];

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    extensionNumber: row.extensionNumber,
    strategy: row.strategy,
    memberExtensionIds: row.memberExtensionIds || [],
    ringTimeoutSeconds: row.ringTimeoutSeconds,
    overflowDestination: row.overflowDestination,
    musicOnHold: row.musicOnHold,
    failoverDestination: row.failoverDestination,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function validateRingGroup(prisma, tenantId, data, { excludeId } = {}) {
  const issues = [];
  const name = String(data.name || '').trim();
  if (!name) issues.push({ severity: 'error', code: 'MISSING_NAME', message: 'Group name is required' });

  const strategy = String(data.strategy || 'SIMULTANEOUS').toUpperCase();
  if (!STRATEGIES.includes(strategy)) {
    issues.push({ severity: 'error', code: 'INVALID_STRATEGY', message: `Invalid strategy: ${strategy}` });
  }

  const members = Array.isArray(data.memberExtensionIds) ? data.memberExtensionIds : [];
  if (!members.length) {
    issues.push({ severity: 'error', code: 'MISSING_MEMBERS', message: 'At least one member extension is required' });
  }

  for (const extId of members) {
    const ext = await prisma.extension.findFirst({ where: { id: extId, tenantId }, select: { id: true } });
    if (!ext) issues.push({ severity: 'error', code: 'INVALID_MEMBER', message: `Extension not found: ${extId}` });
  }

  if (name) {
    const selfId = excludeId || data.id || null;
    const dup = await prisma.v3RingGroup.findFirst({
      where: {
        tenantId,
        name,
        removedAt: null,
        ...(selfId ? { id: { not: selfId } } : {}),
      },
    });
    if (dup) issues.push({ severity: 'error', code: 'DUPLICATE_NAME', message: 'Ring group name already exists' });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
}

async function listRingGroups(prisma, tenantId, { search, limit = 100, offset = 0 } = {}) {
  const where = { tenantId, removedAt: null };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  const [rows, total] = await Promise.all([
    prisma.v3RingGroup.findMany({ where, orderBy: { name: 'asc' }, take: limit, skip: offset }),
    prisma.v3RingGroup.count({ where }),
  ]);
  return { items: rows.map(serialize), total };
}

async function getRingGroup(prisma, tenantId, id) {
  const row = await prisma.v3RingGroup.findFirst({ where: { id, tenantId, removedAt: null } });
  return serialize(row);
}

async function createRingGroup(prisma, tenantId, data, { req, actor } = {}) {
  const validation = await validateRingGroup(prisma, tenantId, data);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const row = await prisma.v3RingGroup.create({
    data: {
      id: randomUUID(),
      tenantId,
      name: String(data.name).trim(),
      extensionNumber: data.extensionNumber || null,
      strategy: String(data.strategy || 'SIMULTANEOUS').toUpperCase(),
      memberExtensionIds: data.memberExtensionIds || [],
      ringTimeoutSeconds: Number(data.ringTimeoutSeconds) || 25,
      overflowDestination: data.overflowDestination || null,
      musicOnHold: data.musicOnHold || null,
      failoverDestination: data.failoverDestination || null,
      isActive: data.isActive !== false,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.ringgroup.created',
    entityType: 'V3RingGroup',
    entityId: row.id,
    newValue: { name: row.name, strategy: row.strategy },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'ring_group', row.id, 'sync', { req });

  return serialize(row);
}

async function updateRingGroup(prisma, tenantId, id, data, { req, actor } = {}) {
  const existing = await prisma.v3RingGroup.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  const merged = { ...serialize(existing), ...data };
  const validation = await validateRingGroup(prisma, tenantId, merged, { excludeId: id });
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const row = await prisma.v3RingGroup.update({
    where: { id },
    data: {
      name: merged.name,
      extensionNumber: merged.extensionNumber,
      strategy: merged.strategy,
      memberExtensionIds: merged.memberExtensionIds,
      ringTimeoutSeconds: merged.ringTimeoutSeconds,
      overflowDestination: merged.overflowDestination,
      musicOnHold: merged.musicOnHold,
      failoverDestination: merged.failoverDestination,
      isActive: merged.isActive,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.ringgroup.updated',
    entityType: 'V3RingGroup',
    entityId: id,
    oldValue: { name: existing.name, strategy: existing.strategy },
    newValue: { name: row.name, strategy: row.strategy },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'ring_group', id, 'sync', { req });

  return serialize(row);
}

async function removeRingGroup(prisma, tenantId, id, { req, actor } = {}) {
  const existing = await prisma.v3RingGroup.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  const row = await prisma.v3RingGroup.update({
    where: { id },
    data: { removedAt: new Date(), isActive: false },
  });

  await auditService.log(prisma, req, {
    action: 'v3.ringgroup.deleted',
    entityType: 'V3RingGroup',
    entityId: id,
    oldValue: { name: existing.name },
    newValue: { removedAt: row.removedAt },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'ring_group', id, 'delete', { req });

  return serialize(row);
}

module.exports = {
  STRATEGIES,
  listRingGroups,
  getRingGroup,
  createRingGroup,
  updateRingGroup,
  removeRingGroup,
  validateRingGroup,
};
