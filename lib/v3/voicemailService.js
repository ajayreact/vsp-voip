/**
 * V3 Voicemail Box Service — mailbox configuration (no message storage integration).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    mailboxNumber: row.mailboxNumber,
    extensionId: row.extensionId,
    greeting: row.greeting,
    emailDelivery: row.emailDelivery,
    pin: row.pin ? '****' : null,
    hasPin: Boolean(row.pin),
    storageLimitMb: row.storageLimitMb,
    notification: row.notification,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function validateVoicemailBox(prisma, tenantId, data, { excludeId } = {}) {
  const issues = [];
  const mailboxNumber = String(data.mailboxNumber || '').trim();
  if (!mailboxNumber) {
    issues.push({ severity: 'error', code: 'MISSING_MAILBOX', message: 'Mailbox number is required' });
  }

  if (data.extensionId) {
    const ext = await prisma.extension.findFirst({ where: { id: data.extensionId, tenantId }, select: { id: true } });
    if (!ext) issues.push({ severity: 'error', code: 'INVALID_EXTENSION', message: 'Linked extension not found' });
  }

  const greeting = data.greeting;
  if (!greeting?.text && !greeting?.audioUrl) {
    issues.push({ severity: 'warning', code: 'MISSING_GREETING', message: 'No greeting text or audio configured' });
  }

  if (mailboxNumber) {
    const dup = await prisma.v3VoicemailBox.findFirst({
      where: { tenantId, mailboxNumber, removedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (dup) issues.push({ severity: 'error', code: 'DUPLICATE_MAILBOX', message: 'Mailbox number already exists' });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
}

async function listVoicemailBoxes(prisma, tenantId, { search, limit = 100, offset = 0 } = {}) {
  const where = { tenantId, removedAt: null };
  if (search) where.mailboxNumber = { contains: search, mode: 'insensitive' };
  const [rows, total] = await Promise.all([
    prisma.v3VoicemailBox.findMany({ where, orderBy: { mailboxNumber: 'asc' }, take: limit, skip: offset }),
    prisma.v3VoicemailBox.count({ where }),
  ]);
  return { items: rows.map(serialize), total };
}

async function getVoicemailBox(prisma, tenantId, id) {
  const row = await prisma.v3VoicemailBox.findFirst({ where: { id, tenantId, removedAt: null } });
  return serialize(row);
}

async function createVoicemailBox(prisma, tenantId, data, { req, actor } = {}) {
  const validation = await validateVoicemailBox(prisma, tenantId, data);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const row = await prisma.v3VoicemailBox.create({
    data: {
      id: randomUUID(),
      tenantId,
      mailboxNumber: String(data.mailboxNumber).trim(),
      extensionId: data.extensionId || null,
      greeting: data.greeting || null,
      emailDelivery: data.emailDelivery || null,
      pin: data.pin || null,
      storageLimitMb: Number(data.storageLimitMb) || 100,
      notification: data.notification || null,
      isActive: data.isActive !== false,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.voicemail.created',
    entityType: 'V3VoicemailBox',
    entityId: row.id,
    newValue: { mailboxNumber: row.mailboxNumber },
    extra: { tenantId, actor: actor?.sub },
  });

  return serialize(row);
}

async function updateVoicemailBox(prisma, tenantId, id, data, { req, actor } = {}) {
  const existing = await prisma.v3VoicemailBox.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Voicemail box not found'), { status: 404 });

  const merged = { ...serialize(existing), ...data, pin: data.pin !== undefined ? data.pin : existing.pin };
  const validation = await validateVoicemailBox(prisma, tenantId, merged, { excludeId: id });
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const row = await prisma.v3VoicemailBox.update({
    where: { id },
    data: {
      mailboxNumber: merged.mailboxNumber,
      extensionId: merged.extensionId,
      greeting: merged.greeting,
      emailDelivery: merged.emailDelivery,
      pin: merged.pin,
      storageLimitMb: merged.storageLimitMb,
      notification: merged.notification,
      isActive: merged.isActive,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.voicemail.updated',
    entityType: 'V3VoicemailBox',
    entityId: id,
    oldValue: { mailboxNumber: existing.mailboxNumber },
    newValue: { mailboxNumber: row.mailboxNumber },
    extra: { tenantId, actor: actor?.sub },
  });

  return serialize(row);
}

async function removeVoicemailBox(prisma, tenantId, id, { req, actor } = {}) {
  const existing = await prisma.v3VoicemailBox.findFirst({ where: { id, tenantId, removedAt: null } });
  if (!existing) throw Object.assign(new Error('Voicemail box not found'), { status: 404 });

  const row = await prisma.v3VoicemailBox.update({
    where: { id },
    data: { removedAt: new Date(), isActive: false },
  });

  await auditService.log(prisma, req, {
    action: 'v3.voicemail.deleted',
    entityType: 'V3VoicemailBox',
    entityId: id,
    oldValue: { mailboxNumber: existing.mailboxNumber },
    newValue: { removedAt: row.removedAt },
    extra: { tenantId, actor: actor?.sub },
  });

  return serialize(row);
}

module.exports = {
  listVoicemailBoxes,
  getVoicemailBox,
  createVoicemailBox,
  updateVoicemailBox,
  removeVoicemailBox,
  validateVoicemailBox,
};
