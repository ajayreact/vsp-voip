/**
 * Voicemail Runtime Adapter — V3VoicemailBox → ExtensionVoicemailSettings.
 */

const { randomUUID } = require('crypto');
const runtimeAdapter = require('./runtimeAdapter');

async function sync(prisma, tenantId, v3EntityId, { action } = {}) {
  const v3 = await prisma.v3VoicemailBox.findFirst({ where: { id: v3EntityId, tenantId } });
  if (!v3) return { ok: false, skipped: true, reason: 'v3_not_found' };
  if (!v3.extensionId) return { ok: true, skipped: true, reason: 'no_extension_link' };

  if (action === 'delete' || v3.removedAt || !v3.isActive) {
    return { ok: true, action: 'skipped_delete', reason: 'non_destructive' };
  }

  const syncHash = runtimeAdapter.hashPayload(v3);
  const greeting = v3.greeting || {};
  const data = {
    enabled: true,
    greetingUrl: greeting.audioUrl || null,
    emailNotifications: Boolean(v3.emailDelivery?.enabled),
    notificationEmail: v3.emailDelivery?.email || null,
  };

  const existing = await prisma.extensionVoicemailSettings.findUnique({
    where: { extensionId: v3.extensionId },
  });

  let settingsId;
  if (existing) {
    await prisma.extensionVoicemailSettings.update({ where: { id: existing.id }, data });
    settingsId = existing.id;
  } else {
    const created = await prisma.extensionVoicemailSettings.create({
      data: { id: randomUUID(), extensionId: v3.extensionId, ...data },
    });
    settingsId = created.id;
  }

  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'voicemail',
    v3EntityId,
    runtimeEntityType: 'ExtensionVoicemailSettings',
    runtimeEntityId: settingsId,
    syncHash,
    metadata: { mailboxNumber: v3.mailboxNumber, extensionId: v3.extensionId },
  });

  return { ok: true, runtimeEntityId: settingsId, syncHash };
}

async function compare(prisma, tenantId, v3EntityId) {
  const v3 = await prisma.v3VoicemailBox.findFirst({
    where: { id: v3EntityId, tenantId, removedAt: null, isActive: true },
  });
  if (!v3?.extensionId) return { level: 'yellow', issue: 'no_extension' };
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'voicemail', v3EntityId);
  if (!link) return { level: 'yellow', issue: 'missing_runtime_link' };
  const settings = await prisma.extensionVoicemailSettings.findUnique({ where: { extensionId: v3.extensionId } });
  if (!settings?.enabled) return { level: 'red', issue: 'missing_runtime' };
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  const check = await compare(prisma, tenantId, v3EntityId);
  if (check.level === 'green') return { repaired: false, reason: 'already_synced' };
  return { repaired: true, result: await sync(prisma, tenantId, v3EntityId) };
}

module.exports = { sync, compare, repair };
