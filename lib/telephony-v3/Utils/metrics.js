/** Prometheus-compatible metrics with bounded memory and optional Redis mirroring for workers. */

const crypto = require('crypto');
const { METRICS } = require('../constants');

const counters = new Map();
const gauges = new Map();
/** @type {Map<string, { count: number, sum: number, samples: number[] }>} */
const histograms = new Map();

/** @type {import('ioredis').Redis|null} */
let mirrorRedis = null;
let mirrorReady = false;

function counterKey(name, labels) {
  return `${name}|${JSON.stringify(labels || {})}`;
}

function labelsHash(labels) {
  return crypto.createHash('sha1').update(JSON.stringify(labels || {})).digest('hex').slice(0, 12);
}

async function getMirrorRedis() {
  if (mirrorReady) return mirrorRedis;
  mirrorReady = true;
  try {
    const { requireV3Redis } = require('../Redis/requireRedis');
    mirrorRedis = await requireV3Redis({ allowOptional: true });
  } catch {
    mirrorRedis = null;
  }
  return mirrorRedis;
}

async function mirrorCounter(name, labels, delta) {
  if (process.env.V3_METRICS_REDIS_MIRROR === 'false') return;
  const redis = await getMirrorRedis();
  if (!redis || typeof redis.incrby !== 'function') return;
  const key = `${METRICS.REDIS_PREFIX}counter:${name}:${labelsHash(labels)}`;
  await redis.incrby(key, delta).catch(() => {});
}

async function mirrorGauge(name, labels, value) {
  if (process.env.V3_METRICS_REDIS_MIRROR === 'false') return;
  const redis = await getMirrorRedis();
  if (!redis || typeof redis.set !== 'function') return;
  const key = `${METRICS.REDIS_PREFIX}gauge:${name}:${labelsHash(labels)}`;
  await redis.set(key, String(value), 'EX', 120).catch(() => {});
}

async function mirrorHistogram(name, labels, value) {
  if (process.env.V3_METRICS_REDIS_MIRROR === 'false') return;
  const redis = await getMirrorRedis();
  if (!redis || typeof redis.multi !== 'function') return;
  const base = `${METRICS.REDIS_PREFIX}hist:${name}:${labelsHash(labels)}`;
  await redis.multi().incrby(`${base}:count`, 1).incrbyfloat(`${base}:sum`, value).exec().catch(() => {});
}

function incCounter(name, labels = {}, value = 1) {
  const key = counterKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + value);
  mirrorCounter(name, labels, value);
}

function setGauge(name, labels = {}, value) {
  const key = counterKey(name, labels);
  gauges.set(key, value);
  mirrorGauge(name, labels, value);
}

function observeHistogram(name, labels = {}, value) {
  const key = counterKey(name, labels);
  let bucket = histograms.get(key);
  if (!bucket) {
    bucket = { count: 0, sum: 0, samples: [] };
    histograms.set(key, bucket);
  }
  bucket.count += 1;
  bucket.sum += value;
  bucket.samples.push(value);
  if (bucket.samples.length > METRICS.HISTOGRAM_MAX_SAMPLES) {
    bucket.samples.shift();
  }
  mirrorHistogram(name, labels, value);
}

