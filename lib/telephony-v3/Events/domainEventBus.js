const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');

/** @type {Map<string, Set<(event: import('../types').V3DomainEvent) => void|Promise<void>>>} */
const subscribers = new Map();

/** @type {import('../types').V3DomainEvent[]} */
const replayLog = [];
const MAX_REPLAY_LOG = 5000;

/**
 * @param {string} eventType
 * @param {(event: import('../types').V3DomainEvent) => void|Promise<void>} handler
 * @returns {() => void} unsubscribe
 */
function subscribe(eventType, handler) {
  if (!subscribers.has(eventType)) {
    subscribers.set(eventType, new Set());
  }
  subscribers.get(eventType).add(handler);
  return () => subscribers.get(eventType)?.delete(handler);
}

/**
 * @param {import('../types').V3DomainEvent} event
 */
async function publish(event) {
  replayLog.push(event);
  if (replayLog.length > MAX_REPLAY_LOG) {
    replayLog.shift();
  }

  metrics.domainEventPublished({ event_type: event.eventType });
  v3Logger.info('domain.event', {
    eventType: event.eventType,
    eventId: event.eventId,
    sessionId: event.sessionId,
    tenantId: event.tenantId,
  });

  const handlers = subscribers.get(event.eventType);
  if (!handlers?.size) return;

  for (const handler of handlers) {
    try {
      await handler(event);
    } catch (error) {
      v3Logger.error('domain.event.handler_failed', {
        eventType: event.eventType,
        error: error.message,
      });
    }
  }
}

/**
 * Replay-ready interface — returns events since cursor.
 * @param {{ sinceIndex?: number, sessionId?: string, eventType?: string }} filter
 */
function replay(filter = {}) {
  const since = filter.sinceIndex ?? 0;
  return replayLog
    .slice(since)
    .filter((e) => {
      if (filter.sessionId && e.sessionId !== filter.sessionId) return false;
      if (filter.eventType && e.eventType !== filter.eventType) return false;
      return true;
    });
}

function resetForTests() {
  subscribers.clear();
  replayLog.length = 0;
}

function getReplayLength() {
  return replayLog.length;
}

module.exports = {
  subscribe,
  publish,
  replay,
  resetForTests,
  getReplayLength,
};
