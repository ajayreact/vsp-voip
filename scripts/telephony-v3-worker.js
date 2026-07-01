#!/usr/bin/env node
/**
 * VSP Phone V3 telephony worker — Phase 1.5
 * Consumes Redis Stream ingress jobs and runs outbox infrastructure tick.
 */
require('dotenv').config();

const crypto = require('crypto');
const {
  runIngressWorkerLoop,
  runOutboxWorkerTick,
  getInFlightIngressCount,
} = require('../lib/telephony-v3/Workers/ingressWorker');
const { validateWorkerEnv } = require('../lib/telephony-v3/Utils/workerEnv');
const { WORKER } = require('../lib/telephony-v3/constants');
const { v3Logger } = require('../lib/telephony-v3/Utils/v3Logger');

const workerId =
  process.env.V3_WORKER_ID?.trim() ||
  `worker-${process.env.HOSTNAME || crypto.randomUUID().slice(0, 8)}`;
let running = true;
let draining = false;

function requestShutdown(signal) {
  v3Logger.info('telephony_v3_worker.shutdown_requested', { workerId, signal });
  running = false;
  draining = true;
}

process.on('SIGINT', () => requestShutdown('SIGINT'));
process.on('SIGTERM', () => requestShutdown('SIGTERM'));

async function verifyConnectivity() {
  const { checkDatabase } = require('../lib/health');
  const redisLib = require('../lib/redis');

  const database = await checkDatabase();
  if (!database.connected) {
    throw new Error(`DATABASE_URL unreachable: ${database.error || 'connection failed'}`);
  }

  const redis = await redisLib.pingRedis();
  if (!redis.connected) {
    throw new Error(`REDIS_URL unreachable: ${redis.error || 'connection failed'}`);
  }
}

async function outboxLoop() {
  while (running || getInFlightIngressCount() > 0) {
    try {
      const result = await runOutboxWorkerTick(workerId);
      if (result.processed > 0) {
        v3Logger.info('outbox.tick', { workerId, processed: result.processed });
      }
    } catch (error) {
      v3Logger.error('outbox.tick_failed', { workerId, error: error.message });
    }
    if (!running) break;
    await new Promise((r) => setTimeout(r, Number(process.env.V3_OUTBOX_POLL_MS || 500)));
  }
}

async function waitForDrain() {
  const deadline = Date.now() + WORKER.SHUTDOWN_DRAIN_MS;
  while (getInFlightIngressCount() > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (getInFlightIngressCount() > 0) {
    v3Logger.warn('telephony_v3_worker.drain_timeout', {
      workerId,
      inFlight: getInFlightIngressCount(),
    });
  }
}

async function main() {
  validateWorkerEnv();
  await verifyConnectivity();
  v3Logger.info('telephony_v3_worker.boot', { workerId });
  const outboxPromise = outboxLoop();

  await runIngressWorkerLoop({
    workerId,
    running: () => running,
    onDraining: () => draining,
  });

  await waitForDrain();
  await outboxPromise;
  v3Logger.info('telephony_v3_worker.exit', { workerId });
  process.exit(0);
}

main().catch((error) => {
  v3Logger.error('telephony_v3_worker.fatal', { error: error.message });
  process.exit(1);
});
