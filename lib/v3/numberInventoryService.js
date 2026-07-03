/**
 * V3 Number Inventory — platform-wide PhoneNumber inventory with derived status.
 *
 * Status is derived from existing PhoneNumber fields (no schema migration):
 *   AVAILABLE       — active, no tenant (platform pool)
 *   RESERVED        — source v3:RESERVED (marketplace hold)
 *   ASSIGNED        — active + tenantId set
 *   PORTING         — number appears on an open PortRequest
 *   RELEASE_PENDING — source v3:RELEASE_PENDING
 *   SUSPENDED       — isActive === false
 */

const { normalizePhoneNumber } = require('../phone');

const V3_SOURCE = {
  AVAILABLE: 'v3:AVAILABLE',
  RESERVED: 'v3:RESERVED',
  RELEASE_PENDING: 'v3:RELEASE_PENDING',
};

const INVENTORY_INCLUDE = {
  tenant: { select: { id: true, name: true } },
  assignedUser: { select: { id: true, name: true, email: true, telnyxCredentialId: true, telnyxSipUsername: true, sipRegistered: true } },
  extension: {
    select: {
      id: true,
      extensionNumber: true,
      displayName: true,
      userId: true,
      primaryPhoneNumberId: true,
      status: true,
    },
  },
};

async function loadPortingNumbers(prisma) {
  const portRequests = await prisma.portRequest.findMany({
    where: { status: { in: ['SUBMITTED', 'IN_PROGRESS', 'DRAFT'] } },
    select: { phoneNumbers: true },
  });
  const set = new Set();
  for (const req of portRequests) {
    const nums = Array.isArray(req.phoneNumbers) ? req.phoneNumbers : [];
    for (const n of nums) {
      if (typeof n === 'string') set.add(normalizePhoneNumber(n) || n);
    }
  }
  return set;
}

function deriveInventoryStatus(phone, portingNumbers = new Set()) {
  if (!phone) return 'SUSPENDED';
  const normalized = normalizePhoneNumber(phone.number) || phone.number;
  if (portingNumbers.has(normalized)) return 'PORTING';
  if (phone.source === V3_SOURCE.RESERVED) return 'RESERVED';
  if (phone.source === V3_SOURCE.RELEASE_PENDING) return 'RELEASE_PENDING';
  if (phone.isActive === false) return 'SUSPENDED';
  if (phone.tenantId) return 'ASSIGNED';
  return 'AVAILABLE';
}

function parseInventoryMeta(phone) {
  if (!phone?.label) return {};
  try {
    const parsed = JSON.parse(phone.label);
    return typeof parsed === 'object' && parsed ? parsed : { notes: phone.label };
  } catch {
    return { notes: phone.label };
  }
}

function serializeInventoryRow(phone, portingNumbers, readiness = null) {
  const meta = parseInventoryMeta(phone);
  const status = deriveInventoryStatus(phone, portingNumbers);
  return {
    id: phone.id,
    number: phone.number,
    inventoryStatus: status,
    country: meta.country || null,
    region: meta.region || meta.state || null,
    locality: meta.locality || null,
    capabilities: meta.capabilities || meta.features || [],
    monthlyCost: Number(phone.telnyxMonthlyCost ?? phone.carrierMonthly ?? phone.platformMonthly ?? null),
    purchasedAt: phone.createdAt,
    purchasedByUserId: meta.purchasedByUserId || null,
    tenantId: phone.tenantId,
    tenantName: phone.tenant?.name || null,
    employeeId: phone.assignedUserId,
    employeeName: phone.assignedUser?.name || null,
    employeeEmail: phone.assignedUser?.email || null,
    extensionId: phone.extensionId,
    extensionNumber: phone.extension?.extensionNumber || null,
    extensionName: phone.extension?.displayName || null,
    routingType: phone.routingType,
    isActive: phone.isActive,
    source: phone.source,
    notes: meta.notes || null,
    credentialConnectionId: readiness?.credentialConnectionId || null,
    callControlApplicationId: readiness?.callControlApplicationId || null,
    createdAt: phone.createdAt,
    updatedAt: phone.updatedAt,
  };
}

