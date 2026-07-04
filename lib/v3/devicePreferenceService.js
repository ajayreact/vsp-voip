/**
 * V3 Device Preference Service — per-device UX settings (no SIP/WebRTC).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');

const DEVICE_TYPES = ['desktop', 'laptop', 'desk_phone', 'mobile', 'tablet'];
const NOTIFICATION_PREFS = ['all', 'calls_only', 'none'];
const RING_PREFS = ['default', 'silent', 'vibrate', 'custom'];

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    deviceType: row.deviceType,
    deviceAlias: row.deviceAlias,
    lastActiveAt: row.lastActiveAt,
    preferred: row.preferred,
    notificationPreference: row.notificationPreference,
    ringPreference: row.ringPreference,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validateDevicePreference(data) {
  const issues = [];
  const deviceType = String(data.deviceType || '').toLowerCase();
  if (!DEVICE_TYPES.includes(deviceType)) {
    issues.push({ severity: 'error', code: 'INVALID_DEVICE_TYPE', message: `Invalid device type: ${deviceType}` });
  }
  if (data.notificationPreference && !NOTIFICATION_PREFS.includes(data.notificationPreference)) {
    issues.push({ severity: 'error', code: 'INVALID_NOTIFICATION', message: 'Invalid notification preference' });
  }
  if (data.ringPreference && !RING_PREFS.includes(data.ringPreference)) {
    issues.push({ severity: 'error', code: 'INVALID_RING', message: 'Invalid ring preference' });
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

function deviceKey(deviceType, deviceAlias) {
  return `${deviceType}::${deviceAlias || ''}`;
}

async function listDevicePreferences(prisma, tenantId, userId) {
  await ensureUserInTenant(prisma, tenantId, userId);
  const rows = await prisma.v3DevicePreference.findMany({
    where: { tenantId, userId },
    orderBy: [{ preferred: 'desc' }, { lastActiveAt: 'desc' }],
  });
  return { items: rows.map(serialize), total: rows.length };
}

async function upsertDevicePreference(prisma, tenantId, userId, data, { req } = {}) {
  await ensureUserInTenant(prisma, tenantId, userId);
  const validation = validateDevicePreference(data);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const deviceType = String(data.deviceType).toLowerCase();
  const deviceAlias = data.deviceAlias ? String(data.deviceAlias) : '';

  const existing = await prisma.v3DevicePreference.findFirst({
    where: { tenantId, userId, deviceType, deviceAlias: deviceAlias || null },
  });

  if (data.preferred === true) {
    await prisma.v3DevicePreference.updateMany({
      where: { tenantId, userId, preferred: true },
      data: { preferred: false },
    });
  }

  const patch = {
    deviceType,
    deviceAlias,
    notificationPreference: data.notificationPreference || existing?.notificationPreference || 'all',
    ringPreference: data.ringPreference || existing?.ringPreference || 'default',
    preferred: data.preferred === true,
    metadata: data.metadata && typeof data.metadata === 'object'
      ? { ...(existing?.metadata || {}), ...data.metadata }
      : (existing?.metadata || {}),
  };
  if (data.lastActiveAt !== undefined) patch.lastActiveAt = data.lastActiveAt ? new Date(data.lastActiveAt) : null;
  if (data.lastActiveAt === undefined && !existing) patch.lastActiveAt = new Date();

  let row;
  if (existing) {
    row = await prisma.v3DevicePreference.update({ where: { id: existing.id }, data: patch });
  } else {
    row = await prisma.v3DevicePreference.create({
      data: { id: randomUUID(), tenantId, userId, ...patch },
    });
  }

  await auditService.log(prisma, req, {
    action: 'v3.device_preference.updated',
    entityType: 'V3DevicePreference',
    entityId: row.id,
    oldValue: existing ? serialize(existing) : null,
    newValue: serialize(row),
  });

  return serialize(row);
}

async function touchLastActive(prisma, tenantId, userId, deviceType, deviceAlias, { req } = {}) {
  return upsertDevicePreference(prisma, tenantId, userId, {
    deviceType,
    deviceAlias,
    lastActiveAt: new Date(),
  }, { req });
}

module.exports = {
  DEVICE_TYPES,
  NOTIFICATION_PREFS,
  RING_PREFS,
  serialize,
  validateDevicePreference,
  listDevicePreferences,
  upsertDevicePreference,
  touchLastActive,
  deviceKey,
};
