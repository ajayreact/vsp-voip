/**
 * V3 Holiday Service — holiday calendar entries (configuration only).
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
    date: row.date,
    recurring: row.recurring,
    oneTime: row.oneTime,
    overrideDestination: row.overrideDestination,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function validateHoliday(prisma, tenantId, data) {
  const issues = [];
  const name = String(data.name || '').trim();
  const date = String(data.date || '').trim();

  if (!name) issues.push({ severity: 'error', code: 'MISSING_NAME', message: 'Holiday name is required' });
  if (!date) issues.push({ severity: 'error', code: 'MISSING_DATE', message: 'Holiday date is required' });

  if (data.recurring && data.oneTime) {
    issues.push({ severity: 'warning', code: 'CONFLICTING_TYPE', message: 'Holiday marked as both recurring and one-time' });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
}

async function listHolidays(prisma, tenantId, { search, limit = 100, offset = 0 } = {}) {
  const where = { tenantId, removedAt: null };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  const [rows, total] = await Promise.all([
    prisma.v3Holiday.findMany({ where, orderBy: { date: 'asc' }, take: limit, skip: offset }),
    prisma.v3Holiday.count({ where }),
  ]);
  return { items: rows.map(serialize), total };
}

async function getHoliday(prisma, tenantId, id) {
  const row = await prisma.v3Holiday.findFirst({ where: { id, tenantId, removedAt: null } });
  return serialize(row);
}

async function createHoliday(prisma, tenantId, data, { req, actor } = {}) {
  const validation = await validateHoliday(prisma, tenantId, data);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const row = await prisma.v3Holiday.create({
    data: {
      id: randomUUID(),
      tenantId,
      name: String(data.name).trim(),
      date: String(data.date).trim(),
      recurring: Boolean(data.recurring),
      oneTime: data.oneTime !== false,
      overrideDestination: data.overrideDestination || null,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.holiday.created',
    entityType: 'V3Holiday',
    entityId: row.id,
    newValue: { name: row.name, date: row.date },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'holiday', row.id, 'sync', { req });

  return serialize(row);
}

async function updateHoliday(prisma, tenantId, id, data, { req, actor } = {}) {
  const existing = await prisma.v3Holiday.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Holiday not found'), { status: 404 });

  const merged = { ...serialize(existing), ...data };
  const validation = await validateHoliday(prisma, tenantId, merged);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const row = await prisma.v3Holiday.update({
    where: { id },
    data: {
      name: merged.name,
      date: merged.date,
      recurring: merged.recurring,
      oneTime: merged.oneTime,
      overrideDestination: merged.overrideDestination,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.holiday.updated',
    entityType: 'V3Holiday',
    entityId: id,
    oldValue: { name: existing.name, date: existing.date },
    newValue: { name: row.name, date: row.date },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'holiday', id, 'sync', { req });

  return serialize(row);
}

async function removeHoliday(prisma, tenantId, id, { req, actor } = {}) {
  const existing = await prisma.v3Holiday.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Holiday not found'), { status: 404 });

  const row = await prisma.v3Holiday.update({
    where: { id },
    data: { removedAt: new Date() },
  });

  await auditService.log(prisma, req, {
    action: 'v3.holiday.deleted',
    entityType: 'V3Holiday',
    entityId: id,
    oldValue: { name: existing.name },
    newValue: { removedAt: row.removedAt },
    extra: { tenantId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'holiday', id, 'delete', { req });

  return serialize(row);
}

module.exports = {
  listHolidays,
  getHoliday,
  createHoliday,
  updateHoliday,
  removeHoliday,
  validateHoliday,
};
