const { getPrisma } = require('../internal/prisma');
const { resolveExtensionCallPolicy } = require('../../extensionInbound');
const { evaluateInboundSecurity, serializeSecurity } = require('../../extensionSecurity');
const { isWithinBusinessHours, defaultBusinessHours } = require('../../businessHours');
const { normalizePhoneNumber } = require('../../phone');
const { getCredentialConnectionId } = require('../../telnyxConfig');
const { v3Logger } = require('../Utils/v3Logger');
const { POLICY_ACTION } = require('./deskRouteResult');

/**
 * @param {string} pstnNumber
 * @param {object|null|undefined} security
 */
function evaluateInternationalRestriction(pstnNumber, security) {
  if (!pstnNumber) return { allowed: true };

  const serialized = serializeSecurity(security);
  if (!serialized) return { allowed: true };

  const normalized = normalizePhoneNumber(pstnNumber) || pstnNumber;
  const isInternational = normalized.startsWith('+') && !normalized.startsWith('+1');
  if (isInternational && !serialized.callingPermissions.international) {
    return { allowed: false, reason: 'International calling disabled' };
  }
  return { allowed: true };
}

/**
 * @param {object|null|undefined} security
 * @param {string} timezone
 */
function evaluateBusinessHours(security, timezone) {
  const serialized = serializeSecurity(security);
  if (!serialized?.timeRestrictions?.enabled) {
    return { allowed: true };
  }
  const open = isWithinBusinessHours(
    serialized.timeRestrictions.businessHours || defaultBusinessHours(),
    timezone,
  );
  if (!open && serialized.timeRestrictions.afterHoursAction === 'BLOCK') {
    return { allowed: false, reason: 'Outside business hours' };
  }
  return { allowed: true };
}

/**
 * @param {object|null|undefined} security
 */
function resolveCallerIdPolicy(security) {
  const serialized = serializeSecurity(security);
  if (!serialized) return null;
  return {
    outboundNumber: serialized.callerId.outboundNumber,
    hideCallerId: serialized.callerId.hideCallerId,
    displayName: serialized.callerId.displayName,
  };
}

/**
 * Evaluate desk routing policy (Phase 3.2 — enforcement when observeOnly=false).
 *
 * @param {{
 *   tenant: object,
 *   callerExtension: object|null,
 *   targetExtension: object|null,
 *   destination: object|null,
 *   routingFlow: string,
 *   from: string|null,
 *   observeOnly?: boolean,
 * }} input
 */
