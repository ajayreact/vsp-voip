/**
 * V3 Assignment Service — transactional tenant / employee / extension assignment.
 *
 * Super Admin: inventory → tenant (reuses adminDidManagement.assignDidToTenant).
 * Tenant Admin: tenant number → employee → extension (single Prisma transaction).
 */

const { assignDidToTenant, unassignDidFromTenant, recordDidAssignmentHistory } = require('../adminDidManagement');
const telnyxNumberService = require('./telnyxNumberService');
const provisioningService = require('./provisioningService');
const inventoryHealthService = require('./inventoryHealthService');
const auditService = require('./auditService');

async function assignNumberToTenant(prisma, {
  phoneNumberId,
  tenantId,
  assignedByUserId,
  notes,
}, req) {
  const apiKey = telnyxNumberService.getApiKey();
  const before = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
  const saved = await assignDidToTenant(prisma, {
    phoneNumberId,
    tenantId,
    assignedByUserId,
    apiKey,
  });

  await auditService.log(prisma, req, {
    action: 'v3.number.assigned_tenant',
    entityType: 'PhoneNumber',
    entityId: phoneNumberId,
    oldValue: { tenantId: before?.tenantId || null },
    newValue: { tenantId, number: saved.number, notes },
  });

  return saved;
}

async function unassignNumberFromTenant(prisma, phoneNumberId, actor, req) {
  const before = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
  const updated = await unassignDidFromTenant(prisma, phoneNumberId, {
    assignedByUserId: actor.sub || actor.userId || null,
  });

  await auditService.log(prisma, req, {
    action: 'v3.number.unassigned_tenant',
    entityType: 'PhoneNumber',
    entityId: phoneNumberId,
    oldValue: { tenantId: before?.tenantId || null },
    newValue: { tenantId: null, number: updated.number },
  });

  return updated;
}

async function assignNumberToExtension(prisma, tenantId, {
  phoneNumberId,
  extensionId,
  employeeId,
}, { req, actor } = {}) {
  if (!phoneNumberId || !extensionId) {
    throw Object.assign(new Error('phoneNumberId and extensionId are required'), { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const phone = await tx.phoneNumber.findFirst({
      where: { id: String(phoneNumberId), tenantId },
    });
    if (!phone) throw Object.assign(new Error('Phone number not found in this organization'), { status: 404 });

    const extension = await tx.extension.findFirst({
      where: { id: String(extensionId), tenantId },
    });
    if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });

    const targetUserId = employeeId ? String(employeeId) : extension.userId;
    if (employeeId && extension.userId && extension.userId !== targetUserId) {
      throw Object.assign(new Error('Extension is assigned to a different employee'), { status: 409 });
    }
    if (targetUserId) {
      const user = await tx.user.findFirst({ where: { id: targetUserId, tenantId } });
      if (!user) throw Object.assign(new Error('Employee not found'), { status: 404 });
    }

    if (extension.primaryPhoneNumberId && extension.primaryPhoneNumberId !== phone.id) {
      await tx.phoneNumber.update({
        where: { id: extension.primaryPhoneNumberId },
        data: { extensionId: null },
      });
    }

    if (phone.extensionId && phone.extensionId !== extension.id) {
      await tx.extension.updateMany({
        where: { id: phone.extensionId, primaryPhoneNumberId: phone.id },
        data: { primaryPhoneNumberId: null },
      });
      await tx.phoneNumber.update({
        where: { id: phone.id },
        data: { extensionId: null },
      });
    }

    const oldPhone = { ...phone };
    const updatedPhone = await tx.phoneNumber.update({
      where: { id: phone.id },
      data: {
        extensionId: extension.id,
        assignedUserId: targetUserId || null,
        routingType: phone.routingType === 'tenant_default' ? 'direct_user' : phone.routingType,
      },
    });

    await tx.extension.update({
      where: { id: extension.id },
      data: { primaryPhoneNumberId: phone.id },
    });

    await recordDidAssignmentHistory(tx, {
      phoneNumberId: phone.id,
      number: phone.number,
      tenantId,
      action: 'V3_EXTENSION_ASSIGNED',
      assignedByUserId: actor?.sub || actor?.userId || null,
      notes: `Assigned to extension ${extension.extensionNumber}`,
    });

    await auditService.logTransactional(tx, req, {
      action: 'v3.number.assigned_extension',
      entityType: 'PhoneNumber',
      entityId: phone.id,
      oldValue: {
        extensionId: oldPhone.extensionId,
        assignedUserId: oldPhone.assignedUserId,
        routingType: oldPhone.routingType,
      },
      newValue: {
        extensionId: extension.id,
        extensionNumber: extension.extensionNumber,
        assignedUserId: targetUserId,
        routingType: updatedPhone.routingType,
      },
    });

    return { phone: updatedPhone, extension, employeeId: targetUserId };
  });

  const extRow = await prisma.extension.findUnique({ where: { id: result.extension.id } });
  const provision = await provisioningService.ensureExtensionProvisioned(
    prisma, extRow, { stage: 'v3.number-assign' },
  );
  const health = await inventoryHealthService.getNumberHealth(prisma, tenantId, result.phone.id);

  return { ...result, provision, health };
}

async function unassignNumberFromExtension(prisma, tenantId, phoneNumberId, { req, actor } = {}) {
  const result = await prisma.$transaction(async (tx) => {
    const phone = await tx.phoneNumber.findFirst({
      where: { id: String(phoneNumberId), tenantId },
    });
    if (!phone) throw Object.assign(new Error('Phone number not found'), { status: 404 });

    const extension = phone.extensionId
      ? await tx.extension.findFirst({ where: { id: phone.extensionId, tenantId } })
      : null;

    const old = { extensionId: phone.extensionId, assignedUserId: phone.assignedUserId };

    if (extension?.primaryPhoneNumberId === phone.id) {
      await tx.extension.update({
        where: { id: extension.id },
        data: { primaryPhoneNumberId: null },
      });
    }

    const updated = await tx.phoneNumber.update({
      where: { id: phone.id },
      data: {
        extensionId: null,
        routingType: 'tenant_default',
      },
    });

    await recordDidAssignmentHistory(tx, {
      phoneNumberId: phone.id,
      number: phone.number,
      tenantId,
      action: 'V3_EXTENSION_UNASSIGNED',
      assignedByUserId: actor?.sub || actor?.userId || null,
    });

    await auditService.logTransactional(tx, req, {
      action: 'v3.number.unassigned_extension',
      entityType: 'PhoneNumber',
      entityId: phone.id,
      oldValue: old,
      newValue: { extensionId: null, assignedUserId: updated.assignedUserId },
    });

    return updated;
  });

  const health = await inventoryHealthService.getNumberHealth(prisma, tenantId, phoneNumberId);
  return { phone: result, health };
}

module.exports = {
  assignNumberToTenant,
  unassignNumberFromTenant,
  assignNumberToExtension,
  unassignNumberFromExtension,
};
