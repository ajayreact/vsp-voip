/**
 * Device Runtime Adapter — V3DeskDevice assignment → extension provisioning.
 */

const provisioningService = require('../provisioningService');
const runtimeAdapter = require('./runtimeAdapter');

async function sync(prisma, tenantId, v3EntityId, { action } = {}) {
  const device = await prisma.v3DeskDevice.findFirst({ where: { id: v3EntityId, tenantId } });
  if (!device) return { ok: false, skipped: true, reason: 'device_not_found' };

  if (action === 'delete' || device.removedAt) {
    return { ok: true, action: 'skipped_delete', reason: 'non_destructive' };
  }

  let provision = null;
  if (device.extensionId) {
    const extension = await prisma.extension.findFirst({ where: { id: device.extensionId, tenantId } });
    if (extension) {
      provision = await provisioningService.ensureExtensionProvisioned(prisma, extension, {
        stage: 'v3.runtime-device-sync',
      });
    }
  }

  const syncHash = runtimeAdapter.hashPayload({
    status: device.status,
    extensionId: device.extensionId,
    employeeId: device.employeeId,
    provisioned: provision?.provisioned,
  });

  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'device',
    v3EntityId,
    runtimeEntityType: 'V3DeskDevice',
    runtimeEntityId: device.id,
    syncHash,
    metadata: { vendor: device.vendor, model: device.model, status: device.status },
  });

  return { ok: true, runtimeEntityId: device.id, provision, syncHash };
}

async function compare(prisma, tenantId, v3EntityId) {
  const device = await prisma.v3DeskDevice.findFirst({
    where: { id: v3EntityId, tenantId, removedAt: null },
  });
  if (!device) return { level: 'red', issue: 'missing_device' };
  if (device.extensionId && device.status === 'PROVISIONED') {
    const ext = await prisma.extension.findUnique({
      where: { id: device.extensionId },
      include: { user: { select: { telnyxCredentialId: true } } },
    });
    if (ext?.userId && !ext.user?.telnyxCredentialId) return { level: 'red', issue: 'missing_provisioning' };
  }
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'device', v3EntityId);
  if (!link) return { level: 'yellow', issue: 'missing_runtime_link' };
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  return { repaired: true, result: await sync(prisma, tenantId, v3EntityId) };
}

module.exports = { sync, compare, repair };
