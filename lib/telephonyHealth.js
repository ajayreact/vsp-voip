const MAX_TELEMETRY_EVENTS = 100;

const telemetryEvents = [];
let raceConditionPreventedCount = 0;

function recordTelemetryEvent({
  event,
  properties,
  tenantId,
  userId,
}) {
  if (!event) return null;

  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    event,
    tenantId: tenantId || null,
    userId: userId || null,
    properties: properties && typeof properties === 'object' ? properties : {},
    createdAt: new Date().toISOString(),
  };

  telemetryEvents.unshift(item);
  if (telemetryEvents.length > MAX_TELEMETRY_EVENTS) {
    telemetryEvents.length = MAX_TELEMETRY_EVENTS;
  }
  return item;
}

function recordRaceConditionPrevented(details = {}) {
  raceConditionPreventedCount += 1;
  recordTelemetryEvent({
    event: 'Call Control Race Prevented',
    properties: details,
  });
}

function getTelemetryFeed(limit = MAX_TELEMETRY_EVENTS) {
  return telemetryEvents.slice(0, Math.min(Number(limit) || MAX_TELEMETRY_EVENTS, MAX_TELEMETRY_EVENTS));
}

function getRaceConditionPreventedCount() {
  return raceConditionPreventedCount;
}

module.exports = {
  recordTelemetryEvent,
  recordRaceConditionPrevented,
  getTelemetryFeed,
  getRaceConditionPreventedCount,
};