async function listInventory(prisma, {
  search,
  status,
  tenantId,
  limit = 100,
  offset = 0,
  readiness = null,
} = {}) {
  const portingNumbers = await loadPortingNumbers(prisma);
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { label: { contains: search, mode: 'insensitive' } },
      { tenant: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.phoneNumber.findMany({
      where,
      include: INVENTORY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.phoneNumber.count({ where }),
  ]);

  let items = rows.map((row) => serializeInventoryRow(row, portingNumbers, readiness));
  if (status && status !== 'ALL') {
    items = items.filter((row) => row.inventoryStatus === status);
  }

  const summary = items.reduce((acc, row) => {
    acc[row.inventoryStatus] = (acc[row.inventoryStatus] || 0) + 1;
    return acc;
  }, {});

  return { items, total, limit, offset, summary, portingNumbers };
}

async function getInventoryItem(prisma, phoneNumberId, { tenantId = null, readiness = null } = {}) {
  const portingNumbers = await loadPortingNumbers(prisma);
  const phone = await prisma.phoneNumber.findFirst({
    where: {
      id: phoneNumberId,
      ...(tenantId ? { tenantId } : {}),
    },
    include: INVENTORY_INCLUDE,
  });
  if (!phone) return null;
  return serializeInventoryRow(phone, portingNumbers, readiness);
}

async function reserveNumber(prisma, {
  number,
  country,
  region,
  locality,
  capabilities,
  monthlyCost,
  reservedByUserId,
  notes,
}) {
  const normalized = normalizePhoneNumber(number);
  if (!normalized) {
    throw Object.assign(new Error('Invalid phone number'), { status: 400 });
  }

  const existing = await prisma.phoneNumber.findUnique({ where: { number: normalized } });
  if (existing) {
    const status = deriveInventoryStatus(existing, await loadPortingNumbers(prisma));
    if (status !== 'AVAILABLE' && status !== 'RESERVED') {
      throw Object.assign(new Error(`Number is not available (${status})`), { status: 409 });
    }
    const updated = await prisma.phoneNumber.update({
      where: { id: existing.id },
      data: {
        tenantId: null,
        isActive: true,
        source: V3_SOURCE.RESERVED,
        label: JSON.stringify({
          country, region, locality, capabilities,
          monthlyCost, reservedByUserId, notes,
          reservedAt: new Date().toISOString(),
        }),
      },
      include: INVENTORY_INCLUDE,
    });
    return serializeInventoryRow(updated, await loadPortingNumbers(prisma));
  }

  const created = await prisma.phoneNumber.create({
    data: {
      number: normalized,
      tenantId: null,
      isActive: true,
      source: V3_SOURCE.RESERVED,
      routingType: 'tenant_default',
      telnyxMonthlyCost: monthlyCost != null ? monthlyCost : undefined,
      label: JSON.stringify({
        country, region, locality, capabilities,
        monthlyCost, reservedByUserId, notes,
        reservedAt: new Date().toISOString(),
      }),
    },
    include: INVENTORY_INCLUDE,
  });
  return serializeInventoryRow(created, await loadPortingNumbers(prisma));
}

async function markAvailable(prisma, phoneNumberId, { purchasedByUserId, notes, monthlyCost } = {}) {
  const phone = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
  if (!phone) throw Object.assign(new Error('Phone number not found'), { status: 404 });

  const meta = { ...parseInventoryMeta(phone), purchasedByUserId, notes, purchasedAt: new Date().toISOString() };
  const updated = await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      tenantId: null,
      isActive: true,
      source: V3_SOURCE.AVAILABLE,
      telnyxMonthlyCost: monthlyCost != null ? monthlyCost : phone.telnyxMonthlyCost,
      label: JSON.stringify(meta),
    },
    include: INVENTORY_INCLUDE,
  });
  return serializeInventoryRow(updated, await loadPortingNumbers(prisma));
}

async function markReleasePending(prisma, phoneNumberId, { notes } = {}) {
  const phone = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
  if (!phone) throw Object.assign(new Error('Phone number not found'), { status: 404 });

  const meta = { ...parseInventoryMeta(phone), releaseNotes: notes, releaseRequestedAt: new Date().toISOString() };
  const updated = await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      source: V3_SOURCE.RELEASE_PENDING,
      label: JSON.stringify(meta),
    },
    include: INVENTORY_INCLUDE,
  });
  return serializeInventoryRow(updated, await loadPortingNumbers(prisma));
}

async function suspendNumber(prisma, phoneNumberId) {
  const updated = await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: { isActive: false },
    include: INVENTORY_INCLUDE,
  });
  return serializeInventoryRow(updated, await loadPortingNumbers(prisma));
}

module.exports = {
  V3_SOURCE,
  deriveInventoryStatus,
  loadPortingNumbers,
  serializeInventoryRow,
  listInventory,
  getInventoryItem,
  reserveNumber,
  markAvailable,
  markReleasePending,
  suspendNumber,
  parseInventoryMeta,
};