function formatLabels(labels) {
  const entries = Object.entries(labels || {});
  if (!entries.length) return '';
  return `{${entries.map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`).join(',')}}`;
}

async function scanMirrorValues(prefix) {
  const redis = await getMirrorRedis();
  if (!redis) return new Map();

  const found = new Map();
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100).catch(() => ['0', []]);
    cursor = next;
    for (const key of keys) {
      const val = await redis.get(key).catch(() => null);
      if (val != null) found.set(key, Number(val));
    }
  } while (cursor !== '0');
  return found;
}

async function renderPrometheus() {
  const lines = [];
  const seen = new Set();

  for (const [key, value] of counters) {
    const [name, labelJson] = key.split('|');
    const line = `vsp_telephony_v3_${name}${formatLabels(JSON.parse(labelJson))} ${value}`;
    lines.push(line);
    seen.add(name);
  }

  const mirroredCounters = await scanMirrorValues(`${METRICS.REDIS_PREFIX}counter:`);
  for (const [redisKey, value] of mirroredCounters) {
    const parts = redisKey.replace(`${METRICS.REDIS_PREFIX}counter:`, '').split(':');
    const name = parts[0];
    if (!seen.has(name)) {
      lines.push(`vsp_telephony_v3_${name} ${value}`);
    }
  }

  for (const [key, value] of gauges) {
    const [name, labelJson] = key.split('|');
    lines.push(`vsp_telephony_v3_${name}${formatLabels(JSON.parse(labelJson))} ${value}`);
  }

  const mirroredGauges = await scanMirrorValues(`${METRICS.REDIS_PREFIX}gauge:`);
  for (const [redisKey, value] of mirroredGauges) {
    const parts = redisKey.replace(`${METRICS.REDIS_PREFIX}gauge:`, '').split(':');
    const name = parts[0];
    lines.push(`vsp_telephony_v3_${name} ${value}`);
  }

  for (const [key, bucket] of histograms) {
    const [name, labelJson] = key.split('|');
    const labels = formatLabels(JSON.parse(labelJson));
    if (bucket.count > 0) {
      lines.push(`vsp_telephony_v3_${name}_count${labels} ${bucket.count}`);
      lines.push(`vsp_telephony_v3_${name}_sum${labels} ${bucket.sum}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function resetMetricsForTests() {
  counters.clear();
  gauges.clear();
  histograms.clear();
  mirrorRedis = null;
  mirrorReady = false;
}

