/**
 * V3 Presence Service — configuration-only presence (not connected to runtime).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');

const STATUSES = ['available', 'busy', 'away', 'offline', 'dnd', 'invisible'];

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validatePresence(data) {
  const issues = [];
  const status = String(data.status || 'available').toLowerCase();
  if (!STATUSES.includes(status)) {
    issues.push({ severity: 'error', code: 'INVALID_STATUS', message: `Invalid presence status: ${status}` });
  }
  const errors = issues.filter((i) => i.severity === 'error');
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
}

async function ensureUserInTenant(prisma, tenantId, userId) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
  if (!user) {
    throw Object.assign(new Error('User not found in tenant'), { status: 404, code: 'USER_NOT_FOUND' });
  }
}

async function getPresence(prisma, tenantId, userId) {
  await ensureUserInTenant(prisma, tenantId, userId);
  let row = await prisma.v3PresenceConfig.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (!row) {
    row = await prisma.v3PresenceConfig.create({
      data: { id: randomUUID(), tenantId, userId, status: 'available' },
    });
  }
  return serialize(row);
}

async function updatePresence(prisma, tenantId, userId, data, { req } = {}) {
  await ensureUserInTenant(prisma, tenantId, userId);
  const validation = validatePresence(data);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const existing = await prisma.v3PresenceConfig.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  const patch = {
    status: String(data.status || existing?.status || 'available').toLowerCase(),
    message: data.message !== undefined ? (data.message ? String(data.message) : null) : existing?.message,
  };

  let row;
  if (existing) {
    row = await prisma.v3PresenceConfig.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: patch,
    });
  } else {
    row = await prisma.v3PresenceConfig.create({
      data: { id: randomUUID(), tenantId, userId, ...patch },
    });
  }

  await auditService.log(prisma, req, {
    action: 'v3.presence.changed',
    entityType: 'V3PresenceConfig',
    entityId: row.id,
    oldValue: existing ? serialize(existing) : null,
    newValue: serialize(row),
  });

  return serialize(row);
}

async function listTenantPresence(prisma, tenantId, { limit = 100, offset = 0 } = {}) {
  const [rows, total] = await Promise.all([
    prisma.v3PresenceConfig.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.v3PresenceConfig.count({ where: { tenantId } }),
  ]);
  return { items: rows.map(serialize), total };
}

module.exports = {
  STATUSES,
  serialize,
  validatePresence,
  getPresence,
  updatePresence,
  listTenantPresence,
};
