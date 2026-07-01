const crypto = require('crypto');
const { QUEUE_STATUS } = require('./queueConstants');

/** @type {Map<string, { enteredAt: number, queueId: string }>} */
const activeQueueEntries = new Map();

/** @type {Map<string, number>} */
const roundRobinPointers = new Map();

function resetQueueStateForTests() {
  activeQueueEntries.clear();
  roundRobinPointers.clear();
}

function generateQueueId() {
  return `queue-${crypto.randomUUID()}`;
}

/**
 * @param {Record<string, unknown>|null|undefined} snapshot
 */
function getQueueFromSnapshot(snapshot) {
  const q = snapshot?.queue;
  if (!q || typeof q !== 'object') return null;
  return /** @type {Record<string, unknown>} */ (q);
}

/**
 * @param {Record<string, unknown>} input
 */
function buildInitialQueueState(input) {
  return {
    queueId: input.queueId,
    ringGroupId: input.ringGroupId ?? null,
    queueName: input.queueName ?? null,
    status: QUEUE_STATUS.OPEN,
    ringStrategy: input.ringStrategy ?? 'ROUND_ROBIN',
    entrySource: input.entrySource ?? 'DIRECT',
    callerCallControlId: input.callerCallControlId ?? null,
    callerLegId: input.callerLegId ?? null,
    agents: input.agents ?? [],
    waitingEntries: [],
    retryCount: 0,
    roundRobinPointer: 0,
    recordingActive: false,
    overflowDestination: input.overflowDestination ?? null,
    createdAt: new Date().toISOString(),
    enteredAt: null,
    connectedAt: null,
    maxWaitingTimeSec: input.maxWaitingTimeSec ?? 300,
    agentTimeoutSec: input.agentTimeoutSec ?? 25,
  };
}

/**
 * @param {Record<string, unknown>} queue
 * @param {Record<string, unknown>} entry
 */
function addWaitingEntry(queue, entry) {
  const waitingEntries = Array.isArray(queue.waitingEntries) ? [...queue.waitingEntries] : [];
  waitingEntries.push({
    ...entry,
    enteredAt: entry.enteredAt || new Date().toISOString(),
    status: 'WAITING',
  });
  return {
    ...queue,
    waitingEntries,
    status: QUEUE_STATUS.WAITING,
    enteredAt: queue.enteredAt || new Date().toISOString(),
  };
}

/**
 * @param {Record<string, unknown>} queue
 * @param {string} sessionId
 */
function removeWaitingEntry(queue, sessionId) {
  const waitingEntries = (Array.isArray(queue.waitingEntries) ? queue.waitingEntries : [])
    .filter((e) => e.sessionId !== sessionId);
  return { ...queue, waitingEntries };
}

/**
 * @param {string} sessionId
 * @param {string} queueId
 */
function registerQueueEntry(sessionId, queueId) {
  activeQueueEntries.set(sessionId, { enteredAt: Date.now(), queueId });
}

/**
 * @param {string} sessionId
 */
function unregisterQueueEntry(sessionId) {
  activeQueueEntries.delete(sessionId);
}

/**
 * @param {string} sessionId
 */
function isInQueue(sessionId) {
  return activeQueueEntries.has(sessionId);
}

/**
 * @param {string} sessionId
 * @param {number} maxWaitingTimeSec
 */
function isQueueWaitTimedOut(sessionId, maxWaitingTimeSec) {
  const entry = activeQueueEntries.get(sessionId);
  if (!entry) return false;
  return Date.now() - entry.enteredAt >= maxWaitingTimeSec * 1000;
}

/**
 * @param {string} queueKey
 */
function getRoundRobinPointer(queueKey) {
  return roundRobinPointers.get(queueKey) ?? 0;
}

/**
 * @param {string} queueKey
 * @param {number} pointer
 */
function setRoundRobinPointer(queueKey, pointer) {
  roundRobinPointers.set(queueKey, pointer);
}

/**
 * @param {Record<string, unknown>} queue
 */
function getWaitingCount(queue) {
  return Array.isArray(queue.waitingEntries) ? queue.waitingEntries.length : 0;
}

module.exports = {
  resetQueueStateForTests,
  generateQueueId,
  getQueueFromSnapshot,
  buildInitialQueueState,
  addWaitingEntry,
  removeWaitingEntry,
  registerQueueEntry,
  unregisterQueueEntry,
  isInQueue,
  isQueueWaitTimedOut,
  getRoundRobinPointer,
  setRoundRobinPointer,
  getWaitingCount,
};
