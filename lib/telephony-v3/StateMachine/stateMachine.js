const { resolveSessionTransition, isTerminalSessionState } = require('./sessionTransitions');
const { resolveLegTransition, isTerminalLegState } = require('./legTransitions');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');

/**
 * @typedef {Object} FsmApplyResult
 * @property {import('../types').V3SessionRecord|null} session
 * @property {import('../types').V3LegRecord|null} leg
 * @property {{ fromState: string, toState: string, triggerEvent: string }|null} sessionTransition
 * @property {{ fromState: string, toState: string, triggerEvent: string }|null} legTransition
 * @property {import('../types').V3CommandIntent[]} commandIntents
 * @property {boolean} invalidSessionTransition
 * @property {boolean} invalidLegTransition
 */

/**
 * Derive command intents from state transitions (no Telnyx execution).
 * @param {{ sessionTransition?: { fromState: string, toState: string }, legTransition?: { fromState: string, toState: string } }} transitions
 * @returns {import('../types').V3CommandIntent[]}
 */
function deriveCommandIntents(transitions) {
  const intents = [];
  const { sessionTransition, legTransition } = transitions;

  if (sessionTransition?.toState === 'BRIDGING' || legTransition?.toState === 'ANSWERED') {
    intents.push({
      commandType: 'BRIDGE',
      reason: 'fsm_bridge_pending',
      payload: { phase: 2, stub: true },
    });
  }

  if (
    sessionTransition?.toState === 'ENDING'
    || sessionTransition?.toState === 'FAILED'
    || legTransition?.toState === 'ENDED'
    || legTransition?.toState === 'FAILED'
  ) {
    intents.push({
      commandType: 'HANGUP',
      reason: 'fsm_teardown',
      payload: { phase: 2, stub: true },
    });
  }

  return intents;
}

/**
 * Apply session + leg FSM transitions for a trigger pair.
 * @param {{ session: import('../types').V3SessionRecord, leg: import('../types').V3LegRecord|null }} ctx
 * @param {{ sessionTrigger: string|null, legTrigger: string|null, eventId: string }} triggers
 * @returns {FsmApplyResult}
 */
function apply(ctx, triggers) {
  const result = {
    session: ctx.session,
    leg: ctx.leg,
    sessionTransition: null,
    legTransition: null,
    commandIntents: [],
    invalidSessionTransition: false,
    invalidLegTransition: false,
  };

  if (triggers.sessionTrigger && ctx.session && !isTerminalSessionState(ctx.session.state)) {
    const toState = resolveSessionTransition(ctx.session.state, triggers.sessionTrigger);
    if (toState) {
      result.sessionTransition = {
        fromState: ctx.session.state,
        toState,
        triggerEvent: triggers.sessionTrigger,
      };
      result.session = { ...ctx.session, state: toState };
    } else {
      result.invalidSessionTransition = true;
      metrics.fsmInvalid({ fsm: 'session', from_state: ctx.session.state, trigger: triggers.sessionTrigger });
      v3Logger.warn('fsm.session.invalid_transition', {
        sessionId: ctx.session.id,
        fromState: ctx.session.state,
        trigger: triggers.sessionTrigger,
        eventId: triggers.eventId,
      });
    }
  }

  if (triggers.legTrigger && ctx.leg && !isTerminalLegState(ctx.leg.state)) {
    const toState = resolveLegTransition(ctx.leg.state, triggers.legTrigger);
    if (toState) {
      result.legTransition = {
        fromState: ctx.leg.state,
        toState,
        triggerEvent: triggers.legTrigger,
      };
      result.leg = { ...ctx.leg, state: toState };
    } else {
      result.invalidLegTransition = true;
      metrics.fsmInvalid({ fsm: 'leg', from_state: ctx.leg.state, trigger: triggers.legTrigger });
      v3Logger.warn('fsm.leg.invalid_transition', {
        legId: ctx.leg.id,
        fromState: ctx.leg.state,
        trigger: triggers.legTrigger,
        eventId: triggers.eventId,
      });
    }
  }

  result.commandIntents = deriveCommandIntents({
    sessionTransition: result.sessionTransition,
    legTransition: result.legTransition,
  });

  return result;
}

const TERMINAL_LEG = new Set(['ENDED', 'FAILED']);

/**
 * @param {import('../types').V3SessionRecord} session
 * @param {import('../types').V3LegRecord} leg
 * @param {{ toState: string }|null} legTransition
 * @returns {import('../types').V3LegRecord[]}
 */
function buildLegsAfterTransition(session, leg, legTransition) {
  const baseLegs = session.legs?.length ? session.legs : [leg];
  return baseLegs.map((item) => {
    if (item.id !== leg.id) return item;
    if (!legTransition) return item;
    return { ...item, state: legTransition.toState };
  });
}

/**
 * @param {import('../types').V3SessionRecord} session
 * @param {import('../types').V3LegRecord[]} legs
 * @param {string} eventId
 */
function resolveSessionCompletion(session, legs, eventId) {
  if (!session || isTerminalSessionState(session.state)) return null;
  if (!legs.length || !legs.every((item) => TERMINAL_LEG.has(item.state))) return null;

  const toState = resolveSessionTransition(session.state, 'session.closed');
  if (!toState) return null;

  return {
    fromState: session.state,
    toState,
    triggerEvent: 'session.closed',
    eventId: `${eventId}:session.closed`,
  };
}

/**
 * @param {{ session: import('../types').V3SessionRecord, leg: import('../types').V3LegRecord|null }} ctx
 * @param {{ sessionTrigger: string|null, legTrigger: string|null, eventId: string }} triggers
 */
function applyWithCompletion(ctx, triggers) {
  const result = apply(ctx, triggers);
  let sessionForCompletion = result.session;
  let sessionCompletionTransition = null;

  if (
    result.legTransition
    && TERMINAL_LEG.has(result.legTransition.toState)
    && ctx.session
    && ctx.leg
  ) {
    const legsAfter = buildLegsAfterTransition(ctx.session, ctx.leg, result.legTransition);
    sessionCompletionTransition = resolveSessionCompletion(sessionForCompletion, legsAfter, triggers.eventId);
    if (sessionCompletionTransition) {
      sessionForCompletion = { ...sessionForCompletion, state: sessionCompletionTransition.toState };
    }
  }

  return {
    ...result,
    session: sessionForCompletion,
    sessionCompletionTransition,
  };
}

module.exports = {
  apply,
  applyWithCompletion,
  deriveCommandIntents,
  buildLegsAfterTransition,
  resolveSessionCompletion,
};
