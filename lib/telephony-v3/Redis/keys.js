const { STREAM, REDIS, TTL } = require('../constants');

function sessionKey(sessionId) {
  return `${REDIS.SESSION_PREFIX}${sessionId}`;
}

function legKey(callControlId) {
  return `${REDIS.LEG_PREFIX}${callControlId}`;
}

function lockKey(sessionId) {
  return `${REDIS.LOCK_PREFIX}${sessionId}`;
}

function bootstrapLockKey(callControlId) {
  return `${REDIS.LOCK_PREFIX}bootstrap:${callControlId}`;
}

function timerKey(sessionId, name) {
  return `${REDIS.TIMER_PREFIX}${sessionId}:${name}`;
}

function flagKey(tenantId) {
  return `${REDIS.FLAG_PREFIX}${tenantId}`;
}

function heartbeatKey(workerId) {
  return `${REDIS.HEARTBEAT_PREFIX}${workerId}`;
}

function sipKey(tenantId, username) {
  return `${REDIS.SIP_PREFIX}${tenantId}:${String(username || '').trim().toLowerCase()}`;
}

function activeTenantKey(tenantId) {
  return `${REDIS.ACTIVE_PREFIX}${tenantId}`;
}

module.exports = {
  STREAM,
  sessionKey,
  legKey,
  lockKey,
  bootstrapLockKey,
  timerKey,
  flagKey,
  heartbeatKey,
  sipKey,
  activeTenantKey,
  TTL,
};
