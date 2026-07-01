const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const eventBus = require('../Events/domainEventBus');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');

/**
 * PolicyEngine — Phase 2 observe mode only.
 * Evaluates rules and emits audit events but never blocks orchestration.
 *
 * @param {import('../types').V3PolicyContext} context
 * @returns {Promise<import('../types').V3PolicyDecision>}
 */
async function evaluate(context) {
  const decision = {
    allowed: true,
    observeOnly: true,
    rules: [],
    reason: 'observe_mode_default_allow',
  };

  if (!context.tenantId) {
    decision.rules.push({ rule: 'tenant.required', result: 'warn', message: 'missing tenantId' });
  }

  if (context.sessionState === 'FAILED') {
    decision.rules.push({ rule: 'session.already_failed', result: 'info' });
  }

  metrics.policyEvaluated({ tenant_id: context.tenantId || 'unknown', allowed: 'true' });

  const eventType = decision.allowed ? DOMAIN_EVENTS.POLICY_EVALUATED : DOMAIN_EVENTS.POLICY_DENIED;
  await eventBus.publish({
    eventId: `policy.evaluated:${context.eventId}`,
    eventType,
    occurredAt: new Date().toISOString(),
    sessionId: context.sessionId,
    tenantId: context.tenantId || null,
    correlationId: context.correlationId || null,
    payload: {
      allowed: decision.allowed,
      observeOnly: true,
      rules: decision.rules,
      telnyxEventType: context.telnyxEventType,
    },
  });

  v3Logger.info('policy.evaluated', {
    sessionId: context.sessionId,
    tenantId: context.tenantId,
    allowed: decision.allowed,
    observeOnly: true,
    eventId: context.eventId,
  });

  return decision;
}

module.exports = { evaluate };

require('../Routing/mobileRouter').register();
require('../Routing/pstnRouter').register();
