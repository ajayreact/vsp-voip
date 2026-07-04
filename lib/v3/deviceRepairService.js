/**
 * V3 Device Repair Service — detect and fix missing desk phone links.
 *
 * Never deletes devices. Repairs are idempotent.
 */

const deviceTemplateService = require('./deviceTemplateService');
const deviceProvisioningService = require('./deviceProvisioningService');

function makeChange({ type, entity, ref, detail, write }) {
  return { type, entity, ref, detail, write };
}

function publicChange(change) {
  return { type: change.type, entity: change.entity, ref: change.ref, detail: change.detail };
}

async function analyzeDevices(prisma, tenantId) {
  const devices = await prisma.v3DeskDevice.findMany({
    where: { tenantId, status: { not: 'REMOVED' } },
    orderBy: { createdAt: 'asc' },
  });

  const changes = [];
  const observations = [];

  for (const device of devices) {
    const ref = device.macAddress || device.id;

    if (device.extensionId) {
      const extension = await prisma.extension.findFirst({
        where: { id: device.extensionId, tenantId },
        select: { id: true, userId: true, extensionNumber: true },
      });
      if (!extension) {
        changes.push(makeChange({
          type: 'MISSING_EXTENSION',
          entity: 'V3DeskDevice',
          ref,
          detail: 'clear broken extensionId link',
          write: () => prisma.v3DeskDevice.update({
            where: { id: device.id },
            data: { extensionId: null, status: device.employeeId ? 'ASSIGNED' : 'CREATED' },
          }),
        }));
      } else if (extension.userId && device.employeeId !== extension.userId) {
        changes.push(makeChange({
          type: 'MISSING_EMPLOYEE',
          entity: 'V3DeskDevice',
          ref,
          detail: 'align employeeId to extension owner',
          write: () => prisma.v3DeskDevice.update({
            where: { id: device.id },
            data: { employeeId: extension.userId, status: 'ASSIGNED' },
          }),
        }));
      }
    } else if (device.employeeId) {
      changes.push(makeChange({
        type: 'MISSING_EXTENSION',
        entity: 'V3DeskDevice',
        ref,
        detail: 'employee assigned but extension missing',
        write: async () => {
          const extension = await prisma.extension.findFirst({
            where: { tenantId, userId: device.employeeId },
            orderBy: { createdAt: 'asc' },
          });
          if (!extension) {
            observations.push(`Device ${ref}: employee has no extension to link`);
            return null;
          }
          return prisma.v3DeskDevice.update({
            where: { id: device.id },
            data: { extensionId: extension.id, status: 'ASSIGNED' },
          });
        },
      }));
    }

    if (device.extensionId && device.employeeId) {
      const user = await prisma.user.findFirst({
        where: { id: device.employeeId, tenantId },
        select: { telnyxSipUsername: true, telnyxCredentialId: true },
      });
      if (!user?.telnyxSipUsername || !user?.telnyxCredentialId) {
        changes.push(makeChange({
          type: 'MISSING_SIP_CREDENTIAL',
          entity: 'V3DeskDevice',
          ref,
          detail: 're-provision employee SIP credential',
          write: async () => {
            await deviceProvisioningService.provisionDevice(prisma, tenantId, device.id, { regenerate: false });
            return { id: device.id };
          },
        }));
      }
    }

    const vendorOk = deviceTemplateService.SUPPORTED_VENDORS.includes(String(device.vendor || '').toLowerCase());
    if (!vendorOk) {
      observations.push(`Device ${ref}: vendor "${device.vendor}" is not supported`);
    }

    if ((device.status === 'PROVISIONED' || device.status === 'REGISTERED') && !device.provisionUrl) {
      changes.push(makeChange({
        type: 'BROKEN_PROVISION_URL',
        entity: 'V3DeskDevice',
        ref,
        detail: 'regenerate provision URL',
        write: () => prisma.v3DeskDevice.update({
          where: { id: device.id },
          data: { provisionUrl: deviceTemplateService.buildProvisionUrl(device, device.vendor) },
        }),
      }));
    }

    if (device.extensionId && device.lastProvisionedAt) {
      const user = device.employeeId
        ? await prisma.user.findUnique({ where: { id: device.employeeId }, select: { sipRegistered: true } })
        : null;
      const sipDevice = await prisma.extensionDevice.findFirst({
        where: { extensionId: device.extensionId, deviceType: 'SIP' },
        orderBy: { lastRegistrationAt: 'desc' },
      });
      const registered = user?.sipRegistered === true || sipDevice?.status === 'ONLINE';
      if (!registered && device.status === 'REGISTERED') {
        changes.push(makeChange({
          type: 'REGISTRATION_LOST',
          entity: 'V3DeskDevice',
          ref,
          detail: 'mark device as provisioned (registration lost)',
          write: () => prisma.v3DeskDevice.update({
            where: { id: device.id },
            data: { status: 'PROVISIONED' },
          }),
        }));
      } else if (registered && device.status === 'PROVISIONED') {
        changes.push(makeChange({
          type: 'REGISTRATION_RESTORED',
          entity: 'V3DeskDevice',
          ref,
          detail: 'mark device as registered',
          write: () => prisma.v3DeskDevice.update({
            where: { id: device.id },
            data: {
              status: 'REGISTERED',
              lastRegistrationAt: sipDevice?.lastRegistrationAt || new Date(),
            },
          }),
        }));
      }
    }
  }

  return { changes, observations, scanned: { devices: devices.length } };
}

async function inspectDevices(prisma, tenantId) {
  const result = await analyzeDevices(prisma, tenantId);
  return {
    mode: 'dry-run',
    scanned: result.scanned,
    changes: result.changes.map(publicChange),
    observations: result.observations,
  };
}

async function repairDevices(prisma, tenantId, { apply = false, regenerate = false } = {}) {
  const result = await analyzeDevices(prisma, tenantId);

  if (regenerate && apply) {
    const devices = await prisma.v3DeskDevice.findMany({
      where: { tenantId, status: { in: ['ASSIGNED', 'PROVISIONED', 'REGISTERED'] }, extensionId: { not: null } },
    });
    for (const device of devices) {
      try {
        await deviceProvisioningService.provisionDevice(prisma, tenantId, device.id, { regenerate: true });
      } catch (error) {
        result.observations.push(`Re-provision ${device.macAddress || device.id} failed: ${error.message}`);
      }
    }
  }

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

module.exports = {
  analyzeDevices,
  inspectDevices,
  repairDevices,
};
