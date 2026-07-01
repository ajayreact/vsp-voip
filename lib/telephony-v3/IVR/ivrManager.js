const crypto = require('crypto');
const sessionManager = require('../Sessions/sessionManager');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const { evaluateIvrPolicy, POLICY_ACTION } = require('./ivrPolicy');
const { buildIvrCommands } = require('./ivrCommandBuilder');
const { processInput } = require('./ivrInputProcessor');
const {
  resolveMenuTree,
  resolveMenuNode,
  resolveDestinationTarget,
} = require('./ivrMenuResolver');
const {
  IVR_ACTION,
  IVR_STATUS,
  DESTINATION_TYPE,
} = require('./ivrConstants');
const {
  getIvrFromSnapshot,
  buildInitialIvrState,
  pushMenuStack,
  registerActiveIvr,
  unregisterActiveIvr,
  isIvrActive,
} = require('./ivrState');

/** @type {Set<string>} */
const handledRequests = new Set();

function resetIvrManagerForTests() {
  handledRequests.clear();
  require('./ivrState').resetIvrStateForTests();
}

async function persistIvrSnapshot(sessionId, patch, version, extraSnapshot = {}) {
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const snapshot = {
    ...(row?.routeSnapshot && typeof row.routeSnapshot === 'object' ? row.routeSnapshot : {}),
    ...extraSnapshot,
    ivr: {
      ...(getIvrFromSnapshot(row?.routeSnapshot) || {}),
      ...patch,
    },
  };
  await prisma.v3CallSession.updateMany({
    where: { id: sessionId, version },
    data: { routeSnapshot: snapshot, version: { increment: 1 }, updatedAt: new Date() },
  });
  return snapshot.ivr;
}

async function publishIvrEvent(base, eventType, payload) {
  await eventBus.publish({
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    sessionId: base.sessionId,
    tenantId: base.tenantId ?? null,
    correlationId: base.correlationId ?? null,
    callControlId: base.callControlId ?? null,
    payload,
  });
}

async function loadIvrContext(sessionId, tenantId) {
  const session = await sessionManager.loadSession(sessionId, tenantId);
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const ivr = getIvrFromSnapshot(row?.routeSnapshot);
  const menuTree = row?.routeSnapshot?.ivrMenuTree || null;
  return { session, ivr, menuTree, routeSnapshot: row?.routeSnapshot };
}

async function enqueueCommands(commands, session, leg, callControlId, observeOnly) {
  if (observeOnly || !commands.length || !leg) return;
  const commandBus = require('../Commands/commandBus');
  await commandBus.enqueueIntents(commands, {
    sessionId: session.id,
    legId: leg.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    targetCallControlId: callControlId,
    sequenceStart: 0,
  });
}

async function loadTenantGreeting(tenantId) {
  const prisma = await getPrisma();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { greeting: true },
  });
  return tenant?.greeting ?? null;
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   callControlId?: string,
 *   legId?: string,
 *   menuTree?: Record<string, unknown>|null,
 *   rootMenuId?: string,
 *   connectionId?: string|null,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function startIvr(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:ivr:start:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.ivrEnabled) {
    return { skipped: true, reason: 'ivr_disabled' };
  }

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = session.legs?.find((l) => l.id === input.legId)
    || session.legs?.find((l) => l.callControlId === input.callControlId)
    || session.legs?.[0];

  if (!leg) {
    metrics.ivrTotal({ result: 'failed', action: 'start' });
    return { ok: false, error: 'leg_not_found' };
  }

  const callControlId = input.callControlId || leg.callControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  try {
    const greeting = await loadTenantGreeting(input.tenantId);
    const menuTree = resolveMenuTree(greeting, input.menuTree);
    const rootMenuId = input.rootMenuId || 'root';
    const menuNode = resolveMenuNode(menuTree, rootMenuId);

    if (!menuNode) {
      return { ok: false, error: 'menu_not_found' };
    }

    const policy = await evaluateIvrPolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: IVR_ACTION.START,
      ivrEnabled: flags.ivrEnabled,
      observeOnly: flags.observeOnly,
      operatorEnabled: true,
      routeOperator: false,
    });

    if (policy.holiday && policy.holidayRoute) {
      return routeToDestination({
        ...input,
        destination: policy.holidayRoute,
        requestId: `${input.requestId || 'start'}-holiday`,
      });
    }

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_FAILED, { policy, traceId: input.traceId });
      metrics.ivrTotal({ result: 'failed', action: 'start' });
      return { ok: false, policy };
    }

    const ivrState = buildInitialIvrState({
      callControlId,
      legId: leg.id,
      rootMenuId,
    });
    ivrState.menuTreeId = rootMenuId;
    ivrState.status = IVR_STATUS.GATHERING;

    await persistIvrSnapshot(session.id, ivrState, session.version, {
      ivrMenuTree: menuTree,
    });

    registerActiveIvr(session.id);

    const timerService = require('../Timer/timerService');
    await timerService.scheduleTimer(
      session.id,
      'ivr-digit-timeout',
      menuNode?.timeoutSec ?? 5,
    ).catch(() => {});

    const commands = buildIvrCommands({
      action: IVR_ACTION.START,
      policy,
      callControlId,
      menuNode,
      connectionId: input.connectionId,
    });

    await enqueueCommands(commands, session, leg, callControlId, flags.observeOnly);

    metrics.ivrTotal({ result: 'started', action: 'start' });
    metrics.observeIvrDuration(Date.now() - startedMs, { action: 'start' });

    await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_STARTED, {
      traceId: input.traceId || requestKey,
      menuId: rootMenuId,
    });
    await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_GREETING, {
      traceId: input.traceId,
      menuId: rootMenuId,
      commandsEnqueued: !flags.observeOnly,
    });

    v3Logger.info('ivr.started', { sessionId: session.id, menuId: rootMenuId });

    return { ok: true, ivrSessionId: ivrState.ivrSessionId, policy };
  } catch (error) {
    metrics.ivrTotal({ result: 'failed', action: 'start' });
    await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_FAILED, { error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   digits?: string|null,
 *   requestId?: string,
 *   traceId?: string,
 *   connectionId?: string|null,
 * }} input
 */
