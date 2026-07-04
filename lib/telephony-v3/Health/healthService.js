const { checkDatabase } = require('../../health');
const redisLib = require('../../redis');
const requireRedisModule = require('../Redis/requireRedis');
const streamsModule = require('../Redis/streams');
const commandOutbox = require('../Outbox/commandOutbox');
const heartbeatModule = require('../Redis/heartbeat');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { ENGINE_VERSION, STREAM, HEALTH } = require('../constants');
const { metrics } = require('../Utils/metrics');
const env = require('../../env');
/**
 * @returns {Promise<import('../types').V3HealthReport>}
 */
async function getV3ReadinessStatus() {
  const [database, redisPing, workers, outbox, queueDepth, queueLag, dlqDepth, pendingCount] =
    await Promise.all([
      checkDatabase(),
      redisLib.pingRedis(),
      heartbeatModule.listActiveWorkers(),
      commandOutbox.countOutboxByStatus(),
      streamsModule.getStreamDepth().catch(() => 0),
      streamsModule.getQueueLagMs().catch(() => null),
      streamsModule.getDlqDepth().catch(() => 0),
      streamsModule.getPendingCount().catch(() => 0),
    ]);

  const redisRequired = requireRedisModule.isV3RedisRequired();
  const redisConnected = Boolean(redisPing.connected);
  const featureFlagStatus = featureFlags.getGlobalFlagStatus();
  const prod = env.isProduction();

  metrics.setQueueDepth(queueDepth);
  metrics.setDlqDepth(dlqDepth);
  metrics.setOutboxPending(outbox.pending + outbox.failed);
  metrics.setOutboxProcessing(outbox.processing);

  const workersHealthy = workers.activeCount > 0;
  const queueLagOk = queueLag == null || queueLag <= HEALTH.QUEUE_LAG_MAX_MS;
  const queueDepthOk = queueDepth <= HEALTH.QUEUE_DEPTH_MAX;
  const dlqOk = dlqDepth <= HEALTH.DLQ_DEPTH_MAX;
  const outboxDeadOk = outbox.dead <= HEALTH.OUTBOX_DEAD_MAX;

  const checks = {
    database: database.connected,
    redis: !redisRequired || redisConnected,
    workers: prod ? workersHealthy : true,
    queueLag: queueLagOk,
    queueDepth: queueDepthOk,
    dlq: dlqOk,
    outboxDead: outboxDeadOk,
  };

  const ready = Object.values(checks).every(Boolean);

  return {
    ready,
    checks,
    redis: {
      connected: redisConnected,
      required: redisRequired,
      latencyMs: redisPing.latencyMs,
      error: redisPing.error,
      config: redisLib.getRedisConfig(),
    },
    database: {
      connected: database.connected,
      latencyMs: database.latencyMs,
      error: database.error,
    },
    workers: {
      healthy: workersHealthy,
      activeCount: workers.activeCount,
      staleThresholdSec: 30,
      workers: workers.workers.map((w) => ({ workerId: w.workerId, at: w.at, role: w.role })),
    },
    queue: {
      stream: STREAM.INGRESS,
      depth: queueDepth,
      lagMs: queueLag,
      pendingCount,
      lagThresholdMs: HEALTH.QUEUE_LAG_MAX_MS,
      depthThreshold: HEALTH.QUEUE_DEPTH_MAX,
    },
    dlq: {
      stream: STREAM.DLQ,
      depth: dlqDepth,
      depthThreshold: HEALTH.DLQ_DEPTH_MAX,
    },
    outbox: {
      pending: outbox.pending,
      processing: outbox.processing,
      sent: outbox.sent,
      failed: outbox.failed,
      dead: outbox.dead,
      deadThreshold: HEALTH.OUTBOX_DEAD_MAX,
    },
    featureFlags: featureFlagStatus,
    engineVersion: ENGINE_VERSION,
  };
}

module.exports = { getV3ReadinessStatus };
