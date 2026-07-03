/**
 * Holiday Runtime Adapter — aggregates tenant V3Holiday rows into Greeting metadata link.
 */

const { randomUUID } = require('crypto');
const runtimeAdapter = require('./runtimeAdapter');

async function ensureGreeting(prisma, tenantId) {
  const existing = await prisma.greeting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.greeting.create({
    data: { id: randomUUID(), tenantId },
  });
}

async function syncCatalog(prisma, tenantId) {
  const holidays = await prisma.v3Holiday.findMany({
    where: { tenantId, removedAt: null },
    orderBy: { date: 'asc' },
  });
  const greeting = await ensureGreeting(prisma, tenantId);
  const catalog = holidays.map((h) => ({
    id: h.id,
    name: h.name,
    date: h.date,
    recurring: h.recurring,
    oneTime: h.oneTime,
    overrideDestination: h.overrideDestination,
  }));
  const syncHash = runtimeAdapter.hashPayload(catalog);

  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'holiday',
    v3EntityId: tenantId,
    runtimeEntityType: 'Greeting',
    runtimeEntityId: greeting.id,
    syncHash,
    metadata: { holidays: catalog },
  });

  return { ok: true, runtimeEntityId: greeting.id, count: catalog.length, syncHash };
}

async function sync(prisma, tenantId, v3EntityId) {
  const v3 = await prisma.v3Holiday.findFirst({ where: { id: v3EntityId, tenantId } });
  if (!v3 && v3EntityId !== tenantId) {
    return { ok: false, skipped: true, reason: 'v3_not_found' };
  }
  return syncCatalog(prisma, tenantId);
}

async function compare(prisma, tenantId) {
  const v3Count = await prisma.v3Holiday.count({ where: { tenantId, removedAt: null } });
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'holiday', tenantId);
  if (!link) return { level: v3Count ? 'yellow' : 'green', issue: 'missing_runtime_link' };
  const metaCount = Array.isArray(link.metadata?.holidays) ? link.metadata.holidays.length : 0;
  if (metaCount < v3Count) return { level: 'yellow', issue: 'catalog_stale' };
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  return { repaired: true, result: await syncCatalog(prisma, tenantId) };
}

module.exports = { sync, compare, repair, syncCatalog };
