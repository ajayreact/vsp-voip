/**
 * V3 RepairService ("Repair PBX").
 *
 * Promotes the read-only reconciliation logic from
 * scripts/reconcile-tenant-telephony.js into a service. It DETECTS and, only when
 * `apply` is set, REPAIRS missing or inconsistent links. It repairs only missing
 * items and NEVER deletes data, never recreates existing credentials, and never
 * invents ownership.
 *
 * Detected repair types:
 *   MISSING_EXTENSION  employee (TENANT_USER) without any extension → auto-create
 *   MISSING_SECURITY   extension without a security row             → create default
 *   MISSING_FORWARDING extension without a forwarding row           → create default
 *   MISSING_VOICEMAIL  extension without a voicemail settings row   → create default
 *   MISSING_DID_LINK   exactly one DID links here but primary null  → set primary
 *   BROKEN_LINK        DID/extension/user back-links out of sync    → align links
 *   MISSING_CREDENTIAL extension owner lacks Telnyx credential      → provision (idempotent)
 *
 * Observations (reported, never modified): unassigned extensions, ambiguous
 * multi-DID extensions, and live SIP registration state.
 */

const provisioningService = require('./provisioningService');
const extensionService = require('./extensionService');

function makeChange({ type, entity, ref, detail, write }) {
  return { type, entity, ref, detail, write };
}

