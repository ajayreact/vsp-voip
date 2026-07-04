/**
 * V3 Inventory Health — per-number green/yellow/red readiness matrix.
 */

const telnyxService = require('./telnyxService');
const numberInventoryService = require('./numberInventoryService');

const ORDER = { green: 0, yellow: 1, red: 2 };

function worst(...levels) {
  return levels.reduce((acc, l) => (ORDER[l] > ORDER[acc] ? l : acc), 'green');
}

function level(bool, falseLevel = 'red') {
  return bool ? 'green' : falseLevel;
}

function buildNumberHealth(item, readiness) {
  const assigned = item.inventoryStatus === 'ASSIGNED';
  const hasEmployee = Boolean(item.employeeId);
  const hasExtension = Boolean(item.extensionId);
  const employeeLinked = !hasExtension || (hasEmployee && item.extensionId);
  const extensionLinked = hasExtension
    ? item.extensionId === item.id || Boolean(item.extensionNumber)
    : false;
  const routingOk = assigned && (item.routingType === 'direct_user' || item.routingType === 'tenant_default');
  const credentialReady = Boolean(item.employeeId); // verified below when loaded

  const checks = {
    inventoryStatus: item.inventoryStatus === 'SUSPENDED' || item.inventoryStatus === 'RELEASE_PENDING'
      ? 'red'
      : (item.inventoryStatus === 'AVAILABLE' || item.inventoryStatus === 'RESERVED' ? 'yellow' : 'green'),
    assigned: assigned ? 'green' : 'yellow',
    routingOk: routingOk ? 'green' : (assigned ? 'yellow' : 'red'),
    employeeLinked: hasExtension ? (hasEmployee ? 'green' : 'red') : 'yellow',
    extensionLinked: hasExtension ? 'green' : (assigned ? 'yellow' : 'red'),
    credentialReady: 'yellow',
    registration: 'yellow',
    callControlReady: level(readiness.callControlReady),
    webhookReady: level(readiness.webhookReady),
  };

  return {
    phoneNumberId: item.id,
    number: item.number,
    inventoryStatus: item.inventoryStatus,
    tenantId: item.tenantId,
    tenantName: item.tenantName,
    employeeId: item.employeeId,
    extensionId: item.extensionId,
    extensionNumber: item.extensionNumber,
    overall: worst(...Object.values(checks)),
    checks,
    reasons: [],
  };
}

function applyUserToHealth(health, user) {
  if (user) {
    health.checks.credentialReady = user.telnyxCredentialId && user.telnyxSipUsername ? 'green' : 'red';
    health.checks.registration = user.sipRegistered === true ? 'green' : 'yellow';
  }
  health.overall = worst(...Object.values(health.checks));
  return health;
}

async function enrichHealthFromDb(prisma, health, tenantId = null) {
  if (!health.employeeId) return health;

  const user = await prisma.user.findFirst({
    where: {
      id: health.employeeId,
      ...(tenantId ? { tenantId } : {}),
    },
    select: { telnyxCredentialId: true, telnyxSipUsername: true, sipRegistered: true },
  });
  return applyUserToHealth(health, user);
}

async function getNumberHealth(prisma, tenantId, phoneNumberId) {
  const readiness = await telnyxService.getTenantTelephonyReadiness(prisma);
  const item = await numberInventoryService.getInventoryItem(prisma, phoneNumberId, {
    tenantId: tenantId || undefined,
    readiness,
  });
  if (!item) return null;
  const health = buildNumberHealth(item, readiness);
  return enrichHealthFromDb(prisma, health, tenantId);
}

async function listNumbersHealth(prisma, { tenantId = null, limit = 100 } = {}) {
  const readiness = await telnyxService.getTenantTelephonyReadiness(prisma);
  const { items } = await numberInventoryService.listInventory(prisma, {
    tenantId: tenantId || undefined,
    limit,
    readiness,
  });

  const employeeIds = [...new Set(items.map((item) => item.employeeId).filter(Boolean))];
  const users = employeeIds.length
    ? await prisma.user.findMany({
      where: {
        id: { in: employeeIds },
        ...(tenantId ? { tenantId } : {}),
      },
      select: { id: true, telnyxCredentialId: true, telnyxSipUsername: true, sipRegistered: true },
    })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const numbers = items.map((item) => {
    const health = buildNumberHealth(item, readiness);
    if (!health.employeeId) return health;
    return applyUserToHealth(health, userById.get(health.employeeId));
  });

  const summary = {
    total: numbers.length,
    ready: numbers.filter((n) => n.overall === 'green').length,
    warnings: numbers.filter((n) => n.overall === 'yellow').length,
    errors: numbers.filter((n) => n.overall === 'red').length,
  };

  return { numbers, summary, readiness };
}

module.exports = {
  buildNumberHealth,
  getNumberHealth,
  listNumbersHealth,
};
