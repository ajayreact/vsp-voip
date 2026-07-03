/**
 * V3 User Preference Service — general UI preferences (JSON blob).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    preferences: row.preferences && typeof row.preferences === 'object' ? row.preferences : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ensureUserInTenant(prisma, tenantId, userId) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
  if (!user) {
    throw Object.assign(new Error('User not found in tenant'), { status: 404, code: 'USER_NOT_FOUND' });
  }
}

async function getPreferences(prisma, tenantId, userId) {
  await ensureUserInTenant(prisma, tenantId, userId);
  let row = await prisma.v3UserPreference.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (!row) {
    row = await prisma.v3UserPreference.create({
      data: { id: randomUUID(), tenantId, userId, preferences: {} },
    });
  }
  return serialize(row);
}

async function updatePreferences(prisma, tenantId, userId, data, { req } = {}) {
  await ensureUserInTenant(prisma, tenantId, userId);
  const incoming = data.preferences && typeof data.preferences === 'object' ? data.preferences : data;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw Object.assign(new Error('preferences must be an object'), { status: 400, code: 'INVALID_PREFERENCES' });
  }

  const existing = await prisma.v3UserPreference.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  const merged = { ...(existing?.preferences || {}), ...incoming };

  let row;
  if (existing) {
    row = await prisma.v3UserPreference.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { preferences: merged },
    });
  } else {
    row = await prisma.v3UserPreference.create({
      data: { id: randomUUID(), tenantId, userId, preferences: merged },
    });
  }

  await auditService.log(prisma, req, {
    action: 'v3.preferences.updated',
    entityType: 'V3UserPreference',
    entityId: row.id,
    oldValue: existing ? serialize(existing) : null,
    newValue: serialize(row),
  });

  return serialize(row);
}

module.exports = {
  serialize,
  getPreferences,
  updatePreferences,
};
