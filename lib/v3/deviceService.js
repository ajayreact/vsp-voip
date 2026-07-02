/**
 * V3 Device Service — desk phone inventory CRUD and assignment.
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const deviceTemplateService = require('./deviceTemplateService');

const DEVICE_INCLUDE = {
  tenant: { select: { id: true, name: true, timezone: true } },
};

function normalizeMac(mac) {
  if (!mac) return null;
  return String(mac).trim().toUpperCase().replace(/[^A-F0-9]/gi, '');
}

async function loadExtensionPhone(prisma, extensionId) {
  if (!extensionId) return null;
  return prisma.phoneNumber.findFirst({
    where: { extensionId, isActive: true },
    select: { id: true, number: true },
  });
}

async function enrichDevice(prisma, device) {
  const tenant = device.tenant || await prisma.tenant.findUnique({
    where: { id: device.tenantId },
    select: { id: true, name: true, timezone: true },
  });

  const [employee, extension, phone] = await Promise.all([
    device.employeeId
      ? prisma.user.findUnique({
        where: { id: device.employeeId },
        select: {
          id: true, name: true, email: true,
          telnyxSipUsername: true, sipRegistered: true, sipRegistrationCheckedAt: true,
        },
      })
      : null,
    device.extensionId
      ? prisma.extension.findUnique({
        where: { id: device.extensionId },
        select: { id: true, extensionNumber: true, displayName: true, userId: true, sipEnabled: true },
      })
      : null,
    loadExtensionPhone(prisma, device.extensionId),
  ]);

  let sipDevice = null;
  if (device.extensionId) {
    sipDevice = await prisma.extensionDevice.findFirst({
      where: { extensionId: device.extensionId, deviceType: 'SIP' },
      orderBy: { lastRegistrationAt: 'desc' },
    });
  }

  const registrationStatus = deriveRegistrationStatus(employee, sipDevice, device);

  return serializeDevice({ ...device, tenant }, { employee, extension, phone, sipDevice, registrationStatus });
}

function deriveRegistrationStatus(employee, sipDevice, device) {
  if (employee?.sipRegistered === true || sipDevice?.status === 'ONLINE') {
    return 'registered';
  }
  if (device.status === 'PROVISIONED' || device.lastProvisionedAt) {
    return 'offline';
  }
  return 'never';
}

function serializeDevice(device, { employee, extension, phone, sipDevice, registrationStatus } = {}) {
  return {
    id: device.id,
    tenantId: device.tenantId,
    tenantName: device.tenant?.name || null,
    vendor: device.vendor,
    model: device.model,
    macAddress: device.macAddress,
    serialNumber: device.serialNumber,
    firmwareVersion: device.firmwareVersion,
    employeeId: device.employeeId,
    employeeName: employee?.name || null,
    extensionId: device.extensionId,
    extensionNumber: extension?.extensionNumber || null,
    did: phone?.number || null,
    sipUsername: employee?.telnyxSipUsername || null,
    status: device.status,
    registrationStatus: registrationStatus || 'never',
    lastRegistrationAt: sipDevice?.lastRegistrationAt || employee?.sipRegistrationCheckedAt || device.lastRegistrationAt,
    lastSeenAt: device.lastSeenAt || sipDevice?.lastRegistrationAt || null,
    lastProvisionedAt: device.lastProvisionedAt,
    provisionUrl: device.provisionUrl,
    configVersion: device.configVersion,
    provisionVersion: device.provisionVersion,
    notes: device.notes,
    metadata: device.metadata,
    removedAt: device.removedAt,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

async function listDevices(prisma, tenantId, { search, status, includeRemoved = false, limit = 100, offset = 0 } = {}) {
  const where = { tenantId };
  if (!includeRemoved) where.status = { not: 'REMOVED' };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { macAddress: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { vendor: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.v3DeskDevice.findMany({
      where,
      include: DEVICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.v3DeskDevice.count({ where }),
  ]);

  const items = await Promise.all(rows.map((row) => enrichDevice(prisma, row)));
  return { items, total };
}

async function getDevice(prisma, tenantId, deviceId) {
  const device = await prisma.v3DeskDevice.findFirst({
    where: { id: deviceId, tenantId, status: { not: 'REMOVED' } },
    include: DEVICE_INCLUDE,
  });
  if (!device) return null;
  return enrichDevice(prisma, device);
}

async function createDevice(prisma, tenantId, data, { req, actor } = {}) {
  const vendor = deviceTemplateService.assertVendor(data.vendor);
  const macAddress = normalizeMac(data.macAddress);

  if (macAddress) {
    const existing = await prisma.v3DeskDevice.findFirst({
      where: { tenantId, macAddress, status: { not: 'REMOVED' } },
    });
    if (existing) {
      throw Object.assign(new Error('A device with this MAC address already exists'), { status: 409 });
    }
  }

  const device = await prisma.v3DeskDevice.create({
    data: {
      id: randomUUID(),
      tenantId,
      vendor,
      model: data.model || null,
      macAddress,
      serialNumber: data.serialNumber || null,
      firmwareVersion: data.firmwareVersion || null,
      notes: data.notes || null,
      metadata: data.metadata || {},
      status: 'CREATED',
    },
    include: DEVICE_INCLUDE,
  });

  await auditService.log(prisma, req, {
    action: 'v3.device.added',
    entityType: 'V3DeskDevice',
    entityId: device.id,
    newValue: { vendor, macAddress, model: device.model },
    extra: { tenantId, actor: actor?.sub },
  });

  return enrichDevice(prisma, device);
}

async function updateDevice(prisma, tenantId, deviceId, data, { req, actor } = {}) {
  const existing = await prisma.v3DeskDevice.findFirst({
    where: { id: deviceId, tenantId, status: { not: 'REMOVED' } },
    include: DEVICE_INCLUDE,
  });
  if (!existing) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  const updates = {};
  if (data.vendor) updates.vendor = deviceTemplateService.assertVendor(data.vendor);
  if (data.model !== undefined) updates.model = data.model || null;
  if (data.serialNumber !== undefined) updates.serialNumber = data.serialNumber || null;
  if (data.firmwareVersion !== undefined) updates.firmwareVersion = data.firmwareVersion || null;
  if (data.notes !== undefined) updates.notes = data.notes || null;
  if (data.metadata !== undefined) updates.metadata = data.metadata;

  if (data.macAddress !== undefined) {
    const macAddress = normalizeMac(data.macAddress);
    if (macAddress) {
      const dup = await prisma.v3DeskDevice.findFirst({
        where: { tenantId, macAddress, id: { not: deviceId }, status: { not: 'REMOVED' } },
      });
      if (dup) throw Object.assign(new Error('A device with this MAC address already exists'), { status: 409 });
    }
    updates.macAddress = macAddress;
  }

  if (data.employeeId !== undefined || data.extensionId !== undefined) {
    return assignDevice(prisma, tenantId, deviceId, {
      employeeId: data.employeeId,
      extensionId: data.extensionId,
    }, { req, actor });
  }

  const saved = await prisma.v3DeskDevice.update({
    where: { id: deviceId },
    data: updates,
    include: DEVICE_INCLUDE,
  });

  await auditService.log(prisma, req, {
    action: 'v3.device.updated',
    entityType: 'V3DeskDevice',
    entityId: deviceId,
    oldValue: { vendor: existing.vendor, model: existing.model, macAddress: existing.macAddress },
    newValue: updates,
    extra: { tenantId, actor: actor?.sub },
  });

  return enrichDevice(prisma, saved);
}

async function assignDevice(prisma, tenantId, deviceId, { employeeId, extensionId }, { req, actor } = {}) {
  const device = await prisma.v3DeskDevice.findFirst({
    where: { id: deviceId, tenantId, status: { not: 'REMOVED' } },
    include: DEVICE_INCLUDE,
  });
  if (!device) throw Object.assign(new Error('Device not found'), { status: 404 });

  let extId = extensionId || device.extensionId;
  let empId = employeeId || device.employeeId;

  if (extId) {
    const extension = await prisma.extension.findFirst({
      where: { id: extId, tenantId },
      select: { id: true, userId: true, extensionNumber: true },
    });
    if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });
    extId = extension.id;
    if (!empId && extension.userId) empId = extension.userId;
  }

  if (empId) {
    const employee = await prisma.user.findFirst({
      where: { id: empId, tenantId },
      select: { id: true },
    });
    if (!employee) throw Object.assign(new Error('Employee not found'), { status: 404 });
    empId = employee.id;
  }

  const oldValue = { employeeId: device.employeeId, extensionId: device.extensionId, status: device.status };
  const saved = await prisma.v3DeskDevice.update({
    where: { id: deviceId },
    data: {
      employeeId: empId || null,
      extensionId: extId || null,
      status: (empId || extId) ? 'ASSIGNED' : device.status,
    },
    include: DEVICE_INCLUDE,
  });

  await auditService.log(prisma, req, {
    action: 'v3.device.assigned',
    entityType: 'V3DeskDevice',
    entityId: deviceId,
    oldValue,
    newValue: { employeeId: saved.employeeId, extensionId: saved.extensionId, status: saved.status },
    extra: { tenantId, actor: actor?.sub },
  });

  return enrichDevice(prisma, saved);
}

async function removeDevice(prisma, tenantId, deviceId, { req, actor } = {}) {
  const device = await prisma.v3DeskDevice.findFirst({
    where: { id: deviceId, tenantId, status: { not: 'REMOVED' } },
  });
  if (!device) throw Object.assign(new Error('Device not found'), { status: 404 });

  const saved = await prisma.v3DeskDevice.update({
    where: { id: deviceId },
    data: { status: 'REMOVED', removedAt: new Date() },
    include: DEVICE_INCLUDE,
  });

  await auditService.log(prisma, req, {
    action: 'v3.device.removed',
    entityType: 'V3DeskDevice',
    entityId: deviceId,
    oldValue: { status: device.status, macAddress: device.macAddress },
    newValue: { status: 'REMOVED' },
    extra: { tenantId, actor: actor?.sub },
  });

  return enrichDevice(prisma, saved);
}

module.exports = {
  listDevices,
  getDevice,
  createDevice,
  updateDevice,
  assignDevice,
  removeDevice,
  enrichDevice,
  serializeDevice,
  deriveRegistrationStatus,
};
