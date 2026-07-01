const { getPrisma } = require('../internal/prisma');
const {
  POLICY_ACTION,
  RECORDING_MODE,
  RECORDING_ELIGIBLE_LEG_STATES,
  RECORDING_ELIGIBLE_SESSION_STATES,
  DEFAULT_LIMITS,
} = require('./recordingConstants');

/** @type {Map<string, number>} */
const recordingRetriesBySession = new Map();

function resetRecordingPolicyForTests() {
  recordingRetriesBySession.clear();
}

/**
 * Map tenant RecordingPolicy enum to flags.
 * @param {string|null|undefined} policy
 */
function mapTenantRecordingPolicy(policy) {
  switch (policy) {
    case 'ALWAYS':
      return { alwaysRecord: true, recordInbound: true, recordOutbound: true };
    case 'INBOUND_ONLY':
      return { alwaysRecord: false, recordInbound: true, recordOutbound: false };
    case 'OUTBOUND_ONLY':
      return { alwaysRecord: false, recordInbound: false, recordOutbound: true };
    case 'ON_DEMAND':
      return { alwaysRecord: false, recordInbound: false, recordOutbound: false };
    case 'DISABLED':
    default:
      return { alwaysRecord: false, recordInbound: false, recordOutbound: false };
  }
}

/**
 * @param {string|null|undefined} direction
 */
function isInboundDirection(direction) {
  const d = String(direction || '').toLowerCase();
  return d === 'inbound' || d === 'incoming';
}

/**
 * @param {string|null|undefined} direction
 */
function isOutboundDirection(direction) {
  const d = String(direction || '').toLowerCase();
  return d === 'outbound' || d === 'outgoing';
}

/**
 * Evaluate recording policy (Phase 3.6).
 *
 * @param {{
 *   tenantId: string,
 *   sessionId: string,
 *   sessionState: string,
 *   legState: string,
 *   direction?: string|null,
 *   mode?: string,
 *   recordingEnabled?: boolean,
 *   observeOnly?: boolean,
 *   alwaysRecord?: boolean,
 *   recordInbound?: boolean,
 *   recordOutbound?: boolean,
 *   retentionDays?: number,
 *   retryCount?: number,
 *   action?: string,
 * }} input
 */
async function evaluateRecordingPolicy(input) {
  const prisma = await getPrisma();
  const rules = [];
  const limits = {
    maxRecordingRetries: DEFAULT_LIMITS.maxRecordingRetries,
    retentionDays: input.retentionDays ?? DEFAULT_LIMITS.retentionDays,
  };

  if (!input.recordingEnabled) {
    rules.push({ rule: 'recording_enabled', result: 'deny', message: 'Recording disabled for tenant' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'recording_disabled', input.observeOnly, limits);
  }

  const isStop = input.action === 'STOP';

  if (!isStop && !RECORDING_ELIGIBLE_SESSION_STATES.has(input.sessionState)) {
    rules.push({ rule: 'session_state', result: 'deny', message: `Recording not allowed in ${input.sessionState}` });
    return buildDecision(POLICY_ACTION.DENY, rules, 'invalid_session_state', input.observeOnly, limits);
  }

  if (!isStop && !RECORDING_ELIGIBLE_LEG_STATES.has(input.legState)) {
    rules.push({ rule: 'leg_state', result: 'deny', message: `Recording not allowed on leg in ${input.legState}` });
    return buildDecision(POLICY_ACTION.DENY, rules, 'invalid_leg_state', input.observeOnly, limits);
  }

  let tenantPolicy = {
    alwaysRecord: input.alwaysRecord ?? false,
    recordInbound: input.recordInbound ?? false,
    recordOutbound: input.recordOutbound ?? false,
  };

  if (input.tenantId) {
    const security = await prisma.tenantSecuritySettings.findUnique({
      where: { tenantId: input.tenantId },
      select: { recordingPolicy: true },
    });
    if (security?.recordingPolicy) {
      tenantPolicy = mapTenantRecordingPolicy(security.recordingPolicy);
      rules.push({ rule: 'tenant_recording_policy', result: 'pass', message: security.recordingPolicy });
    }
  }

  const mode = input.mode || RECORDING_MODE.MANUAL;
  if (!isStop) {
    if (mode === RECORDING_MODE.MANUAL) {
      rules.push({ rule: 'manual_recording', result: 'pass' });
    } else {
      const inbound = isInboundDirection(input.direction);
      const outbound = isOutboundDirection(input.direction);
      const autoAllowed = tenantPolicy.alwaysRecord
        || (tenantPolicy.recordInbound && inbound)
        || (tenantPolicy.recordOutbound && outbound);

      if (!autoAllowed) {
        rules.push({ rule: 'automatic_recording', result: 'deny', message: 'Automatic recording not permitted' });
        return buildDecision(POLICY_ACTION.DENY, rules, 'auto_not_allowed', input.observeOnly, {
          ...limits,
          ...tenantPolicy,
        });
      }
      rules.push({ rule: 'automatic_recording', result: 'pass' });
    }

    const retryCount = input.retryCount ?? recordingRetriesBySession.get(input.sessionId) ?? 0;
    if (retryCount >= limits.maxRecordingRetries) {
      rules.push({ rule: 'max_recording_retries', result: 'deny', message: 'Maximum recording retries exceeded' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'max_retries', input.observeOnly, { ...limits, retryCount });
    }
  } else {
    rules.push({ rule: 'recording_stop', result: 'pass' });
  }

  rules.push({ rule: 'retention_policy', result: 'pass', message: String(limits.retentionDays) });
  rules.push({ rule: 'recording_permissions', result: 'pass' });

  return buildDecision(POLICY_ACTION.ALLOW, rules, 'allowed', input.observeOnly, {
    ...limits,
    ...tenantPolicy,
    retryCount: isStop ? 0 : (input.retryCount ?? recordingRetriesBySession.get(input.sessionId) ?? 0),
  });
}

/**
 * @param {string} sessionId
 */
function recordRecordingRetry(sessionId) {
  const prev = recordingRetriesBySession.get(sessionId) || 0;
  recordingRetriesBySession.set(sessionId, prev + 1);
}

/**
 * @param {string} sessionId
 */
function clearRecordingRetries(sessionId) {
  recordingRetriesBySession.delete(sessionId);
}

function buildDecision(action, rules, reason, observeOnly, extra = {}) {
  const enforced = !observeOnly;
  const effectiveAction = observeOnly && action === POLICY_ACTION.DENY
    ? POLICY_ACTION.ALLOW
    : action;

  return {
    action,
    effectiveAction,
    enforced,
    observeOnly: Boolean(observeOnly),
    allowed: effectiveAction === POLICY_ACTION.ALLOW,
    reason,
    rules,
    ...extra,
  };
}

module.exports = {
  evaluateRecordingPolicy,
  mapTenantRecordingPolicy,
  recordRecordingRetry,
  clearRecordingRetries,
  resetRecordingPolicyForTests,
  POLICY_ACTION,
};
