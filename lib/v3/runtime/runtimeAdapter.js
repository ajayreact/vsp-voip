/**
 * V3 Runtime Adapter — shared link registry and idempotency helpers.
 */

const { createHash, randomUUID } = require('crypto');

const ENTITY_TYPES = Object.freeze([
  'ring_group',
  'queue',
  'business_hours',
  'holiday',
  'voicemail',
  'call_flow',
  'extension',
  'number',
  'device',
]);

function hashPayload(payload) {
  const body = JSON.stringify(payload || {});
  return createHash('sha256').update(body).digest('hex').slice(0, 32);
}

function buildIdempotencyKey(tenantId, entityType, entityId, action, payload) {
  return `${tenantId}:${entityType}:${entityId}:${action}:${hashPayload(payload)}`;
}

async function getLink(prisma, tenantId, v3EntityType, v3EntityId) {
  return prisma.v3RuntimeLink.findUnique({
    where: {
      tenantId_v3EntityType_v3EntityId: {
        tenantId,
        v3EntityType,
        v3EntityId,
      },
    },
  });
}

async function upsertLink(prisma, tenantId, {
  v3EntityType,
  v3EntityId,
  runtimeEntityType,
  runtimeEntityId,
  metadata,
  syncHash,
}) {
  return prisma.v3RuntimeLink.upsert({
    where: {
      tenantId_v3EntityType_v3EntityId: {
        tenantId,
        v3EntityType,
        v3EntityId,
      },
    },
    create: {
      id: randomUUID(),
      tenantId,
      v3EntityType,
      v3EntityId,
      runtimeEntityType,
      runtimeEntityId,
      metadata: metadata || null,
      syncHash: syncHash || null,
      lastSyncedAt: new Date(),
    },
    update: {
      runtimeEntityType,
      runtimeEntityId,
      metadata: metadata || null,
      syncHash: syncHash || null,
      lastSyncedAt: new Date(),
    },
  });
}

async function resolveRuntimeEntity(prisma, tenantId, v3EntityType, v3EntityId) {
  const link = await getLink(prisma, tenantId, v3EntityType, v3EntityId);
  if (!link) return null;
  return {
    link,
    runtimeEntityType: link.runtimeEntityType,
    runtimeEntityId: link.runtimeEntityId,
  };
}

function mapV3Strategy(strategy) {
  const s = String(strategy || 'SIMULTANEOUS').toUpperCase();
  const map = {
    SIMULTANEOUS: 'SIMULTANEOUS',
    SEQUENTIAL: 'SEQUENTIAL',
    ROUND_ROBIN: 'ROUND_ROBIN',
    LONGEST_IDLE: 'LONGEST_IDLE',
    RANDOM: 'SIMULTANEOUS',
    LEAST_CALLS: 'ROUND_ROBIN',
  };
  return map[s] || 'SIMULTANEOUS';
}

function v3WeekdaysToGreetingSchedule(weekdays = {}, weekends = {}) {
  const out = {};
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  for (const day of days) {
    const src = weekends[day] !== undefined ? weekends[day] : weekdays[day];
    if (!src) continue;
    if (Array.isArray(src) && src.length >= 2) {
      out[day] = { enabled: true, open: src[0], close: src[1] };
    } else if (src && typeof src === 'object') {
      out[day] = {
        enabled: src.enabled !== false,
        open: src.open || src.start || '09:00',
        close: src.close || src.end || '17:00',
      };
    }
  }
  return Object.keys(out).length ? out : null;
}

module.exports = {
  ENTITY_TYPES,
  hashPayload,
  buildIdempotencyKey,
  getLink,
  upsertLink,
  resolveRuntimeEntity,
  mapV3Strategy,
  v3WeekdaysToGreetingSchedule,
};
