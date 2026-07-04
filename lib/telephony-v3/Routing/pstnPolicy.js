const { getPrisma } = require('../internal/prisma');
const { resolveExtensionCallPolicy } = require('../../extensionInbound');
const { evaluateInboundSecurity, serializeSecurity } = require('../../extensionSecurity');
const { getCredentialConnectionId } = require('../../telnyxConfig');
const { evaluateBusinessHours } = require('./deskPolicy');
const { POLICY_ACTION } = require('./pstnRouteResult');

/**
 * @param {string|null|undefined} from
 */
function isAnonymousCaller(from) {
  const raw = String(from || '').trim().toLowerCase();
  if (!raw) return true;
  return raw.includes('anonymous') || raw === 'restricted' || raw === 'unknown';
}

/**
 * Evaluate spam block (stub — logs rule, enforcement via evaluateInboundSecurity patterns).
 *
 * @param {string|null|undefined} from
 * @param {object|null|undefined} security
 */
function evaluateSpamBlockStub(from, security) {
  const serialized = serializeSecurity(security);
  if (!serialized?.spamPatternBlockEnabled) {
    return { allowed: true, stub: false };
  }
  return { allowed: true, stub: true, reason: 'spam_block_observe_stub' };
}

/**
 * Evaluate PSTN routing policy (Phase 3.4 — enforcement when observeOnly=false).
 *
 * @param {{
 *   tenant: object,
 *   targetExtension: object|null,
 *   phoneRecord: object|null,
 *   destination: object|null,
 *   routingFlow: string,
 *   from: string|null,
 *   observeOnly?: boolean,
 * }} input
 */
async function evaluatePstnPolicy(input) {
  const prisma = await getPrisma();
  const rules = [];
  const timezone = input.tenant?.timezone || 'America/New_York';
  const from = input.from || input.destination?.callerPstn || '';
  const targetSecurity = input.targetExtension?.security ?? null;

  if (input.routingFlow === 'UNKNOWN') {
    rules.push({ rule: 'unknown_did', result: 'info', message: 'Unknown DID' });
    return buildDecision(POLICY_ACTION.ALLOW, rules, 'unknown_did', input.observeOnly);
  }

  if (targetSecurity) {
    const hours = evaluateBusinessHours(targetSecurity, timezone);
    rules.push({ rule: 'business_hours', result: hours.allowed ? 'pass' : 'deny', message: hours.reason });
    if (!hours.allowed) {
      return buildDecision(POLICY_ACTION.DENY, rules, hours.reason, input.observeOnly);
    }
  }

  if (isAnonymousCaller(from)) {
    rules.push({ rule: 'anonymous_caller', result: 'info', message: 'anonymous_detected' });
    if (targetSecurity?.blockAnonymous) {
      rules.push({ rule: 'anonymous_caller', result: 'deny', message: 'Anonymous callers blocked' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'Anonymous callers blocked', input.observeOnly);
    }
  }

  const spam = evaluateSpamBlockStub(from, targetSecurity);
  rules.push({
    rule: 'spam_block',
    result: spam.stub ? 'stub' : 'pass',
    message: spam.reason || 'pass',
  });

  if (input.targetExtension) {
    const credentialConnectionId = getCredentialConnectionId(null);
    const extensionPolicy = await resolveExtensionCallPolicy(
      prisma,
      input.tenant,
      input.targetExtension,
      from,
      {
        credentialConnectionId,
        trigger: 'inbound',
        phoneRecord: input.phoneRecord,
      },
    );

    if (!extensionPolicy) {
      rules.push({ rule: 'target.policy', result: 'deny', message: 'Target policy unavailable' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'Target policy unavailable', input.observeOnly);
    }

    if (extensionPolicy.action === 'block') {
      rules.push({ rule: 'blocked_number', result: 'deny', message: extensionPolicy.reason });
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
        strategy: extensionPolicy.strategy || 'sequential',
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

  rules.push({ rule: 'caller_id_restrictions', result: 'pass' });
  rules.push({ rule: 'international_restriction', result: 'pass', message: 'inbound_n/a' });

  return buildDecision(POLICY_ACTION.ALLOW, rules, 'allowed', input.observeOnly);
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

  return {
    action,
    effectiveAction,
    enforced,
    observeOnly: Boolean(observeOnly),
    allowed: effectiveAction === POLICY_ACTION.ALLOW || effectiveAction === POLICY_ACTION.FORWARD,
    reason,
    rules,
    ...extra,
  };
}

module.exports = {
  evaluatePstnPolicy,
  evaluateSpamBlockStub,
  isAnonymousCaller,
  POLICY_ACTION,
};
