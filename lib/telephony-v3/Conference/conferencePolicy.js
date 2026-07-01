const { getPrisma } = require('../internal/prisma');
const {
  POLICY_ACTION,
  CONFERENCE_RECORDING_POLICY,
  DEFAULT_LIMITS,
  CONFERENCE_ACTION,
} = require('./conferenceConstants');
const conferenceState = require('./conferenceState');

function resetConferencePolicyForTests() {
  // no-op for now; reserved for future policy caches
}

/**
 * Evaluate conference policy (Phase 3.7).
 *
 * @param {{
 *   tenantId: string,
 *   sessionId: string,
 *   action: string,
 *   conferenceEnabled?: boolean,
 *   observeOnly?: boolean,
 *   maxParticipants?: number,
 *   hostRequired?: boolean,
 *   conferenceRecordingPolicy?: string,
 *   conferenceTimeoutSec?: number,
 *   conference?: Record<string, unknown>|null,
 *   participantCallControlId?: string|null,
 *   isHost?: boolean,
 * }} input
 */
async function evaluateConferencePolicy(input) {
  const prisma = await getPrisma();
  const rules = [];
  const limits = {
    maxParticipants: input.maxParticipants ?? DEFAULT_LIMITS.maxParticipants,
    hostRequired: input.hostRequired ?? DEFAULT_LIMITS.hostRequired,
    conferenceTimeoutSec: input.conferenceTimeoutSec ?? DEFAULT_LIMITS.conferenceTimeoutSec,
    conferenceRecordingPolicy: input.conferenceRecordingPolicy
      ?? DEFAULT_LIMITS.conferenceRecordingPolicy,
  };

  if (!input.conferenceEnabled) {
    rules.push({ rule: 'conference_enabled', result: 'deny', message: 'Conference disabled for tenant' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'conference_disabled', input.observeOnly, limits);
  }

  if (input.tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) {
      rules.push({ rule: 'tenant', result: 'deny', message: 'Tenant not found' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'tenant_not_found', input.observeOnly, limits);
    }
    rules.push({ rule: 'tenant_restrictions', result: 'pass', message: tenant.id });
  }

  const conference = input.conference;
  const participantCount = conferenceState.getParticipantCount(conference);

  if (input.action === CONFERENCE_ACTION.JOIN || input.action === CONFERENCE_ACTION.CREATE) {
    if (participantCount >= limits.maxParticipants) {
      rules.push({ rule: 'max_participants', result: 'deny', message: 'Maximum participants exceeded' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'max_participants', input.observeOnly, limits);
    }
  }

  if (limits.hostRequired && input.action === CONFERENCE_ACTION.CREATE && !input.isHost) {
    rules.push({ rule: 'host_required', result: 'pass', message: 'host_will_join_on_create' });
  }

  if (input.action === CONFERENCE_ACTION.START_RECORDING) {
    if (limits.conferenceRecordingPolicy === CONFERENCE_RECORDING_POLICY.DISABLED) {
      rules.push({ rule: 'conference_recording_policy', result: 'deny', message: 'Recording disabled' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'recording_disabled', input.observeOnly, limits);
    }
    if (limits.conferenceRecordingPolicy === CONFERENCE_RECORDING_POLICY.ALWAYS) {
      rules.push({ rule: 'conference_recording_policy', result: 'pass', message: 'ALWAYS' });
    } else {
      rules.push({ rule: 'conference_recording_policy', result: 'pass', message: 'ON_DEMAND' });
    }
  }

  if (input.action === CONFERENCE_ACTION.LEAVE && limits.hostRequired && input.isHost) {
    rules.push({ rule: 'host_leave', result: 'pass', message: 'host_leave_allowed' });
  }

  rules.push({ rule: 'conference_timeout', result: 'pass', message: String(limits.conferenceTimeoutSec) });
  rules.push({ rule: 'conference_permissions', result: 'pass' });

  return buildDecision(POLICY_ACTION.ALLOW, rules, 'allowed', input.observeOnly, limits);
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
  evaluateConferencePolicy,
  resetConferencePolicyForTests,
  POLICY_ACTION,
};
