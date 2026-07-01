const { WORKER, GLOBAL_FLAGS } = require('../constants');
const streams = require('../Redis/streams');
const { dispatchIngressJob } = require('./ingressDispatcher');
const { recordWorkerHeartbeat } = require('../Redis/heartbeat');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { purgeProcessedTelnyxEvents } = require('../Maintenance/retention');
const { purgeOutboxRows } = require('../Maintenance/outboxRetention');
const timerService = require('../Timer/timerService');

/** @type {Promise<void>|null} */
let outboxTickInFlight = null;
/** @type {Set<string>} */
const inFlightIngressJobs = new Set();
let maintenanceCounter = 0;

/**
 * @param {{ workerId: string, running?: () => boolean, onDraining?: () => boolean }} options
 */
async function runIngressWorkerLoop(options) {
  const workerId = options.workerId;
  const isRunning = options.running || (() => true);
  const isDraining = options.onDraining || (() => false);

  v3Logger.info('worker.started', { workerId, stream: 'telephony-ingress' });

  while (isRunning() || inFlightIngressJobs.size > 0) {
    await recordWorkerHeartbeat(workerId, {
      role: 'ingress',
      inFlight: inFlightIngressJobs.size,
      draining: isDraining(),
    });

    if (isDraining() && inFlightIngressJobs.size === 0) {
      break;
    }

    if (!isRunning() && inFlightIngressJobs.size > 0) {
      await sleep(200);
      continue;
    }

    try {
      maintenanceCounter += 1;
      if (maintenanceCounter % 120 === 0) {
        await purgeProcessedTelnyxEvents().catch((error) => {
          v3Logger.warn('maintenance.purge_failed', { error: error.message });
        });
        await purgeOutboxRows().catch((error) => {
          v3Logger.warn('maintenance.outbox_purge_failed', { error: error.message });
        });
      }

      if (maintenanceCounter % 10 === 0) {
        await timerService.pollExpiredTimers(50).catch((error) => {
          v3Logger.warn('timer.poll_failed', { error: error.message });
        });
      }

      const blockMs = isRunning() ? WORKER.DEFAULT_BLOCK_MS : WORKER.SHUTDOWN_BLOCK_MS;
      const stale = await streams.claimStaleMessages(workerId);
      const fresh = isRunning()
        ? await streams.readIngressBatch(workerId, WORKER.DEFAULT_COUNT, blockMs)
        : [];
      const jobs = [...stale, ...fresh];

      for (const job of jobs) {
        if (isDraining() && inFlightIngressJobs.size === 0 && !isRunning()) break;

        inFlightIngressJobs.add(job.id);
        try {
          await dispatchIngressJob(job, { workerId });
          await streams.ackIngressJob(job.id);
        } catch (error) {
          const deliveryCount = await streams.getMessageDeliveryCount(job.id);
          metrics.workerFailed({ event_type: job.fields.eventType || 'unknown' });
          v3Logger.error('worker.job_failed', {
            workerId,
            ingressId: job.id,
            error: error.message,
            deliveryCount,
          });

          if (deliveryCount >= WORKER.MAX_DELIVERY_ATTEMPTS) {
            await streams.moveToDlq(job.id, job.fields, error.message, deliveryCount);
          }
        } finally {
          inFlightIngressJobs.delete(job.id);
        }
      }
    } catch (error) {
      v3Logger.error('worker.loop_error', { workerId, error: error.message });
      await sleep(1000);
    }
  }

  v3Logger.info('worker.stopped', { workerId, drainedJobs: true });
}

/**
 * Process outbox infrastructure (no Telnyx) — mark sent + ack.
 * @param {string} workerId
 */
async function runOutboxWorkerTick(workerId) {
  if (process.env[GLOBAL_FLAGS.TELEPHONY_V3_OUTBOX_PAUSED] === 'true') {
    return { processed: 0, paused: true };
  }

  if (outboxTickInFlight) {
    return { processed: 0, skipped: true };
  }

  outboxTickInFlight = (async () => {
    const executorEnabled = process.env[GLOBAL_FLAGS.TELEPHONY_V3_EXECUTOR_ENABLED] === 'true';

    if (executorEnabled) {
      const { processCommandBatch } = require('../Executor/commandExecutor');
      return processCommandBatch(workerId);
    }

    const {
      claimPendingCommands,
      markCommandSent,
      acknowledgeCommand,
    } = require('../Outbox/commandOutbox');

    const rows = await claimPendingCommands(workerId);
    let processed = 0;

    for (const row of rows) {
      try {
        await markCommandSent(row.id, workerId, { telnyxRequestId: `phase1-stub-${row.id}` });
        await acknowledgeCommand(row.id, workerId);
        processed += 1;
      } catch (error) {
        const { markCommandFailed } = require('../Outbox/commandOutbox');
        await markCommandFailed(row.id, error.message, workerId).catch(() => {});
        v3Logger.error('outbox.tick_command_failed', {
          workerId,
          commandId: row.id,
          error: error.message,
        });
      }
    }

    return { processed, paused: false };
  })();

  try {
    return await outboxTickInFlight;
  } finally {
    outboxTickInFlight = null;
  }
}

function getInFlightIngressCount() {
  return inFlightIngressJobs.size;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  runIngressWorkerLoop,
  runOutboxWorkerTick,
  getInFlightIngressCount,
};
