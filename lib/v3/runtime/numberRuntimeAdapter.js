/**
 * Number Runtime Adapter — validates PhoneNumber ↔ Extension runtime links.
 */

const provisioningService = require('../provisioningService');
const runtimeAdapter = require('./runtimeAdapter');

async function sync(prisma, tenantId, v3EntityId, { action } = {}) {
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: v3EntityId, tenantId },
    include: { extension: true },
  });
  if (!phone) return { ok: false, skipped: true, reason: 'number_not_found' };

  const changes = [];
  if (phone.extensionId && phone.extension) {
    if (phone.extension.primaryPhoneNumberId !== phone.id) {
      await prisma.extension.update({
        where: { id: phone.extensionId },
        data: { primaryPhoneNumberId: phone.id },
      });
      changes.push('primary_phone_linked');
    }
    if (phone.extension.userId && phone.assignedUserId !== phone.extension.userId) {
      await prisma.phoneNumber.update({
        where: { id: phone.id },
        data: { assignedUserId: phone.extension.userId },
      });
      changes.push('assigned_user_aligned');
    }
    await provisioningService.ensureExtensionProvisioned(prisma, phone.extension, {
      stage: 'v3.runtime-number-sync',
    });
  }

  const syncHash = runtimeAdapter.hashPayload({
    number: phone.number,
    extensionId: phone.extensionId,
    routingType: phone.routingType,
    ringGroupId: phone.ringGroupId,
  });

  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'number',
    v3EntityId,
    runtimeEntityType: 'PhoneNumber',
    runtimeEntityId: phone.id,
    syncHash,
    metadata: { number: phone.number, changes },
  });

  return { ok: true, runtimeEntityId: phone.id, changes, syncHash };
}

async function compare(prisma, tenantId, v3EntityId) {
  const phone = await prisma.phoneNumber.findFirst({ where: { id: v3EntityId, tenantId } });
  if (!phone) return { level: 'red', issue: 'missing_number' };
  if (phone.extensionId) {
    const ext = await prisma.extension.findUnique({ where: { id: phone.extensionId } });
    if (!ext) return { level: 'red', issue: 'broken_extension_ref' };
    if (ext.primaryPhoneNumberId && ext.primaryPhoneNumberId !== phone.id) {
      return { level: 'yellow', issue: 'primary_mismatch' };
    }
  }
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'number', v3EntityId);
  if (!link) return { level: 'yellow', issue: 'missing_runtime_link' };
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  return { repaired: true, result: await sync(prisma, tenantId, v3EntityId) };
}

module.exports = { sync, compare, repair };
