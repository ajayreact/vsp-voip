/**
 * Phase 3.4.5 — shared integration test harness (validation only).
 * Does not modify production routing/orchestration behavior.
 */

const eventBus = require('../../../lib/telephony-v3/Events/domainEventBus');
const { metrics } = require('../../../lib/telephony-v3/Utils/metrics');
const deskRouter = require('../../../lib/telephony-v3/Routing/deskRouter');
const mobileRouter = require('../../../lib/telephony-v3/Routing/mobileRouter');
const pstnRouter = require('../../../lib/telephony-v3/Routing/pstnRouter');
const { DOMAIN_EVENTS } = require('../../../lib/telephony-v3/Events/domainEvents');

function resetIntegrationHarness() {
  eventBus.resetForTests();
  metrics.resetMetricsForTests();
  deskRouter.resetDeskRouterForTests();
  mobileRouter.resetMobileRouterForTests();
  pstnRouter.resetPstnRouterForTests();
}

/**
 * @param {string} moduleName
 * @param {string} completedEventType
 */
function baseDomainEvent(moduleName, completedEventType, overrides = {}) {
  return {
    eventId: `evt-${moduleName}-1`,
    eventType: DOMAIN_EVENTS.SESSION_CREATED,
    occurredAt: new Date().toISOString(),
    sessionId: `sess-${moduleName}`,
    tenantId: 'tenant-1',
    correlationId: 'corr-integration',
    callControlId: 'cc-origin',
    payload: { traceId: `trace-${moduleName}`, workerId: 'worker-integration' },
    ...overrides,
  };
}

/**
 * Walk session FSM through the canonical happy path ending at ENDED.
 * @param {typeof import('../../lib/telephony-v3/StateMachine/stateMachine')} stateMachine
 */
function simulateCanonicalSessionLifecycle(stateMachine) {
  const session = {
    id: 'sess-fsm',
    tenantId: 'tenant-1',
    state: 'NEW',
    correlationId: 'corr-fsm',
    version: 0,
    legs: [],
  };
  const leg = {
    id: 'leg-fsm',
    sessionId: 'sess-fsm',
    callControlId: 'cc-fsm',
    role: 'ORIGIN',
    state: 'NEW',
    version: 0,
  };

  const steps = [
    { sessionTrigger: 'origin.parked', legTrigger: 'leg.created', eventId: 'e1' },
    { sessionTrigger: 'route.decided', legTrigger: 'call.ringing', eventId: 'e2' },
    { sessionTrigger: 'route.decided', legTrigger: null, eventId: 'e3' },
    { sessionTrigger: 'call.answered', legTrigger: 'call.answered', eventId: 'e4' },
    { sessionTrigger: 'bridge.completed', legTrigger: 'bridge.completed', eventId: 'e5' },
    { sessionTrigger: 'leg.ended', legTrigger: 'leg.hangup', eventId: 'e6' },
  ];

  const history = [{ session: session.state, leg: leg.state }];
  let currentSession = { ...session };
  let currentLeg = { ...leg };

  for (const step of steps) {
    currentSession = { ...currentSession, legs: [{ ...currentLeg }] };
    const result = stateMachine.applyWithCompletion(
      { session: currentSession, leg: currentLeg },
      {
        sessionTrigger: step.sessionTrigger,
        legTrigger: step.legTrigger,
        eventId: step.eventId,
      },
    );
    if (result.session) currentSession = result.session;
    if (result.leg) currentLeg = result.leg;
    if (result.sessionCompletionTransition) {
      currentSession = { ...currentSession, state: result.sessionCompletionTransition.toState };
    }
    history.push({ session: currentSession.state, leg: currentLeg.state });
  }

  return { finalSession: currentSession, finalLeg: currentLeg, history };
}

/**
 * @param {string} sessionId
 * @param {string} completedEventType
 */
function assertObservability(events, sessionId, completedEventType, traceId) {
  const sessionEvents = events.filter((e) => e.sessionId === sessionId);
  const hasStarted = sessionEvents.some((e) => e.eventType.endsWith('.started'));
  const hasCompleted = sessionEvents.some((e) => e.eventType === completedEventType);
  const hasTrace = sessionEvents.some((e) => e.payload?.traceId === traceId);
  const hasCorrelation = sessionEvents.every((e) => e.correlationId === 'corr-integration' || !e.correlationId);

  return { hasStarted, hasCompleted, hasTrace, hasCorrelation, count: sessionEvents.length };
}

module.exports = {
  resetIntegrationHarness,
  baseDomainEvent,
  simulateCanonicalSessionLifecycle,
  assertObservability,
  DOMAIN_EVENTS,
};
