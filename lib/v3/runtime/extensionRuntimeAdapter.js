/**
 * Extension Runtime Adapter — ensures legacy extension provisioning via pbxRebuild hook.
 */

const provisioningService = require('../provisioningService');
const runtimeAdapter = require('./runtimeAdapter');

async function sync(prisma, tenantId, v3EntityId, { action } = {}) {
  const extension = await prisma.extension.findFirst({
    where: { id: v3EntityId, tenantId },
    include: { user: { select: { id: true, telnyxSipUsername: true, telnyxCredentialId: true } } },
  });
  if (!extension) return { ok: false, skipped: true, reason: 'extension_not_found' };

  const provision = await provisioningService.ensureExtensionProvisioned(prisma, extension, {
    stage: 'v3.runtime-sync',
  });

  const syncHash = runtimeAdapter.hashPayload({
    extensionNumber: extension.extensionNumber,
    userId: extension.userId,
    provisioned: provision.provisioned,
  });

  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'extension',
    v3EntityId,
    runtimeEntityType: 'Extension',
    runtimeEntityId: extension.id,
    syncHash,
    metadata: { provisioned: provision.provisioned },
  });

  return { ok: true, runtimeEntityId: extension.id, provision, syncHash };
}

async function compare(prisma, tenantId, v3EntityId) {
  const extension = await prisma.extension.findFirst({
    where: { id: v3EntityId, tenantId, status: 'ACTIVE' },
    include: { user: { select: { telnyxCredentialId: true, telnyxSipUsername: true } } },
  });
  if (!extension) return { level: 'red', issue: 'missing_extension' };
  if (extension.userId && !extension.user?.telnyxCredentialId) {
    return { level: 'red', issue: 'missing_credential' };
  }
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'extension', v3EntityId);
  if (!link) return { level: 'yellow', issue: 'missing_runtime_link' };
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  return { repaired: true, result: await sync(prisma, tenantId, v3EntityId) };
}

module.exports = { sync, compare, repair };