async function handleInput(input) {
  const requestKey = `${input.sessionId}:ivr:input:${input.requestId || input.digits || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.ivrEnabled) {
    return { skipped: true, reason: 'ivr_disabled' };
  }

  const { session, ivr, menuTree: storedTree } = await loadIvrContext(input.sessionId, input.tenantId);
  if (!ivr) {
    return { ok: false, error: 'ivr_not_active' };
  }

  const greeting = await loadTenantGreeting(input.tenantId);
  const menuTree = storedTree || resolveMenuTree(greeting, null);
  const menuNode = resolveMenuNode(menuTree, ivr.currentMenuId || 'root');
  const callControlId = ivr.callControlId || session.primaryCallControlId;
  const leg = session.legs?.find((l) => l.callControlId === callControlId) || session.legs?.[0];

  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  const processed = processInput({ rawInput: input.digits, menuNode, ivr });
  metrics.ivrInputTotal({ input_type: processed.classified.inputType });

  await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_INPUT_RECEIVED, {
    traceId: input.traceId,
    digits: input.digits,
    inputType: processed.classified.inputType,
  });

  if (processed.action === 'INVALID') {
    metrics.ivrInvalidTotal({ reason: 'invalid_digit' });
    await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_INVALID_INPUT, { digits: input.digits });
    return handleRetry({ ...input, reason: 'invalid' }, ivr, menuNode, session, leg, flags);
  }

  if (processed.action === 'TIMEOUT') {
    return handleTimeout(input);
  }

  if (processed.action === 'REPEAT') {
    return repeatMenu(input);
  }

  if (processed.action === 'SUBMENU') {
    const updated = pushMenuStack(ivr, processed.menuId);
    await persistIvrSnapshot(session.id, updated, session.version);
    return startIvr({
      ...input,
      rootMenuId: processed.menuId,
      menuTree,
      requestId: `${input.requestId || 'sub'}-menu`,
    });
  }

  return routeToDestination({
    ...input,
    destination: processed.destination,
  });
}

/**
 * @param {object} input
 * @param {Record<string, unknown>} ivr
 * @param {Record<string, unknown>} menuNode
 * @param {object} session
 * @param {object} leg
 * @param {object} flags
 */
async function handleRetry(input, ivr, menuNode, session, leg, flags) {
  const invalidCount = (ivr.invalidCount ?? 0) + (input.reason === 'invalid' ? 1 : 0);
  const timeoutCount = (ivr.timeoutCount ?? 0) + (input.reason === 'timeout' ? 1 : 0);
  const retryCount = Math.max(invalidCount, timeoutCount);

  const policy = await evaluateIvrPolicy({
    tenantId: input.tenantId,
    sessionId: session.id,
    action: IVR_ACTION.RETRY,
    ivrEnabled: flags.ivrEnabled,
    observeOnly: flags.observeOnly,
    ivr: { ...ivr, retryCount, invalidCount, timeoutCount },
    operatorEnabled: true,
    routeOperator: true,
  });

  const callControlId = ivr.callControlId || session.primaryCallControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  if (policy.operatorFallback) {
    await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_RETRY, { retryCount, operatorFallback: true });
    return routeToDestination({
      ...input,
      destination: { destination: DESTINATION_TYPE.OPERATOR, extensionId: menuNode?.operatorExtensionId },
      requestId: `${input.requestId || 'retry'}-operator`,
    });
  }

  if (policy.effectiveAction === POLICY_ACTION.DENY) {
    return exitIvr({ ...input, requestId: `${input.requestId || 'retry'}-exit` });
  }

  await persistIvrSnapshot(session.id, { ...ivr, retryCount, invalidCount, timeoutCount }, session.version);
  metrics.ivrTotal({ result: 'retry', action: 'retry' });
  await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_RETRY, { retryCount, reason: input.reason });

  const commands = buildIvrCommands({
    action: input.reason === 'timeout' ? IVR_ACTION.TIMEOUT : IVR_ACTION.INPUT,
    policy,
    callControlId,
    menuNode,
  });

  await enqueueCommands(commands, session, leg, callControlId, flags.observeOnly);
  return { ok: true, retryCount };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 *   connectionId?: string|null,
 * }} input
 */
async function handleTimeout(input) {
  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const { session, ivr, menuTree: storedTree } = await loadIvrContext(input.sessionId, input.tenantId);
  if (!ivr) {
    return { ok: false, error: 'ivr_not_active' };
  }

  metrics.ivrTimeoutTotal({ reason: 'digit_timeout' });
  const greeting = await loadTenantGreeting(input.tenantId);
  const menuTree = storedTree || resolveMenuTree(greeting, null);
  const menuNode = resolveMenuNode(menuTree, ivr.currentMenuId || 'root');
  const leg = session.legs?.[0];

  await publishIvrEvent({
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: ivr.callControlId,
  }, DOMAIN_EVENTS.IVR_TIMEOUT, { traceId: input.traceId });

  return handleRetry({ ...input, reason: 'timeout', digits: null }, ivr, menuNode, session, leg, flags);
}

/**
 * @param {object} input
 */
async function repeatMenu(input) {
  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const { session, ivr, menuTree: storedTree } = await loadIvrContext(input.sessionId, input.tenantId);
  const greeting = await loadTenantGreeting(input.tenantId);
  const menuTree = storedTree || resolveMenuTree(greeting, null);
  const menuNode = resolveMenuNode(menuTree, ivr?.currentMenuId || 'root');
  const callControlId = ivr?.callControlId || session.primaryCallControlId;
  const leg = session.legs?.find((l) => l.callControlId === callControlId) || session.legs?.[0];

  const commands = buildIvrCommands({
    action: IVR_ACTION.REPEAT,
    policy: { effectiveAction: POLICY_ACTION.ALLOW },
    callControlId,
    menuNode,
    connectionId: input.connectionId,
  });

  await enqueueCommands(commands, session, leg, callControlId, flags.observeOnly);
  return { ok: true, repeated: true };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   destination: Record<string, unknown>,
 *   requestId?: string,
 *   traceId?: string,
 *   connectionId?: string|null,
 * }} input
 */
async function routeToDestination(input) {
  const requestKey = `${input.sessionId}:ivr:route:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const { session, ivr } = await loadIvrContext(input.sessionId, input.tenantId);
  const callControlId = ivr?.callControlId || session.primaryCallControlId;
  const leg = session.legs?.find((l) => l.callControlId === callControlId) || session.legs?.[0];

  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  const destType = String(input.destination?.destination || input.destination?.type || '').toUpperCase();

  if (destType === DESTINATION_TYPE.REPEAT) {
    return repeatMenu(input);
  }

  if (destType === DESTINATION_TYPE.SUBMENU) {
    return handleInput({
      ...input,
      digits: input.destination.menuId,
      requestId: `${input.requestId || 'route'}-sub`,
    });
  }

  const policy = await evaluateIvrPolicy({
    tenantId: input.tenantId,
    sessionId: session.id,
    action: IVR_ACTION.ROUTE,
    ivrEnabled: flags.ivrEnabled,
    observeOnly: flags.observeOnly,
    ivr,
  });

  const resolvedTarget = await resolveDestinationTarget(input.destination, input.tenantId);

  const commands = buildIvrCommands({
    action: IVR_ACTION.ROUTE,
    policy,
    callControlId,
    destination: input.destination,
    resolvedTarget,
    connectionId: input.connectionId,
  });

  if (policy.effectiveAction === POLICY_ACTION.DENY) {
    await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_FAILED, { policy });
    return { ok: false, policy };
  }

  await sidecarRoute(input, destType, resolvedTarget, session, callControlId, flags);

  await persistIvrSnapshot(session.id, {
    ...(ivr || {}),
    status: IVR_STATUS.ROUTING,
    routeSelected: { type: destType, ...resolvedTarget },
    routedAt: new Date().toISOString(),
  }, session.version);

  await enqueueCommands(commands, session, leg, callControlId, flags.observeOnly);

  metrics.ivrRouteTotal({ destination_type: destType });
  await publishIvrEvent(eventBase, DOMAIN_EVENTS.IVR_ROUTE_SELECTED, {
    traceId: input.traceId,
    destinationType: destType,
    resolvedTarget,
    commandsEnqueued: !flags.observeOnly,
  });

  return completeIvr({ ...input, reason: 'routed', destinationType: destType });
}