const metrics = {
  ingressReceived: (labels) => incCounter('ingress_received_total', labels),
  ingressDuplicate: (labels) => incCounter('ingress_duplicate_total', labels),
  ingressEnqueued: (labels) => incCounter('ingress_enqueued_total', labels),
  ingressDlq: (labels) => incCounter('ingress_dlq_total', labels),
  workerProcessed: (labels) => incCounter('worker_processed_total', labels),
  workerFailed: (labels) => incCounter('worker_failed_total', labels),
  outboxEnqueued: (labels) => incCounter('outbox_enqueued_total', labels),
  outboxClaimed: (labels, n = 1) => incCounter('outbox_claimed_total', labels, n),
  outboxSent: (labels) => incCounter('outbox_sent_total', labels),
  outboxDead: (labels) => incCounter('outbox_dead_total', labels),
  redisUnavailable: (labels) => incCounter('redis_unavailable_total', labels),
  setQueueDepth: (value) => setGauge('ingress_queue_depth', {}, value),
  setDlqDepth: (value) => setGauge('ingress_dlq_depth', {}, value),
  setOutboxPending: (value) => setGauge('outbox_pending', {}, value),
  setOutboxProcessing: (value) => setGauge('outbox_processing', {}, value),
  observeWorkerDuration: (ms, labels) => observeHistogram('worker_process_duration_seconds', labels, ms / 1000),
  fsmInvalid: (labels) => incCounter('fsm_invalid_total', labels),
  domainEventPublished: (labels) => incCounter('domain_event_published_total', labels),
  policyEvaluated: (labels) => incCounter('policy_evaluated_total', labels),
  commandIntentEnqueued: (labels) => incCounter('command_intent_enqueued_total', labels),
  callManagerProcessed: (labels) => incCounter('callmanager_processed_total', labels),
  callManagerRetry: (labels) => incCounter('callmanager_optimistic_retry_total', labels),
  commandsStarted: (labels) => incCounter('commands_started_total', labels),
  commandsCompleted: (labels) => incCounter('commands_completed_total', labels),
  commandsFailed: (labels) => incCounter('commands_failed_total', labels),
  commandRetry: (labels) => incCounter('command_retry_total', labels),
  commandDlq: (labels) => incCounter('command_dlq_total', labels),
  observeCommandDuration: (ms, labels) => observeHistogram('command_execution_duration_seconds', labels, ms / 1000),
  deskRoute: (labels) => incCounter('desk_route_total', labels),
  deskRouteFailed: (labels) => incCounter('desk_route_failed', labels),
  observeDeskRouteDuration: (ms, labels) => observeHistogram('desk_route_duration_seconds', labels, ms / 1000),
  mobileRoute: (labels) => incCounter('mobile_route_total', labels),
  mobileRouteFailed: (labels) => incCounter('mobile_route_failed', labels),
  observeMobileRouteDuration: (ms, labels) => observeHistogram('mobile_route_duration_seconds', labels, ms / 1000),
  mobileDestinationResolution: (labels) => incCounter('mobile_destination_resolution_total', labels),
  pstnRoute: (labels) => incCounter('pstn_route_total', labels),
  pstnRouteFailed: (labels) => incCounter('pstn_route_failed', labels),
  observePstnRouteDuration: (ms, labels) => observeHistogram('pstn_route_duration_seconds', labels, ms / 1000),
  pstnDestinationResolution: (labels) => incCounter('pstn_destination_resolution_total', labels),
  holdTotal: (labels) => incCounter('hold_total', labels),
  holdFailed: (labels) => incCounter('hold_failed', labels),
  observeHoldDuration: (ms, labels) => observeHistogram('hold_duration_seconds', labels, ms / 1000),
  transferTotal: (labels) => incCounter('transfer_total', labels),
  transferFailed: (labels) => incCounter('transfer_failed_total', labels),
  observeTransferDuration: (ms, labels) => observeHistogram('transfer_duration_seconds', labels, ms / 1000),
  recordingTotal: (labels) => incCounter('recording_total', labels),
  recordingFailed: (labels) => incCounter('recording_failed_total', labels),
  observeRecordingDuration: (ms, labels) => observeHistogram('recording_duration_seconds', labels, ms / 1000),
  voicemailTotal: (labels) => incCounter('voicemail_total', labels),
  voicemailFailed: (labels) => incCounter('voicemail_failed_total', labels),
  observeVoicemailDuration: (ms, labels) => observeHistogram('voicemail_duration_seconds', labels, ms / 1000),
  conferenceTotal: (labels) => incCounter('conference_total', labels),
  conferenceFailed: (labels) => incCounter('conference_failed_total', labels),
  observeConferenceDuration: (ms, labels) => observeHistogram('conference_duration_seconds', labels, ms / 1000),
  conferenceParticipants: (labels) => incCounter('conference_participants', labels),
  conferenceRecordingTotal: (labels) => incCounter('conference_recording_total', labels),
  queueTotal: (labels) => incCounter('queue_total', labels),
  observeQueueWaitDuration: (ms, labels) => observeHistogram('queue_wait_duration_seconds', labels, ms / 1000),
  queueAgentSelection: (labels) => incCounter('queue_agent_selection_total', labels),
  queueTimeout: (labels) => incCounter('queue_timeout_total', labels),
  queueRetry: (labels) => incCounter('queue_retry_total', labels),
  queueOverflow: (labels) => incCounter('queue_overflow_total', labels),
  ivrTotal: (labels) => incCounter('ivr_total', labels),
  observeIvrDuration: (ms, labels) => observeHistogram('ivr_duration_seconds', labels, ms / 1000),
  ivrInputTotal: (labels) => incCounter('ivr_input_total', labels),
  ivrInvalidTotal: (labels) => incCounter('ivr_invalid_total', labels),
  ivrTimeoutTotal: (labels) => incCounter('ivr_timeout_total', labels),
  ivrRouteTotal: (labels) => incCounter('ivr_route_total', labels),
  policyDenied: (labels) => incCounter('policy_denied_total', labels),
  tenantBootstrapSuccess: (labels) => incCounter('tenant_bootstrap_success_total', labels),
  tenantBootstrapFailed: (labels) => incCounter('tenant_bootstrap_failed_total', labels),
  sessionCleanupTotal: (labels, value = 1) => incCounter('session_cleanup_total', labels, value),
  timerExecutionTotal: (labels) => incCounter('timer_execution_total', labels),
  replayTotal: (labels, value = 1) => incCounter('replay_total', labels, value),
  outboxCleanupTotal: (labels, value = 1) => incCounter('outbox_cleanup_total', labels, value),
  executorLeaseRenewal: (labels) => incCounter('executor_lease_renewal_total', labels),
  destinationResolution: (labels) => incCounter('destination_resolution_total', labels),
  renderPrometheus,
  resetMetricsForTests,
};

module.exports = { metrics };
