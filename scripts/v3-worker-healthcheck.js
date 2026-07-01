#!/usr/bin/env node
/**
 * Docker healthcheck for telephony-v3-worker.
 * Exits 0 when this worker (or any worker when V3_WORKER_ID unset) has a fresh Redis heartbeat.
 */
require('dotenv').config();

const { listActiveWorkers } = require('../lib/telephony-v3/Redis/heartbeat');
const { TTL } = require('../lib/telephony-v3/constants');

async function main() {
  const workerId = process.env.V3_WORKER_ID?.trim();
  const { workers, activeCount } = await listActiveWorkers(TTL.HEARTBEAT_SEC);

  if (workerId) {
    const self = workers.find((worker) => worker.workerId === workerId);
    if (!self) {
      process.exit(1);
    }
    process.exit(0);
  }

  if (activeCount > 0) {
    process.exit(0);
  }

  process.exit(1);
}

main().catch(() => process.exit(1));
