const { requireV3Redis } = require('./requireRedis');
const { REDIS } = require('../constants');
const { heartbeatKey, TTL } = require('./keys');
const { safeJsonParse } = require('../Utils/safeJson');

async function recordWorkerHeartbeat(workerId, metadata = {}) {
  const redis = await requireV3Redis({ allowOptional: true });
  if (!redis) return;
  const key = heartbeatKey(workerId);
  await redis
    .multi()
    .set(key, JSON.stringify({ workerId, at: Date.now(), ...metadata }), 'EX', TTL.HEARTBEAT_SEC)
    .sadd(REDIS.HEARTBEAT_INDEX, workerId)
    .exec()
    .catch(() => {});
}

/**
 * @param {number} [staleThresholdSec]
 * @returns {Promise<{ activeCount: number, workers: Array<{ workerId: string, at: number }> }>}
 */
async function listActiveWorkers(staleThresholdSec = TTL.HEARTBEAT_SEC) {
  const redis = await requireV3Redis({ allowOptional: true });
  if (!redis) return { activeCount: 0, workers: [] };

  const workerIds = await redis.smembers(REDIS.HEARTBEAT_INDEX).catch(() => []);
  const now = Date.now();
  const workers = [];
  const staleIds = [];

  for (const workerId of workerIds) {
    const raw = await redis.get(heartbeatKey(workerId));
    if (!raw) {
      staleIds.push(workerId);
      continue;
    }
    const parsed = safeJsonParse(raw);
    if (!parsed?.at) {
      staleIds.push(workerId);
      continue;
    }
    if (now - parsed.at <= staleThresholdSec * 1000) {
      workers.push(parsed);
    } else {
      staleIds.push(workerId);
    }
  }

  if (staleIds.length) {
    await redis.srem(REDIS.HEARTBEAT_INDEX, ...staleIds).catch(() => {});
  }

  return { activeCount: workers.length, workers };
}

module.exports = { recordWorkerHeartbeat, listActiveWorkers };
