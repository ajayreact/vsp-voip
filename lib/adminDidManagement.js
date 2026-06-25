const crypto = require('crypto');
const { normalizePhoneNumber } = require('./phone');
const { listAllTelnyxNumbers } = require('./revenueProtection');
const { verifyTelnyxNumberOwnership } = require('./buyNumber');
const { setCachedTenant, invalidateCachedTenant } = require('./tenantCache');

async function recordDidAssignmentHistory(prisma, {
  phoneNumberId,
  number,
  tenantId = null,
  previousTenantId = null,
  action,
  assignedByUserId = null,
  notes = null,
}) {
  return prisma.didAssignmentHistory.create({
    data: {
      id: crypto.randomUUID(),
      phoneNumberId,
      number,
      tenantId: tenantId || null,
      previousTenantId: previousTenantId || null,
      action,
      assignedByUserId: assignedByUserId || null,
      notes: notes || null,
    },
  });
}

async function clearPhoneTenantLinks(prisma, phone) {
  if (!phone?.id) return;

  const extensionWithPrimary = await prisma.extension.findFirst({
    where: { primaryPhoneNumberId: phone.id },
    select: { id: true },
  });
  if (extensionWithPrimary) {
    await prisma.extension.update({
      where: { id: extensionWithPrimary.id },
      data: { primaryPhoneNumberId: null },
    });
  }

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      extensionId: null,
      assignedUserId: null,
      ringGroupId: null,
      forwardDestination: null,
      routingType: 'tenant_default',
    },
  });
}

/**
 * Sync all phone numbers from the Telnyx account into platform inventory.
 * @see https://developers.telnyx.com/api-reference/phone-numbers/list-phone-numbers
 */
async function syncTelnyxDidsToInventory(prisma, apiKey) {
  if (!apiKey?.trim()) {
    throw Object.assign(new Error('Telnyx API key is not configured'), { status: 503 });
  }

  const telnyxNumbers = await listAllTelnyxNumbers(apiKey);
  const telnyxSet = new Set(telnyxNumbers);
  let created = 0;

  for (const number of telnyxNumbers) {
    const existing = await prisma.phoneNumber.findUnique({ where: { number } });
    if (existing) continue;

    const row = await prisma.phoneNumber.create({
      data: {
        number,
        tenantId: null,
        isActive: true,
        source: 'TELNYX_SYNC',
        routingType: 'tenant_default',
      },
    });
    await recordDidAssignmentHistory(prisma, {
      phoneNumberId: row.id,
      number,
      action: 'SYNCED',
      notes: 'Imported from Telnyx account inventory',
    });
    created += 1;
  }

  const dbNumbers = await prisma.phoneNumber.findMany({
    select: { number: true, tenantId: true, isActive: true },
  });

  let assigned = 0;
  let unassigned = 0;
  let released = 0;
  let notInTelnyx = 0;

  for (const row of dbNumbers) {
    if (!telnyxSet.has(row.number)) notInTelnyx += 1;
    if (row.isActive === false) {
      released += 1;
    } else if (row.tenantId) {
      assigned += 1;
    } else {
      unassigned += 1;
    }
  }

  return {
    telnyxTotal: telnyxNumbers.length,
    created,
    dbTotal: dbNumbers.length,
    assigned,
    unassigned,
    released,
    notInTelnyx,
  };
}

