const { getPrisma } = require('../internal/prisma');
const { isWithinBusinessHours, defaultBusinessHours } = require('../../businessHours');
const {
  POLICY_ACTION,
  QUEUE_ACTION,
  DEFAULT_LIMITS,
} = require('./queueConstants');
const { getWaitingCount } = require('./queueState');
const { filterAvailableAgents } = require('./queueStrategy');

function resetQueuePolicyForTests() {
  // reserved
}

/**
 * @param {object|null|undefined} tenant
 */
function evaluateBusinessHoursForTenant(tenant) {
  const timezone = tenant?.timezone || 'America/New_York';
  const greeting = tenant?.greeting;
  if (greeting?.businessHoursEnabled && greeting?.businessHours) {
    const open = isWithinBusinessHours(greeting.businessHours, timezone);
    if (!open) {
      return { allowed: false, reason: 'outside_business_hours' };
    }
  }
  return { allowed: true };
}

/**
 * Evaluate queue policy (Phase 3.8).
 *
 * @param {{
 *   tenantId: string,
 *   sessionId: string,
 *   action: string,
 *   queueEnabled?: boolean,
 *   observeOnly?: boolean,
 *   maxWaitingTimeSec?: number,
 *   maxRetries?: number,
 *   overflowDestination?: string|null,
 *   queue?: Record<string, unknown>|null,
 *   agents?: Array<Record<string, unknown>>,
 *   queueClosed?: boolean,
 * }} input
 */
async function evaluateQueuePolicy(input) {
  const prisma = await getPrisma();
  const rules = [];
  const limits = {
    maxWaitingTimeSec: input.maxWaitingTimeSec ?? DEFAULT_LIMITS.maxWaitingTimeSec,
    maxRetries: input.maxRetries ?? DEFAULT_LIMITS.maxRetries,
    agentTimeoutSec: DEFAULT_LIMITS.agentTimeoutSec,
    maxQueueSize: DEFAULT_LIMITS.maxQueueSize,
  };

  if (!input.queueEnabled) {
    rules.push({ rule: 'queue_enabled', result: 'deny', message: 'Queue disabled for tenant' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'queue_disabled', input.observeOnly, limits);
  }

  if (input.queueClosed) {
    rules.push({ rule: 'queue_closed', result: 'deny', message: 'Queue is closed' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'queue_closed', input.observeOnly, limits);
  }

  if (input.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      include: { greeting: true },
    });
    if (!tenant) {
      rules.push({ rule: 'tenant', result: 'deny', message: 'Tenant not found' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'tenant_not_found', input.observeOnly, limits);
    }

    const hours = evaluateBusinessHoursForTenant(tenant);
    if (!hours.allowed && input.action !== QUEUE_ACTION.LEAVE) {
      rules.push({ rule: 'business_hours', result: 'deny', message: hours.reason });
      return buildDecision(POLICY_ACTION.DENY, rules, 'outside_business_hours', input.observeOnly, limits);
    }
    rules.push({ rule: 'tenant_restrictions', result: 'pass', message: tenant.id });
  }

  if (input.queue && getWaitingCount(input.queue) >= limits.maxQueueSize
    && (input.action === QUEUE_ACTION.JOIN || input.action === QUEUE_ACTION.CREATE)) {
    rules.push({ rule: 'max_queue_size', result: 'deny', message: 'Queue full' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'queue_full', input.observeOnly, limits);
  }

  if (input.action === QUEUE_ACTION.ASSIGN || input.action === QUEUE_ACTION.RETRY) {
    const available = filterAvailableAgents(input.agents || input.queue?.agents);
    if (!available.length) {
      rules.push({ rule: 'agent_availability', result: 'deny', message: 'No available agents' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'no_agents', input.observeOnly, limits);
    }
    rules.push({ rule: 'agent_availability', result: 'pass', message: String(available.length) });
  }

  if (input.action === QUEUE_ACTION.RETRY || input.action === QUEUE_ACTION.TIMEOUT) {
    const retryCount = input.queue?.retryCount ?? 0;
    if (retryCount >= limits.maxRetries) {
      rules.push({ rule: 'max_retries', result: 'deny', message: 'Maximum retries exceeded' });
      if (input.overflowDestination) {
        rules.push({ rule: 'overflow_destination', result: 'pass', message: input.overflowDestination });
        return buildDecision(POLICY_ACTION.ALLOW, rules, 'overflow', input.observeOnly, {
          ...limits,
          retryCount,
          overflow: true,
        });
      }
      return buildDecision(POLICY_ACTION.DENY, rules, 'max_retries', input.observeOnly, { ...limits, retryCount });
    }
  }

  rules.push({ rule: 'max_waiting_time', result: 'pass', message: String(limits.maxWaitingTimeSec) });
  if (input.overflowDestination) {
    rules.push({ rule: 'overflow_destination', result: 'pass', message: input.overflowDestination });
  }
  rules.push({ rule: 'queue_permissions', result: 'pass' });

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
  evaluateQueuePolicy,
  resetQueuePolicyForTests,
  POLICY_ACTION,
};
