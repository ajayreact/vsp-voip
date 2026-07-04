const crypto = require('crypto');
const redisModule = require('./requireRedis');
const { STREAM, REDIS, RETENTION, WORKER } = require('../constants');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');

/** @type {boolean} */
let consumerGroupReady = false;

async function ensureConsumerGroup() {
  if (consumerGroupReady) return;
  const redis = await redisModule.requireV3Redis();
  try {
    await redis.xgroup('CREATE', STREAM.INGRESS, STREAM.CONSUMER_GROUP, '0', 'MKSTREAM');
  } catch (error) {
    if (!String(error.message).includes('BUSYGROUP')) {
      throw error;
    }
  }
  consumerGroupReady = true;
}

function ingressPayloadKey(payloadRef) {
  return `${REDIS.INGRESS_PAYLOAD_PREFIX}${payloadRef}`;
}

/**
 * Store webhook body outside the stream (stream carries payloadRef only).
 * @param {string} payloadRef
 * @param {Record<string, unknown>} body
 */
async function storeIngressPayload(payloadRef, body) {
  const redis = await redisModule.requireV3Redis();
  await redis.set(
    ingressPayloadKey(payloadRef),
    JSON.stringify(body),
    'EX',
    RETENTION.INGRESS_PAYLOAD_SEC,
  );
}

/**
 * @param {string} payloadRef
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function loadIngressPayload(payloadRef) {
  if (!payloadRef) return null;
  const redis = await redisModule.requireV3Redis();
  const raw = await redis.get(ingressPayloadKey(payloadRef));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, string>} fields
 * @returns {Promise<string>} stream message id
 */
async function enqueueIngressJob(fields) {
  const redis = await redisModule.requireV3Redis();
  await ensureConsumerGroup();
  const id = await redis.xadd(
    STREAM.INGRESS,
    'MAXLEN',
    '~',
    '100000',
    '*',
    ...Object.entries(fields).flat(),
  );
  metrics.ingressEnqueued({ event_type: fields.eventType || 'unknown' });
  v3Logger.info('ingress.enqueued', {
    ingressId: id,
    eventType: fields.eventType,
    callControlId: fields.callControlId,
    correlationId: fields.correlationId,
    payloadRef: fields.payloadRef || null,
  });
  return id;
}

/**
 * @param {string} consumerName
 * @param {number} [count]
 * @param {number} [blockMs]
 */
async function readIngressBatch(consumerName, count = 10, blockMs = 5000) {
  const redis = await redisModule.requireV3Redis();
  await ensureConsumerGroup();
  const result = await redis.xreadgroup(
    'GROUP',
    STREAM.CONSUMER_GROUP,
    consumerName,
    'COUNT',
    count,
    'BLOCK',
    blockMs,
    'STREAMS',
    STREAM.INGRESS,
    '>',
  );
  if (!result) return [];
  const [, messages] = result[0];
  return messages.map(([id, arr]) => ({
    id,
    fields: arrayToObject(arr),
  }));
}

function arrayToObject(arr) {
  const out = {};
  for (let i = 0; i < arr.length; i += 2) {
    out[arr[i]] = arr[i + 1];
  }
  return out;
}

async function ackIngressJob(messageId) {
  const redis = await redisModule.requireV3Redis();
  await redis.xack(STREAM.INGRESS, STREAM.CONSUMER_GROUP, messageId);
}

/**
 * Per-message delivery count from Redis PEL.
 * @param {string} messageId
 * @returns {Promise<number>}
 */
async function getMessageDeliveryCount(messageId) {
  const redis = await redisModule.requireV3Redis();
  try {
    const detail = await redis.xpending(
      STREAM.INGRESS,
      STREAM.CONSUMER_GROUP,
      messageId,
      messageId,
      1,
    );
    if (Array.isArray(detail) && detail.length > 0) {
      const row = detail[0];
      if (Array.isArray(row) && row.length >= 4) {
        return Number(row[3]) || 1;
      }
    }
  } catch {
    // message may not be pending (already acked)
  }
  return 1;
}

/**
 * @param {string} messageId
 * @param {Record<string, string>} fields
 * @param {string} reason
 * @param {number} [deliveryCount]
 */
async function moveToDlq(messageId, fields, reason, deliveryCount = null) {
  const redis = await redisModule.requireV3Redis();
  const count = deliveryCount ?? await getMessageDeliveryCount(messageId);
  await redis.xadd(
    STREAM.DLQ,
    'MAXLEN',
    '~',
    '50000',
    '*',
    'originalId',
    messageId,
    'reason',
    reason,
    'deliveryCount',
    String(count),
    'failedAt',
    new Date().toISOString(),
    ...Object.entries(fields).flat(),
  );
  await ackIngressJob(messageId);
  metrics.ingressDlq({ event_type: fields.eventType || 'unknown' });
  v3Logger.warn('ingress.dlq', { messageId, reason, deliveryCount: count, eventType: fields.eventType });
}

