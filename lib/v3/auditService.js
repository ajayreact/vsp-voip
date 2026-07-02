/**
 * V3 audit service — thin wrapper over lib/auditLog.js.
 *
 * Captures who/when/old/new/IP for every V3 mutation into the existing
 * adminAuditLog table so V3 actions are visible in the same audit trail as the
 * rest of the platform. Never throws (delegates to writeAuditLog which swallows
 * write failures) so auditing can never break a provisioning flow.
 */

const { randomUUID } = require('crypto');
const { writeAuditLog } = require('../auditLog');

function resolveIp(req) {
  if (!req) return null;
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

async function log(prisma, req, {
  action,
  entityType,
  entityId = null,
  oldValue = null,
  newValue = null,
  extra = null,
}) {
  const details = {
    old: oldValue,
    new: newValue,
    ip: resolveIp(req),
    at: new Date().toISOString(),
    ...(extra ? { extra } : {}),
  };
  await writeAuditLog(prisma, req || {}, { action, entityType, entityId, details });
}

/**
 * Same payload as `log`, but propagates write failures so callers inside a Prisma
 * transaction can roll back when auditing fails.
 */
async function logTransactional(prisma, req, {
  action,
  entityType,
  entityId = null,
  oldValue = null,
  newValue = null,
  extra = null,
}) {
  const details = {
    old: oldValue,
    new: newValue,
    ip: resolveIp(req),
    at: new Date().toISOString(),
    ...(extra ? { extra } : {}),
  };
  await prisma.adminAuditLog.create({
    data: {
      id: randomUUID(),
      userId: req?.user?.sub || null,
      userEmail: req?.user?.email || null,
      action,
      entityType,
      entityId: entityId || null,
      details,
    },
  });
}

module.exports = { log, logTransactional };