/**
 * Invoke other sidecar managers without modifying them.
 */
async function sidecarRoute(input, destType, resolvedTarget, session, callControlId, flags) {
  if (flags.observeOnly) return;

  try {
    if (destType === DESTINATION_TYPE.QUEUE) {
      const queueManager = require('../Queue/queueManager');
      await queueManager.joinQueue({
        sessionId: session.id,
        tenantId: input.tenantId,
        callerCallControlId: callControlId,
        ringGroupId: resolvedTarget.ringGroupId,
        requestId: `${input.requestId || 'ivr'}-queue`,
      });
    } else if (destType === DESTINATION_TYPE.VOICEMAIL) {
      const voicemailManager = require('../Voicemail/voicemailManager');
      await voicemailManager.startVoicemail({
        sessionId: session.id,
        tenantId: input.tenantId,
        callControlId,
        extensionId: resolvedTarget.extensionId,
        reason: 'POLICY',
        requestId: `${input.requestId || 'ivr'}-vm`,
      });
    } else if (destType === DESTINATION_TYPE.CONFERENCE) {
      const conferenceManager = require('../Conference/conferenceManager');
      await conferenceManager.createConference({
        sessionId: session.id,
        tenantId: input.tenantId,
        hostCallControlId: callControlId,
        requestId: `${input.requestId || 'ivr'}-conf`,
      });
    }
  } catch (err) {
    v3Logger.error('ivr.sidecar_route', { error: err.message, destType });
  }
}

