/**
 * V3 Restore Service — preview, dry-run, and non-destructive apply for V3 configuration.
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const backupService = require('./backupService');

const V3_RESTORE_MODELS = [
  { key: 'ringGroups', path: 'pbx.ringGroups', model: 'v3RingGroup', match: (r) => r.name },
  { key: 'queues', path: 'pbx.queues', model: 'v3Queue', match: (r) => r.name },
  { key: 'businessHours', path: 'pbx.businessHours', model: 'v3BusinessHoursSchedule', match: (r) => r.name },
  { key: 'holidays', path: 'pbx.holidays', model: 'v3Holiday', match: (r) => `${r.name}:${r.date}` },
  { key: 'voicemailBoxes', path: 'pbx.voicemailBoxes', model: 'v3VoicemailBox', match: (r) => r.mailboxNumber },
  { key: 'callFlows', path: 'callFlows', model: 'v3CallFlow', match: (r) => r.name },
  { key: 'softphoneProfiles', path: 'softphone.profiles', model: 'v3SoftphoneProfile', match: (r) => r.userId },
];

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function stripMeta(row) {
  const { createdAt, updatedAt, tenant, tenantId, ...rest } = row;
  return rest;
}

async function resolvePayload(prisma, tenantId, { backupId, payload }) {
  if (payload) return payload;
  if (!backupId) {
    throw Object.assign(new Error('backupId or payload required'), { status: 400 });
  }
  const backup = await backupService.getBackup(prisma, tenantId, backupId);
  if (!backup) {
    throw Object.assign(new Error('Backup not found'), { status: 404 });
  }
  return backup.payload;
}

async function buildDiff(prisma, tenantId, incoming) {
  const current = await backupService.collectConfiguration(prisma, tenantId);
  const changes = [];

  for (const spec of V3_RESTORE_MODELS) {
    const incomingRows = getPath(incoming, spec.path) || [];
    const currentRows = getPath(current, spec.path) || [];
    const currentKeys = new Set(currentRows.map((r) => spec.match(r)));

    for (const row of incomingRows) {
      const key = spec.match(row);
      changes.push({
        entity: spec.key,
        action: currentKeys.has(key) ? 'update' : 'create',
        key,
        id: row.id,
      });
    }
  }

  const summary = {
    creates: changes.filter((c) => c.action === 'create').length,
    updates: changes.filter((c) => c.action === 'update').length,
    skippedDeletes: 0,
  };

  return { changes, summary, currentCounts: backupService.countItems(current), incomingCounts: backupService.countItems(incoming) };
}

async function restorePreview(prisma, tenantId, options) {
  const payload = await resolvePayload(prisma, tenantId, options);
  if (payload?.tenantId && String(payload.tenantId) !== String(tenantId)) {
    throw Object.assign(new Error('Backup payload tenantId does not match target tenant'), { status: 400, code: 'TENANT_MISMATCH' });
  }
  if (!payload || payload.version !== backupService.BACKUP_VERSION) {
    throw Object.assign(new Error('Unsupported backup version'), { status: 400 });
  }
  const diff = await buildDiff(prisma, tenantId, payload);
  return {
    valid: true,
    preview: true,
    dryRun: true,
    ...diff,
    warnings: ['Restore never deletes existing records silently. Only creates and updates V3 configuration objects.'],
  };
}

async function applyRestore(prisma, tenantId, options, { req, dryRun = false } = {}) {
  const payload = await resolvePayload(prisma, tenantId, options);
  if (payload?.tenantId && String(payload.tenantId) !== String(tenantId)) {
    throw Object.assign(new Error('Backup payload tenantId does not match target tenant'), { status: 400, code: 'TENANT_MISMATCH' });
  }
  const preview = await buildDiff(prisma, tenantId, payload);

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      applied: [],
      ...preview,
    };
  }

  const applied = [];

  for (const spec of V3_RESTORE_MODELS) {
    const rows = getPath(payload, spec.path) || [];
    for (const row of rows) {
      const data = stripMeta(row);
      const existing = await prisma[spec.model].findFirst({
        where: {
          tenantId,
          id: row.id,
          removedAt: null,
        },
      });

      if (existing) {
        await prisma[spec.model].update({
          where: { id: existing.id },
          data: { ...data, tenantId, id: existing.id },
        });
        applied.push({ entity: spec.key, action: 'update', id: existing.id });
      } else {
        const id = row.id || randomUUID();
        await prisma[spec.model].create({
          data: { ...data, id, tenantId },
        });
        applied.push({ entity: spec.key, action: 'create', id });
      }
    }
  }

  await auditService.log(prisma, req, {
    action: 'v3.backup.restored',
    entityType: 'V3TenantBackup',
    entityId: options.backupId || null,
    newValue: { applied: applied.length, summary: preview.summary },
  });

  return {
    ok: true,
    dryRun: false,
    applied,
    summary: preview.summary,
  };
}

module.exports = {
  restorePreview,
  applyRestore,
  buildDiff,
};
