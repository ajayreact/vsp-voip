/**
 * B3 — Real PostgreSQL + Redis integration harness (no mocks for PG/Redis).
 */

const { STREAM, REDIS, TTL } = require('../../../lib/telephony-v3/constants');

const TENANT_ID = 'tenant-v3-integration';

/** @type {Array<{ label: string, ms: number }>} */
const timingSamples = [];

function recordTiming(label, startMs) {
  timingSamples.push({ label, ms: Date.now() - startMs });
}

function getTimingSummary() {
  const byLabel = new Map();
  for (const sample of timingSamples) {
    if (!byLabel.has(sample.label)) byLabel.set(sample.label, []);
    byLabel.get(sample.label).push(sample.ms);
  }
  const summary = {};
  for (const [label, values] of byLabel) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    summary[label] = {
      count: sorted.length,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      avgMs: Math.round(sum / sorted.length),
      p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    };
  }
  return summary;
}

function resetTimingSamples() {
  timingSamples.length = 0;
}

function isIntegrationEnabled() {
  return process.env.V3_INTEGRATION === '1'
    && Boolean(process.env.DATABASE_URL?.trim())
    && Boolean(process.env.REDIS_URL?.trim());
}

async function probeRealInfra() {
  if (!isIntegrationEnabled()) {
    return {
      available: false,
      reason: 'Set V3_INTEGRATION=1 with DATABASE_URL and REDIS_URL',
    };
  }

  try {
    const redisLib = require('../../../lib/redis');
    const { checkDatabase } = require('../../../lib/health');
    const [redis, database] = await Promise.all([
      redisLib.pingRedis(),
      checkDatabase(),
    ]);
    if (!redis.connected) {
      return { available: false, reason: `Redis unreachable: ${redis.error || 'unknown'}` };
    }
    if (!database.connected) {
      return { available: false, reason: `Database unreachable: ${database.error || 'unknown'}` };
    }
    return { available: true, redis, database };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

function applyIntegrationEnv() {
  process.env.TELEPHONY_V3_GLOBAL = process.env.TELEPHONY_V3_GLOBAL || 'true';
  process.env.TELEPHONY_V3_INGRESS_ENABLED = process.env.TELEPHONY_V3_INGRESS_ENABLED || 'true';
  process.env.TELEPHONY_V3_CALLMANAGER_ENABLED = process.env.TELEPHONY_V3_CALLMANAGER_ENABLED || 'true';
  process.env.TELEPHONY_V3_EXECUTOR_ENABLED = process.env.TELEPHONY_V3_EXECUTOR_ENABLED || 'true';
  process.env.TELEPHONY_V3_REDIS_REQUIRED = 'true';
  process.env.V3_METRICS_REDIS_MIRROR = 'false';
  process.env.NODE_ENV = 'test';
}

async function resetConnections() {
  const redisLib = require('../../../lib/redis');
  const db = require('../../../db');
  await redisLib.closeRedis().catch(() => {});
  await db.disconnectPrisma().catch(() => {});
}

async function getPrisma() {
  const db = require('../../../db');
  return db.getPrisma();
}

async function getRedis() {
  const { requireV3Redis } = require('../../../lib/telephony-v3/Redis/requireRedis');
  return requireV3Redis();
}

async function truncateV3Tables() {
  const prisma = await getPrisma();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "V3CommandOutbox",
      "V3LegTransition",
      "V3SessionTransition",
      "V3CallLeg",
      "V3CallSession",
      "ProcessedTelnyxEvent"
    RESTART IDENTITY CASCADE;
  `);
}

async function flushV3Redis() {
  const redis = await getRedis();
  const streams = require('../../../lib/telephony-v3/Redis/streams');
  await redis.flushdb();
  streams.resetConsumerGroupCacheForTests();
}

async function resetIntegrationState() {
  await truncateV3Tables();
  await flushV3Redis();
  const eventBus = require('../../../lib/telephony-v3/Events/domainEventBus');
  const { metrics } = require('../../../lib/telephony-v3/Utils/metrics');
  eventBus.resetForTests();
  metrics.resetMetricsForTests();
}

/**
 * @param {Object} opts
 */
function buildTelnyxWebhook(opts) {
  const {
    eventId,
    eventType = 'call.initiated',
    callControlId = `cc-${Date.now()}`,
    callSessionId = `cs-${Date.now()}`,
    state = 'parked',
    direction = 'incoming',
    clientState = { tenantId: TENANT_ID },
  } = opts;

  return {
    data: {
      id: eventId,
      event_type: eventType,
      payload: {
        call_control_id: callControlId,
        call_session_id: callSessionId,
        state,
        direction,
        client_state: clientState ? JSON.stringify(clientState) : undefined,
        from: '+15551111111',
        to: '+15552222222',
        connection_id: 'conn-integration',
      },
    },
  };
}

async function processNextIngressJob(workerId, blockMs = 2000) {
  const streams = require('../../../lib/telephony-v3/Redis/streams');
  const { dispatchIngressJob } = require('../../../lib/telephony-v3/Workers/ingressDispatcher');

  await streams.ensureConsumerGroup();
  const stale = await streams.claimStaleMessages(workerId, 0, 10);
  const fresh = await streams.readIngressBatch(workerId, 1, blockMs);
  const jobs = [...stale, ...fresh];
  if (!jobs.length) return null;

  const job = jobs[0];
  await dispatchIngressJob(job, { workerId });
  await streams.ackIngressJob(job.id);
  return job;
}

async function waitForPendingCount(expected, timeoutMs = 10000) {
  const streams = require('../../../lib/telephony-v3/Redis/streams');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = await streams.getPendingCount();
    if (pending === expected) return pending;
    await sleep(100);
  }
  return streams.getPendingCount();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  TENANT_ID,
  STREAM,
  REDIS,
  TTL,
  isIntegrationEnabled,
  probeRealInfra,
  applyIntegrationEnv,
  resetConnections,
  resetIntegrationState,
  truncateV3Tables,
  flushV3Redis,
  buildTelnyxWebhook,
  processNextIngressJob,
  waitForPendingCount,
  recordTiming,
  getTimingSummary,
  resetTimingSamples,
  sleep,
};