/**
 * @param {object} input
 */
async function completeIvr(input) {
  const { session, ivr } = await loadIvrContext(input.sessionId, input.tenantId);
  unregisterActiveIvr(session.id);

  await persistIvrSnapshot(session.id, {
    ...(ivr || {}),
    status: IVR_STATUS.COMPLETED,
    completedAt: new Date().toISOString(),
    completionReason: input.reason || 'completed',
  }, session.version);

  metrics.ivrTotal({ result: 'completed', action: 'complete' });

  await publishIvrEvent({
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: ivr?.callControlId,
  }, DOMAIN_EVENTS.IVR_COMPLETED, {
    traceId: input.traceId,
    reason: input.reason,
    destinationType: input.destinationType,
  });

  return { ok: true };
}

/**
 * @param {object} input
 */
async function exitIvr(input) {
  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const { session, ivr } = await loadIvrContext(input.sessionId, input.tenantId);
  const callControlId = ivr?.callControlId || session.primaryCallControlId;
  const leg = session.legs?.[0];

  const commands = buildIvrCommands({
    action: IVR_ACTION.EXIT,
    policy: { effectiveAction: POLICY_ACTION.ALLOW },
    callControlId,
    destination: { destination: DESTINATION_TYPE.DISCONNECT },
    resolvedTarget: { type: DESTINATION_TYPE.DISCONNECT },
  });

  await enqueueCommands(commands, session, leg, callControlId, flags.observeOnly);
  unregisterActiveIvr(session.id);

  return completeIvr({ ...input, reason: 'exit' });
}

module.exports = {
  startIvr,
  handleInput,
  handleTimeout,
  repeatMenu,
  routeToDestination,
  exitIvr,
  completeIvr,
  resetIvrManagerForTests,
  isIvrActive,
  persistIvrSnapshot,
};
