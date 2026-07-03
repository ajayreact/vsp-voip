/**
 * V3 Business Hours Service — multiple schedules per tenant (configuration only).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const { enqueueRuntimeSync } = require('./runtime/runtimeEnqueue');

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    timezone: row.timezone,
    weekdays: row.weekdays || {},
    weekends: row.weekends || {},
    lunchBreak: row.lunchBreak,
    closedHours: row.closedHours,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function hasScheduleBlocks(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Object.keys(obj).length > 0;
}

async function validateBusinessHours(prisma, tenantId, data, { excludeId } = {}) {
  const issues = [];
  const name = String(data.name || '').trim();
  if (!name) issues.push({ severity: 'error', code: 'MISSING_NAME', message: 'Schedule name is required' });

  if (!String(data.timezone || '').trim()) {
    issues.push({ severity: 'error', code: 'MISSING_TIMEZONE', message: 'Time zone is required' });
  }

  if (!hasScheduleBlocks(data.weekdays) && !hasScheduleBlocks(data.weekends)) {
    issues.push({ severity: 'error', code: 'MISSING_SCHEDULE', message: 'Weekday or weekend hours must be configured' });
  }

  if (name) {
    const dup = await prisma.v3BusinessHoursSchedule.findFirst({
      where: { tenantId, name, removedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (dup) issues.push({ severity: 'error', code: 'DUPLICATE_NAME', message: 'Schedule name already exists' });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
}

async function listSchedules(prisma, tenantId, { search, limit = 100, offset = 0 } = {}) {
  const where = { tenantId, removedAt: null };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  const [rows, total] = await Promise.all([
    prisma.v3BusinessHoursSchedule.findMany({ where, orderBy: { name: 'asc' }, take: limit, skip: offset }),
    prisma.v3BusinessHoursSchedule.count({ where }),
  ]);
  return { items: rows.map(serialize), total };
}

async function getSchedule(prisma, tenantId, id) {
  const row = await prisma.v3BusinessHoursSchedule.findFirst({ where: { id, tenantId, removedAt: null } });
  return serialize(row);
}

async function createSchedule(prisma, tenantId, data, { req, actor } = {}) {
  const validation = await validateBusinessHours(prisma, tenantId, data);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  if (data.isDefault) {
    await prisma.v3BusinessHoursSchedule.updateMany({
      where: { tenantId, removedAt: null },
      data: { isDefault: false },
    });
  }

  const row = await prisma.v3BusinessHoursSchedule.create({
    data: {
      id: randomUUID(),
      tenantId,
      name: String(data.name).trim(),
      timezone: data.timezone || 'America/New_York',
      weekdays: data.weekdays || {},
      weekends: data.weekends || {},
      lunchBreak: data.lunchBreak || null,
      closedHours: data.closedHours || null,
      isDefault: Boolean(data.isDefault),
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.business_hours.created',
    entityType: 'V3BusinessHoursSchedule',
    entityId: row.id,
    newValue: { name: row.name, timezone: row.timezone },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'business_hours', row.id, 'sync', { req });

  return serialize(row);
}

async function updateSchedule(prisma, tenantId, id, data, { req, actor } = {}) {
  const existing = await prisma.v3BusinessHoursSchedule.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Schedule not found'), { status: 404 });

  const merged = { ...serialize(existing), ...data };
  const validation = await validateBusinessHours(prisma, tenantId, merged, { excludeId: id });
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  if (merged.isDefault) {
    await prisma.v3BusinessHoursSchedule.updateMany({
      where: { tenantId, removedAt: null, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const row = await prisma.v3BusinessHoursSchedule.update({
    where: { id },
    data: {
      name: merged.name,
      timezone: merged.timezone,
      weekdays: merged.weekdays,
      weekends: merged.weekends,
      lunchBreak: merged.lunchBreak,
      closedHours: merged.closedHours,
      isDefault: merged.isDefault,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.business_hours.updated',
    entityType: 'V3BusinessHoursSchedule',
    entityId: id,
    oldValue: { name: existing.name },
    newValue: { name: row.name },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'business_hours', id, 'sync', { req });

  return serialize(row);
}

async function removeSchedule(prisma, tenantId, id, { req, actor } = {}) {
  const existing = await prisma.v3BusinessHoursSchedule.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Schedule not found'), { status: 404 });

  const row = await prisma.v3BusinessHoursSchedule.update({
    where: { id },
    data: { removedAt: new Date(), isDefault: false },
  });

  await auditService.log(prisma, req, {
    action: 'v3.business_hours.deleted',
    entityType: 'V3BusinessHoursSchedule',
    entityId: id,
    oldValue: { name: existing.name },
    newValue: { removedAt: row.removedAt },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'business_hours', id, 'delete', { req });

  return serialize(row);
}

module.exports = {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  removeSchedule,
  validateBusinessHours,
};