async function analyze(prisma, tenantId) {
  const [extensions, users, phoneNumbers] = await Promise.all([
    prisma.extension.findMany({
      where: { tenantId },
      include: { user: true, security: true, forwarding: true, voicemailSettings: true, primaryPhoneNumber: true },
      orderBy: { extensionNumber: 'asc' },
    }),
    prisma.user.findMany({ where: { tenantId, role: 'TENANT_USER' } }),
    prisma.phoneNumber.findMany({ where: { tenantId } }),
  ]);

  const phoneById = new Map(phoneNumbers.map((p) => [p.id, p]));
  const phonesByExt = new Map();
  for (const p of phoneNumbers) {
    if (!p.extensionId) continue;
    if (!phonesByExt.has(p.extensionId)) phonesByExt.set(p.extensionId, []);
    phonesByExt.get(p.extensionId).push(p);
  }

  const changes = [];
  const observations = [];
  const extUserIds = new Set(extensions.map((e) => e.userId).filter(Boolean));

  // Employees without any extension → auto-create (also provisions credential).
  for (const user of users) {
    if (!extUserIds.has(user.id)) {
      changes.push(makeChange({
        type: 'MISSING_EXTENSION',
        entity: 'User',
        ref: user.email || user.name,
        detail: 'employee has no extension',
        write: () => extensionService.autoCreateForEmployee(prisma, tenantId, user),
      }));
    }
  }

  for (const ext of extensions) {
    if (!ext.security) {
      changes.push(makeChange({
        type: 'MISSING_SECURITY', entity: 'Extension', ref: ext.extensionNumber,
        detail: 'security row missing',
        write: () => prisma.extensionSecurity.create({ data: { extensionId: ext.id } }),
      }));
    }
    if (!ext.forwarding) {
      changes.push(makeChange({
        type: 'MISSING_FORWARDING', entity: 'Extension', ref: ext.extensionNumber,
        detail: 'forwarding row missing',
        write: () => prisma.extensionForwarding.create({ data: { extensionId: ext.id } }),
      }));
    }
    if (!ext.voicemailSettings) {
      changes.push(makeChange({
        type: 'MISSING_VOICEMAIL', entity: 'Extension', ref: ext.extensionNumber,
        detail: 'voicemail settings row missing',
        write: () => prisma.extensionVoicemailSettings.create({
          data: { extensionId: ext.id, enabled: true, emailNotifications: false, notificationEmail: null },
        }),
      }));
    }

    const linked = phonesByExt.get(ext.id) || [];

    if (!ext.primaryPhoneNumberId && linked.length === 1) {
      const only = linked[0];
      changes.push(makeChange({
        type: 'MISSING_DID_LINK', entity: 'Extension', ref: ext.extensionNumber,
        detail: `link primary DID ${only.number}`,
        write: () => prisma.extension.update({ where: { id: ext.id }, data: { primaryPhoneNumberId: only.id } }),
      }));
    } else if (!ext.primaryPhoneNumberId && linked.length > 1) {
      observations.push(`Extension ${ext.extensionNumber}: ${linked.length} DIDs linked — primary ambiguous, not auto-set.`);
    }

    if (ext.primaryPhoneNumber && ext.primaryPhoneNumber.extensionId !== ext.id) {
      const p = ext.primaryPhoneNumber;
      if (!p.extensionId) {
        changes.push(makeChange({
          type: 'BROKEN_LINK', entity: 'PhoneNumber', ref: p.number,
          detail: `back-link DID to extension ${ext.extensionNumber}`,
          write: () => prisma.phoneNumber.update({ where: { id: p.id }, data: { extensionId: ext.id } }),
        }));
      } else {
        observations.push(`Extension ${ext.extensionNumber}: primary DID ${p.number} linked to another extension — not auto-stolen.`);
      }
    }

    if (ext.userId) {
      const candidates = new Set(linked.map((p) => p.id));
      if (ext.primaryPhoneNumberId) candidates.add(ext.primaryPhoneNumberId);
      for (const phoneId of candidates) {
        const phone = phoneById.get(phoneId);
        if (phone && phone.assignedUserId !== ext.userId) {
          changes.push(makeChange({
            type: 'BROKEN_LINK', entity: 'PhoneNumber', ref: phone.number,
            detail: `align assignedUserId to extension ${ext.extensionNumber} owner`,
            write: () => prisma.phoneNumber.update({ where: { id: phone.id }, data: { assignedUserId: ext.userId } }),
          }));
        }
      }

      const user = ext.user;
      if (user && (!user.telnyxCredentialId || !user.telnyxSipUsername)) {
        changes.push(makeChange({
          type: 'MISSING_CREDENTIAL', entity: 'Extension', ref: ext.extensionNumber,
          detail: `provision Telnyx credential for ${user.email || user.name}`,
          write: () => provisioningService.ensureExtensionProvisioned(prisma, ext, { stage: 'v3.repair' }),
        }));
      }
      if (user && ext.status === 'ACTIVE' && user.sipRegistered !== true) {
        observations.push(`Extension ${ext.extensionNumber}: device not registered (live state — not modified).`);
      }
    } else {
      observations.push(`Extension ${ext.extensionNumber}: no employee assigned (reported, not modified).`);
    }
  }

  return {
    changes,
    observations,
    scanned: {
      extensions: extensions.length,
      users: users.length,
      phoneNumbers: phoneNumbers.length,
    },
  };
}

function publicChange(change) {
  return { type: change.type, entity: change.entity, ref: change.ref, detail: change.detail };
}

async function inspect(prisma, tenantId) {
  const result = await analyze(prisma, tenantId);
  return {
    mode: 'dry-run',
    scanned: result.scanned,
    changes: result.changes.map(publicChange),
    observations: result.observations,
  };
}

async function repair(prisma, tenantId, { apply = false } = {}) {
  const result = await analyze(prisma, tenantId);
  if (!apply) {
    return {
      mode: 'dry-run',
      scanned: result.scanned,
      changes: result.changes.map(publicChange),
      observations: result.observations,
      applied: [],
    };
  }

  const applied = [];
  for (const change of result.changes) {
    try {
      await change.write();
      applied.push({ type: change.type, entity: change.entity, ref: change.ref, ok: true });
    } catch (error) {
      applied.push({ type: change.type, entity: change.entity, ref: change.ref, ok: false, error: error.message });
    }
  }

  return {
    mode: 'apply',
    scanned: result.scanned,
    changes: result.changes.map(publicChange),
    observations: result.observations,
    applied,
  };
}

module.exports = { inspect, repair, analyze };
