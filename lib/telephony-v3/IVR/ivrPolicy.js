const { getPrisma } = require('../internal/prisma');
const { isWithinBusinessHours, defaultBusinessHours } = require('../../businessHours');
const { POLICY_ACTION, IVR_ACTION, DEFAULT_LIMITS } = require('./ivrConstants');

function resetIvrPolicyForTests() {
  // reserved
}

/**
 * @param {object|null|undefined} greeting
 * @param {string} timezone
 */
function evaluateHolidayOverride(greeting, timezone) {
  if (!greeting?.holidaySchedule || !Array.isArray(greeting.holidaySchedule)) {
    return { active: false };
  }
  const today = new Date().toISOString().slice(0, 10);
  const match = greeting.holidaySchedule.find((h) => h?.date === today || h?.day === today);
  if (match) {
    return { active: true, holiday: match, reason: 'holiday_override' };
  }
  return { active: false };
}

/**
 * @param {object|null|undefined} greeting
 * @param {string} timezone
 */
function evaluateBusinessHours(greeting, timezone) {
  if (!greeting?.businessHoursEnabled) {
    return { allowed: true };
  }
  const hours = greeting.businessHours || defaultBusinessHours();
  const open = isWithinBusinessHours(hours, timezone);
  if (!open) {
    return { allowed: false, reason: 'outside_business_hours' };
  }
  return { allowed: true };
}

/**
 * Evaluate IVR policy (Phase 3.9).
 *
 * @param {{
 *   tenantId: string,
 *   sessionId: string,
 *   action: string,
 *   ivrEnabled?: boolean,
 *   observeOnly?: boolean,
 *   maxRetries?: number,
 *   digitTimeoutSec?: number,
 *   operatorEnabled?: boolean,
 *   ivr?: Record<string, unknown>|null,
 *   routeOperator?: boolean,
 * }} input
 */
async function evaluateIvrPolicy(input) {
  const prisma = await getPrisma();
  const rules = [];
  const limits = {
    maxRetries: input.maxRetries ?? DEFAULT_LIMITS.maxRetries,
    digitTimeoutSec: input.digitTimeoutSec ?? DEFAULT_LIMITS.digitTimeoutSec,
    interDigitTimeoutSec: DEFAULT_LIMITS.interDigitTimeoutSec,
    maxDigits: DEFAULT_LIMITS.maxDigits,
  };

  if (!input.ivrEnabled) {
    rules.push({ rule: 'ivr_enabled', result: 'deny', message: 'IVR disabled for tenant' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'ivr_disabled', input.observeOnly, limits);
  }

  let tenant = null;
  if (input.tenantId) {
    tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      include: { greeting: true },
    });
    if (!tenant) {
      rules.push({ rule: 'tenant', result: 'deny', message: 'Tenant not found' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'tenant_not_found', input.observeOnly, limits);
    }
    rules.push({ rule: 'tenant_restrictions', result: 'pass', message: tenant.id });

    const holiday = evaluateHolidayOverride(tenant.greeting, tenant.timezone || 'America/New_York');
    if (holiday.active && input.action === IVR_ACTION.START) {
      rules.push({ rule: 'holiday_override', result: 'pass', message: holiday.reason });
      return buildDecision(POLICY_ACTION.ALLOW, rules, 'holiday_routing', input.observeOnly, {
        ...limits,
        holiday: true,
        holidayRoute: holiday.holiday?.route || null,
      });
    }

    if (input.action === IVR_ACTION.START || input.action === IVR_ACTION.ROUTE) {
      const hours = evaluateBusinessHours(tenant.greeting, tenant.timezone || 'America/New_York');
      if (!hours.allowed) {
        rules.push({ rule: 'business_hours', result: 'deny', message: hours.reason });
        return buildDecision(POLICY_ACTION.DENY, rules, 'outside_business_hours', input.observeOnly, limits);
      }
    }
  }

  const retryCount = input.ivr?.retryCount ?? 0;
  const invalidCount = input.ivr?.invalidCount ?? 0;
  const timeoutCount = input.ivr?.timeoutCount ?? 0;
  const totalFailures = Math.max(retryCount, invalidCount, timeoutCount);

  if ((input.action === IVR_ACTION.RETRY || input.action === IVR_ACTION.TIMEOUT
    || input.action === IVR_ACTION.INPUT) && totalFailures >= limits.maxRetries) {
    rules.push({ rule: 'maximum_retries', result: 'deny', message: 'Maximum IVR retries exceeded' });
    if (input.operatorEnabled !== false && input.routeOperator) {
      return buildDecision(POLICY_ACTION.ALLOW, rules, 'operator_fallback', input.observeOnly, {
        ...limits,
        operatorFallback: true,
      });
    }
    return buildDecision(POLICY_ACTION.DENY, rules, 'max_retries', input.observeOnly, limits);
  }

  if (input.routeOperator && input.operatorEnabled === false) {
    rules.push({ rule: 'operator_enabled', result: 'deny', message: 'Operator routing disabled' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'operator_disabled', input.observeOnly, limits);
  }

  rules.push({ rule: 'digit_timeout', result: 'pass', message: String(limits.digitTimeoutSec) });
  rules.push({ rule: 'ivr_permissions', result: 'pass' });

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
  evaluateIvrPolicy,
  resetIvrPolicyForTests,
  evaluateHolidayOverride,
  evaluateBusinessHours,
  POLICY_ACTION,
};
