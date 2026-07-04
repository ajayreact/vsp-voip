/**
 * V3 Device Provisioning Service — generate vendor configs and provision desk phones.
 *
 * Reuses existing provisioning primitives; does not duplicate Telnyx credential logic.
 */

const { randomBytes } = require('crypto');
const { getExtensionSipCredentials } = require('../extensionProvisioning');
const provisioningService = require('./provisioningService');
const deviceService = require('./deviceService');
const deviceTemplateService = require('./deviceTemplateService');
const auditService = require('./auditService');
const { enqueueRuntimeSync } = require('./runtime/runtimeEnqueue');

async function loadAssignmentContext(prisma, tenantId, device) {
  if (!device.extensionId) {
    throw Object.assign(new Error('Device must be assigned to an extension before provisioning'), { status: 400 });
  }

  const extension = await prisma.extension.findFirst({
    where: { id: device.extensionId, tenantId },
    include: { user: { include: { tenant: true } } },
  });
  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });

  const tenant = extension.user?.tenant || await prisma.tenant.findUnique({ where: { id: tenantId } });
  const user = extension.userId
    ? await prisma.user.findUnique({ where: { id: extension.userId } })
    : null;

  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: { extensionId: extension.id, isActive: true },
    select: { id: true, number: true },
  });

  const blfExtensions = await prisma.extension.findMany({
    where: { tenantId, status: 'ACTIVE', id: { not: extension.id } },
    select: { extensionNumber: true, displayName: true },
    take: 10,
    orderBy: { extensionNumber: 'asc' },
  });

  return { tenant, extension, user, phoneNumber, blfExtensions };
}

async function generateDeviceConfig(prisma, tenantId, deviceId, { regenerate = false } = {}) {
  const device = await prisma.v3DeskDevice.findFirst({
    where: { id: deviceId, tenantId, status: { not: 'REMOVED' } },
  });
  if (!device) throw Object.assign(new Error('Device not found'), { status: 404 });

  const { tenant, extension, user, phoneNumber, blfExtensions } = await loadAssignmentContext(prisma, tenantId, device);

  await provisioningService.ensureExtensionProvisioned(prisma, extension, { stage: 'v3-desk-provision' });

  let sipResult = null;
  try {
    sipResult = await getExtensionSipCredentials(prisma, tenantId, extension.id);
  } catch (error) {
    console.warn(`[V3 device provision] SIP credentials unavailable: ${error.message}`);
  }

  const refreshedUser = user?.id
    ? await prisma.user.findUnique({ where: { id: user.id } })
    : user;

  const configVersion = regenerate ? device.configVersion + 1 : device.configVersion;
  const provisionVersion = regenerate ? device.provisionVersion + 1 : device.provisionVersion;

  const context = deviceTemplateService.buildProvisionContext({
    tenant,
    extension,
    user: refreshedUser,
    phoneNumber,
    device: { ...device, configVersion, provisionVersion },
    blfExtensions,
    options: { timezone: tenant?.timezone },
  });

  if (sipResult?.provisioningProfile) {
    context.configExport = sipResult.configExport || context.configExport;
    if (sipResult.provisioningProfile?.sip) {
      context.sip = {
        ...context.sip,
        username: sipResult.provisioningProfile.sip.username || context.sip.username,
        password: sipResult.provisioningProfile.sip.password || context.sip.password,
        authId: sipResult.provisioningProfile.sip.authId || context.sip.authId,
      };
    }
  }

  const metadata = device.metadata && typeof device.metadata === 'object' ? { ...device.metadata } : {};
  const deviceForUrl = { ...device, configVersion, provisionVersion, metadata };
  const config = deviceTemplateService.generateProvisionConfig(device.vendor, context);
  const provisionUrl = deviceTemplateService.buildProvisionUrl(deviceForUrl, device.vendor);

  return { device, context, config, provisionUrl, extension, user: refreshedUser, metadata };
}

async function provisionDevice(prisma, tenantId, deviceId, { regenerate = false } = {}, { req, actor } = {}) {
  const generated = await generateDeviceConfig(prisma, tenantId, deviceId, { regenerate });
  const { device, config, provisionUrl } = generated;

  const existingMeta = device.metadata && typeof device.metadata === 'object' ? device.metadata : {};
  const provisionKey = existingMeta.provisionKey || randomBytes(16).toString('hex');
  const metadata = { ...existingMeta, provisionKey };

  const saved = await prisma.v3DeskDevice.update({
    where: { id: deviceId },
    data: {
      provisionUrl: deviceTemplateService.buildProvisionUrl(
        { ...device, metadata },
        device.vendor,
      ),
      metadata,
      configVersion: config.configVersion,
      provisionVersion: config.provisionVersion,
      lastProvisionedAt: new Date(),
      status: 'PROVISIONED',
      employeeId: generated.user?.id || device.employeeId,
      extensionId: generated.extension?.id || device.extensionId,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.device.provisioned',
    entityType: 'V3DeskDevice',
    entityId: deviceId,
    oldValue: { status: device.status, configVersion: device.configVersion },
    newValue: {
      status: 'PROVISIONED',
      configVersion: config.configVersion,
      provisionVersion: config.provisionVersion,
      vendor: device.vendor,
    },
    extra: { tenantId, extensionId: saved.extensionId, actor: actor?.sub },
  });

  await enqueueRuntimeSync(prisma, tenantId, 'device', deviceId, 'sync', { req });

  const enriched = await deviceService.enrichDevice(prisma, { ...saved, tenant: generated.context?.tenant });

  return {
    device: enriched,
    config,
    provisionUrl: saved.provisionUrl,
    provision: generated.context?.configExport || null,
  };
}

module.exports = {
  loadAssignmentContext,
  generateDeviceConfig,
  provisionDevice,
};