async function evaluateDeskPolicy(input) {
  console.log('[V3] deskPolicy routing decision', {
    routingFlow: input.routingFlow ?? null,
    tenantId: input.tenant?.id ?? null,
    from: input.from ?? null,
    destinationKind: input.destination?.kind ?? null,
    targetExtension: input.targetExtension?.extensionNumber ?? null,
    observeOnly: input.observeOnly ?? false,
  });
  v3Logger.info('desk.policy.routing_decision', {
    routingFlow: input.routingFlow ?? null,
    tenantId: input.tenant?.id ?? null,
    from: input.from ?? null,
    destinationKind: input.destination?.kind ?? null,
    targetExtension: input.targetExtension?.extensionNumber ?? null,
    observeOnly: input.observeOnly ?? false,
  });

  const prisma = await getPrisma();
  const rules = [];
  const timezone = input.tenant?.timezone || 'America/New_York';
  const callerSecurity = input.callerExtension?.security ?? null;
  const from = input.from || '';

  if (input.routingFlow === 'DESK_TO_PSTN') {
    const hours = evaluateBusinessHours(callerSecurity, timezone);
    rules.push({ rule: 'business_hours', result: hours.allowed ? 'pass' : 'deny', message: hours.reason });
    if (!hours.allowed) {
      return buildDecision(POLICY_ACTION.DENY, rules, hours.reason, input.observeOnly);
    }

    const intl = evaluateInternationalRestriction(input.destination?.pstnNumber, callerSecurity);
    rules.push({ rule: 'international_restriction', result: intl.allowed ? 'pass' : 'deny', message: intl.reason });
    if (!intl.allowed) {
      return buildDecision(POLICY_ACTION.DENY, rules, intl.reason, input.observeOnly);
    }
  }

  if (input.targetExtension) {
    const credentialConnectionId = getCredentialConnectionId(null);
    const extensionPolicy = await resolveExtensionCallPolicy(
      prisma,
      input.tenant,
      input.targetExtension,
      from,
      { credentialConnectionId, trigger: 'internal' },
    );

    if (!extensionPolicy) {
      rules.push({ rule: 'target.policy', result: 'deny', message: 'Target policy unavailable' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'Target policy unavailable', input.observeOnly);
    }

    if (extensionPolicy.action === 'block') {
      rules.push({ rule: 'blocked_user', result: 'deny', message: extensionPolicy.reason });
      return buildDecision(POLICY_ACTION.DENY, rules, extensionPolicy.reason, input.observeOnly);
    }

    if (extensionPolicy.action === 'voicemail') {
      rules.push({ rule: 'dnd', result: 'voicemail', message: extensionPolicy.reason });
      return buildDecision(POLICY_ACTION.VOICEMAIL, rules, extensionPolicy.reason, input.observeOnly, {
        stub: true,
      });
    }

    if (extensionPolicy.action === 'forward') {
      rules.push({ rule: 'call_forward', result: 'forward', message: extensionPolicy.reason });
      return buildDecision(POLICY_ACTION.FORWARD, rules, extensionPolicy.reason, input.observeOnly, {
        targets: extensionPolicy.targets || [],
        ringTimeout: extensionPolicy.ringTimeout || 25,
        strategy: extensionPolicy.strategy || 'simultaneous',
      });
    }

    if (input.targetExtension.security) {
      const tenantExtensions = await prisma.extension.findMany({
        where: { tenantId: input.tenant.id, status: 'ACTIVE' },
        select: { extensionNumber: true },
      });
      const securityCheck = evaluateInboundSecurity(input.targetExtension.security, from, {
        tenantExtensions,
        timezone,
      });
      rules.push({
        rule: 'inbound_security',
        result: securityCheck.allowed ? 'pass' : 'deny',
        message: securityCheck.reason,
      });
      if (!securityCheck.allowed) {
        return buildDecision(POLICY_ACTION.DENY, rules, securityCheck.reason, input.observeOnly);
      }
    }

    rules.push({ rule: 'dnd', result: 'pass' });
    rules.push({ rule: 'call_forward', result: 'pass' });
  }

  const callerId = resolveCallerIdPolicy(callerSecurity);
  rules.push({ rule: 'caller_id', result: 'pass', message: callerId?.outboundNumber || 'default' });

  return buildDecision(POLICY_ACTION.ALLOW, rules, 'allowed', input.observeOnly, { callerId });
}

/**
 * @param {string} action
 * @param {Array<{ rule: string, result: string, message?: string }>} rules
 * @param {string} reason
 * @param {boolean|undefined} observeOnly
 * @param {Record<string, unknown>} [extra]
 */
function buildDecision(action, rules, reason, observeOnly, extra = {}) {
  const enforced = !observeOnly;
  const effectiveAction = observeOnly && action === POLICY_ACTION.DENY
    ? POLICY_ACTION.ALLOW
    : action;

  const decision = {
    action,
    effectiveAction,
    enforced,
    observeOnly: Boolean(observeOnly),
    allowed: effectiveAction === POLICY_ACTION.ALLOW || effectiveAction === POLICY_ACTION.FORWARD,
    reason,
    rules,
    ...extra,
  };

  const skipReason = decision.effectiveAction !== POLICY_ACTION.ALLOW
    && decision.effectiveAction !== POLICY_ACTION.FORWARD
    ? decision.reason
    : null;
  console.log('[V3] deskPolicy policy result', {
    action: decision.action,
    effectiveAction: decision.effectiveAction,
    allowed: decision.allowed,
    reason: decision.reason,
    skipReason,
    observeOnly: decision.observeOnly,
    enforced: decision.enforced,
    ruleCount: rules.length,
    rules: rules.map((r) => ({ rule: r.rule, result: r.result, message: r.message })),
  });
  v3Logger.info('desk.policy.result', {
    action: decision.action,
    effectiveAction: decision.effectiveAction,
    allowed: decision.allowed,
    reason: decision.reason,
    skipReason,
    observeOnly: decision.observeOnly,
    enforced: decision.enforced,
    rules: decision.rules,
  });

  return decision;
}

module.exports = {
  evaluateDeskPolicy,
  evaluateInternationalRestriction,
  evaluateBusinessHours,
  resolveCallerIdPolicy,
  POLICY_ACTION,
};
