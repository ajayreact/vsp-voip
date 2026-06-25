const axios = require('axios');
const { normalizePhoneNumber } = require('./phone');

function telnyxHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };
}

async function countTelnyxUnassignedNumbers(apiKey, prisma) {
  if (!apiKey) return null;

  const dbRows = await prisma.phoneNumber.findMany({
    where: { isActive: true },
    select: { number: true, tenantId: true },
  });
  const unassignedDb = dbRows.filter((row) => !row.tenantId).length;

  let telnyxUnassigned = 0;
  let page = 1;

  try {
    while (true) {
      const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
        headers: telnyxHeaders(apiKey),
        params: { 'page[number]': page, 'page[size]': 250 },
        timeout: 15000,
      });

      const rows = response.data.data || [];
      const dbByNumber = new Map(dbRows.map((row) => [row.number, row]));
      for (const row of rows) {
        const num = normalizePhoneNumber(row.phone_number);
        if (!num) continue;
        const dbRow = dbByNumber.get(num);
        if (!dbRow || !dbRow.tenantId) telnyxUnassigned += 1;
      }

      const totalPages = response.data.meta?.total_pages ?? 1;
      if (page >= totalPages || !rows.length) break;
      page += 1;
    }

    return Math.max(unassignedDb, telnyxUnassigned);
  } catch (err) {
    console.warn('⚠️ Telnyx available pool count failed:', err.message);
    return null;
  }
}

async function getNumberInventory(prisma, { search, status, limit = 200, offset = 0, apiKey } = {}) {
  const portRequests = await prisma.portRequest.findMany({
    where: { status: { in: ['SUBMITTED', 'IN_PROGRESS', 'DRAFT'] } },
    select: { phoneNumbers: true, status: true, tenantId: true },
  });

  const portingNumbers = new Set();
  for (const req of portRequests) {
    const nums = Array.isArray(req.phoneNumbers) ? req.phoneNumbers : [];
    for (const n of nums) {
      if (typeof n === 'string') portingNumbers.add(n);
    }
  }

  const where = {};
  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { label: { contains: search, mode: 'insensitive' } },
      { tenant: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [numbers, total] = await Promise.all([
    prisma.phoneNumber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        tenant: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.phoneNumber.count({ where }),
  ]);

  const rows = numbers.map((row) => {
    let inventoryStatus = 'UNASSIGNED';
    if (portingNumbers.has(row.number)) {
      inventoryStatus = 'PORTING';
    } else if (row.isActive === false) {
      inventoryStatus = 'RELEASED';
    } else if (row.tenantId) {
      inventoryStatus = 'ASSIGNED';
    } else {
      inventoryStatus = 'UNASSIGNED';
    }

    return {
      id: row.id,
      number: row.number,
      label: row.label,
      status: inventoryStatus,
      isActive: row.isActive,
      tenantId: row.tenantId,
      tenantName: row.tenant?.name || null,
      assignedUserId: row.assignedUserId,
      assignedUserName: row.assignedUser?.name || null,
      assignedUserEmail: row.assignedUser?.email || null,
      monthlyCost: Number(row.tenantMonthlyTotal ?? row.platformMonthly ?? null),
      routingType: row.routingType,
      createdAt: row.createdAt,
    };
  });

  const filtered = status && status !== 'ALL'
    ? rows.filter((r) => r.status === status)
    : rows;

  const allNumbers = await prisma.phoneNumber.findMany({
    select: { isActive: true, number: true, tenantId: true },
  });

  let assigned = 0;
  let unassigned = 0;
  let released = 0;
  let porting = 0;
  for (const n of allNumbers) {
    if (portingNumbers.has(n.number)) {
      porting += 1;
    } else if (n.isActive === false) {
      released += 1;
    } else if (n.tenantId) {
      assigned += 1;
    } else {
      unassigned += 1;
    }
  }

  const telnyxAvailable = await countTelnyxUnassignedNumbers(apiKey, prisma);

  const summary = {
    purchased: allNumbers.length,
    assigned,
    unassigned,
    available: unassigned,
    availableSynced: telnyxAvailable != null,
    telnyxPoolEstimate: telnyxAvailable ?? 0,
    porting,
    released,
  };

  return {
    summary,
    numbers: filtered,
    total,
    limit,
    offset,
  };
}

async function releasePhoneNumber(prisma, id) {
  const number = await prisma.phoneNumber.findUnique({ where: { id } });
  if (!number) return null;

  const updated = await prisma.phoneNumber.update({
    where: { id },
    data: {
      isActive: false,
      assignedUserId: null,
    },
    include: {
      tenant: { select: { id: true, name: true } },
    },
  });

  const { invalidateCachedTenant } = require('./tenantCache');
  await invalidateCachedTenant(number.number);

  return updated;
}

module.exports = {
  getNumberInventory,
  releasePhoneNumber,
};