async function assignDidToTenant(prisma, {
  phoneNumber,
  phoneNumberId,
  tenantId,
  assignedByUserId = null,
  apiKey,
}) {
  if (!tenantId) {
    throw Object.assign(new Error('tenantId is required'), { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw Object.assign(new Error('Tenant not found'), { status: 404 });
    }

    let phone = null;
    if (phoneNumberId) {
      phone = await tx.phoneNumber.findUnique({ where: { id: phoneNumberId } });
    } else if (phoneNumber) {
      const normalized = normalizePhoneNumber(phoneNumber);
      if (!normalized) {
        throw Object.assign(new Error('Invalid phoneNumber format'), { status: 400 });
      }
      phone = await tx.phoneNumber.findUnique({ where: { number: normalized } });
      if (!phone) {
        await verifyTelnyxNumberOwnership(normalized, apiKey);
        phone = await tx.phoneNumber.create({
          data: {
            number: normalized,
            tenantId: null,
            isActive: true,
            source: 'ADMIN_ASSIGN',
            routingType: 'tenant_default',
          },
        });
      }
    }

    if (!phone) {
      throw Object.assign(new Error('Phone number not found'), { status: 404 });
    }

    await verifyTelnyxNumberOwnership(phone.number, apiKey);

    const previousTenantId = phone.tenantId;
    if (previousTenantId && previousTenantId !== tenantId) {
      await clearPhoneTenantLinks(tx, phone);
      await recordDidAssignmentHistory(tx, {
        phoneNumberId: phone.id,
        number: phone.number,
        tenantId: null,
        previousTenantId,
        action: 'UNASSIGNED',
        assignedByUserId,
        notes: 'Automatic unassign before reassignment',
      });
    }

    const saved = await tx.phoneNumber.update({
      where: { id: phone.id },
      data: {
        tenantId,
        isActive: true,
        source: phone.source || 'ADMIN_ASSIGN',
      },
      include: {
        tenant: { select: { id: true, name: true } },
      },
    });

    await recordDidAssignmentHistory(tx, {
      phoneNumberId: saved.id,
      number: saved.number,
      tenantId,
      previousTenantId,
      action: previousTenantId && previousTenantId !== tenantId ? 'REASSIGNED' : 'ASSIGNED',
      assignedByUserId,
    });

    return { saved, tenant, previousTenantId };
  });

  if (updated.previousTenantId && updated.previousTenantId !== tenantId) {
    await invalidateCachedTenant(updated.saved.number);
  }
  await setCachedTenant(updated.saved.number, updated.tenant);
  return updated.saved;
}

async function unassignAllDidsForTenant(prisma, tenantId, { assignedByUserId = null, notes = 'Tenant deleted' } = {}) {
  const phones = await prisma.phoneNumber.findMany({
    where: { tenantId },
    select: { id: true, number: true, tenantId: true },
  });

  if (!phones.length) {
    return { unassigned: 0 };
  }

  let unassigned = 0;
  for (const phone of phones) {
    await invalidateCachedTenant(phone.number);
    await clearPhoneTenantLinks(prisma, phone);
    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: {
        tenantId: null,
        isActive: true,
        routingType: 'tenant_default',
      },
    });
    await recordDidAssignmentHistory(prisma, {
      phoneNumberId: phone.id,
      number: phone.number,
      tenantId: null,
      previousTenantId: tenantId,
      action: 'UNASSIGNED',
      assignedByUserId,
      notes,
    });
    unassigned += 1;
  }

  return { unassigned };
}

async function unassignDidFromTenant(prisma, phoneNumberId, { assignedByUserId = null } = {}) {
  const phone = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
  if (!phone) {
    throw Object.assign(new Error('Phone number not found'), { status: 404 });
  }

  const previousTenantId = phone.tenantId;
  if (!previousTenantId) {
    return phone;
  }

  await invalidateCachedTenant(phone.number);
  await clearPhoneTenantLinks(prisma, phone);

  const updated = await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      tenantId: null,
      isActive: true,
      routingType: 'tenant_default',
    },
  });

  await recordDidAssignmentHistory(prisma, {
    phoneNumberId: updated.id,
    number: updated.number,
    tenantId: null,
    previousTenantId,
    action: 'UNASSIGNED',
    assignedByUserId,
  });

  return updated;
}

async function getDidAssignmentHistory(prisma, { limit = 100, offset = 0, number, tenantId } = {}) {
  const where = {};
  if (number) where.number = normalizePhoneNumber(number) || number;
  if (tenantId) where.tenantId = tenantId;

  const [rows, total] = await Promise.all([
    prisma.didAssignmentHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        tenant: { select: { id: true, name: true } },
        phoneNumber: { select: { id: true, number: true, isActive: true, tenantId: true } },
      },
    }),
    prisma.didAssignmentHistory.count({ where }),
  ]);

  return { rows, total, limit, offset };
}

module.exports = {
  syncTelnyxDidsToInventory,
  assignDidToTenant,
  unassignDidFromTenant,
  unassignAllDidsForTenant,
  getDidAssignmentHistory,
  recordDidAssignmentHistory,
  clearPhoneTenantLinks,
};