/**
 * Reclaim idle pending messages via XAUTOCLAIM (Redis 6.2+) or XCLAIM fallback.
 * @param {string} consumerName
 * @param {number} [minIdleMs]
 * @param {number} [count]
 */
async function claimStaleMessages(consumerName, minIdleMs = WORKER.STALE_CLAIM_MS, count = 10) {
  const redis = await redisModule.requireV3Redis();
  await ensureConsumerGroup();

  if (typeof redis.xautoclaim === 'function') {
    try {
      const result = await redis.xautoclaim(
        STREAM.INGRESS,
        STREAM.CONSUMER_GROUP,
        consumerName,
        minIdleMs,
        '0-0',
        'COUNT',
        count,
      );
      const messages = result?.[1] || [];
      return messages.map(([id, arr]) => ({ id, fields: arrayToObject(arr) }));
    } catch {
      // fall through to XCLAIM
    }
  }

  const pending = await redis.xpending(STREAM.INGRESS, STREAM.CONSUMER_GROUP, '-', '+', count);
  if (!pending.length) return [];
  const ids = pending
    .filter((row) => row[2] >= minIdleMs)
    .map((row) => row[0]);
  if (!ids.length) return [];
  const claimed = await redis.xclaim(
    STREAM.INGRESS,
    STREAM.CONSUMER_GROUP,
    consumerName,
    minIdleMs,
    ...ids,
  );
  return claimed.map(([id, arr]) => ({ id, fields: arrayToObject(arr) }));
}

async function getStreamDepth() {
  const redis = await redisModule.requireV3Redis({ allowOptional: true });
  if (!redis) return 0;
  try {
    return await redis.xlen(STREAM.INGRESS);
  } catch {
    return 0;
  }
}

async function getDlqDepth() {
  const redis = await redisModule.requireV3Redis({ allowOptional: true });
  if (!redis) return 0;
  try {
    return await redis.xlen(STREAM.DLQ);
  } catch {
    return 0;
  }
}

async function getQueueLagMs() {
  const redis = await redisModule.requireV3Redis({ allowOptional: true });
  if (!redis) return null;
  try {
    const info = await redis.xinfo('GROUPS', STREAM.INGRESS);
    const groups = parseXInfoGroups(info);
    const group = groups.find((g) => g.name === STREAM.CONSUMER_GROUP);
    return group?.lag ?? null;
  } catch {
    return null;
  }
}

async function getPendingCount() {
  const redis = await redisModule.requireV3Redis({ allowOptional: true });
  if (!redis) return 0;
  try {
    const summary = await redis.xpending(STREAM.INGRESS, STREAM.CONSUMER_GROUP);
    if (Array.isArray(summary) && summary.length >= 1) {
      return Number(summary[0]) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

function parseXInfoGroups(info) {
  const groups = [];
  for (let i = 0; i < info.length; i += 1) {
    if (Array.isArray(info[i])) {
      const row = info[i];
      const obj = {};
      for (let j = 0; j < row.length; j += 2) {
        obj[row[j]] = row[j + 1];
      }
      groups.push(obj);
    }
  }
  return groups;
}

function newIngressPayloadRef(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function resetConsumerGroupCacheForTests() {
  consumerGroupReady = false;
}

/**
 * Read messages from DLQ stream (non-destructive peek + ack helper).
 * @param {number} [count]
 */
async function readDlqMessages(count = 50) {
  const redis = await redisModule.requireV3Redis({ allowOptional: true });
  if (!redis) return [];
  const result = await redis.xread('COUNT', count, 'STREAMS', STREAM.DLQ, '0');
  if (!result) return [];
  const [, messages] = result[0];
  return messages.map(([id, arr]) => ({
    id,
    fields: arrayToObject(arr),
  }));
}

async function ackDlqMessage(messageId) {
  const redis = await redisModule.requireV3Redis({ allowOptional: true });
  if (!redis) return;
  await redis.xdel(STREAM.DLQ, messageId);
}

module.exports = {
  ensureConsumerGroup,
  storeIngressPayload,
  loadIngressPayload,
  enqueueIngressJob,
  readIngressBatch,
  ackIngressJob,
  getMessageDeliveryCount,
  moveToDlq,
  claimStaleMessages,
  getStreamDepth,
  getDlqDepth,
  getQueueLagMs,
  getPendingCount,
  newIngressPayloadRef,
  resetConsumerGroupCacheForTests,
  readDlqMessages,
  ackDlqMessage,
};
