/**
 * Business Hours Runtime Adapter — default V3BusinessHoursSchedule → Greeting.businessHours.
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

async function sync(prisma, tenantId, v3EntityId, { action } = {}) {
  const v3 = await prisma.v3BusinessHoursSchedule.findFirst({ where: { id: v3EntityId, tenantId } });
  if (!v3) return { ok: false, skipped: true, reason: 'v3_not_found' };

  if (action === 'delete' || v3.removedAt) {
    return { ok: true, action: 'skipped_delete', reason: 'non_destructive' };
  }

  if (!v3.isDefault) {
    return { ok: true, action: 'skipped', reason: 'not_default_schedule' };
  }

  const schedule = runtimeAdapter.v3WeekdaysToGreetingSchedule(v3.weekdays, v3.weekends);
  const greeting = await ensureGreeting(prisma, tenantId);
  const syncHash = runtimeAdapter.hashPayload({ schedule, timezone: v3.timezone });

  await prisma.greeting.update({
    where: { id: greeting.id },
    data: {
      businessHoursEnabled: Boolean(schedule),
      businessHours: schedule,
    },
  });

  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'business_hours',
    v3EntityId,
    runtimeEntityType: 'Greeting',
    runtimeEntityId: greeting.id,
    syncHash,
    metadata: { timezone: v3.timezone, name: v3.name },
  });

  return { ok: true, runtimeEntityId: greeting.id, syncHash };
}

async function compare(prisma, tenantId, v3EntityId) {
  const v3 = await prisma.v3BusinessHoursSchedule.findFirst({
    where: { id: v3EntityId, tenantId, removedAt: null, isDefault: true },
  });
  if (!v3) return { level: 'yellow', issue: 'not_default_or_missing' };
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'business_hours', v3EntityId);
  if (!link) return { level: 'yellow', issue: 'missing_runtime_link' };
  const greeting = await prisma.greeting.findUnique({ where: { tenantId } });
  if (!greeting?.businessHoursEnabled) return { level: 'red', issue: 'greeting_not_enabled' };
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  const check = await compare(prisma, tenantId, v3EntityId);
  if (check.level === 'green') return { repaired: false, reason: 'already_synced' };
  return { repaired: true, result: await sync(prisma, tenantId, v3EntityId) };
}

module.exports = { sync, compare, repair };
