const crypto = require('crypto');
const sessionManager = require('../Sessions/sessionManager');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const { evaluateQueuePolicy, POLICY_ACTION } = require('./queuePolicy');
const { buildQueueCommands } = require('./queueCommandBuilder');
const { QUEUE_ACTION, QUEUE_STATUS } = require('./queueConstants');
const { selectAgentsForStrategy } = require('./queueStrategy');
const {
  getQueueFromSnapshot,
  getRoundRobinPointer,
} = require('./queueState');

/** @type {Set<string>} */
const handledRequests = new Set();

function resetQueueAgentManagerForTests() {
  handledRequests.clear();
}

async function publishQueueEvent(base, eventType, payload) {
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

async function persistQueueSnapshot(sessionId, queuePatch, version) {
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const snapshot = {
    ...(row?.routeSnapshot && typeof row.routeSnapshot === 'object' ? row.routeSnapshot : {}),
    queue: {
      ...(getQueueFromSnapshot(row?.routeSnapshot) || {}),
      ...queuePatch,
    },
  };
  await prisma.v3CallSession.updateMany({
    where: { id: sessionId, version },
    data: { routeSnapshot: snapshot, version: { increment: 1 }, updatedAt: new Date() },
  });
  return snapshot.queue;
}

async function loadQueueContext(sessionId, tenantId) {
  const session = await sessionManager.loadSession(sessionId, tenantId);
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const queue = getQueueFromSnapshot(row?.routeSnapshot);
  return { session, queue };
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

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   connectionId?: string|null,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function assignAgent(input) {
  const requestKey = `${input.sessionId}:queue:assign:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.queueEnabled) {
    return { skipped: true, reason: 'queue_disabled' };
  }

  const { session, queue } = await loadQueueContext(input.sessionId, input.tenantId);
  if (!queue) {
    return { ok: false, error: 'queue_not_found' };
  }

  const callerCallControlId = queue.callerCallControlId || session.primaryCallControlId;
  const leg = session.legs?.find((l) => l.callControlId === callerCallControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: callerCallControlId,
  };

  try {
    const policy = await evaluateQueuePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: QUEUE_ACTION.ASSIGN,
      queueEnabled: flags.queueEnabled,
      observeOnly: flags.observeOnly,
      queue,
      agents: queue.agents,
      overflowDestination: queue.overflowDestination,
    });

    const queueKey = `${input.tenantId}:${queue.queueId}`;
    const selection = selectAgentsForStrategy({
      strategy: queue.ringStrategy,
      agents: queue.agents,
      queueKey,
      roundRobinPointer: queue.roundRobinPointer ?? getRoundRobinPointer(queueKey),
      sequentialIndex: queue.sequentialIndex ?? 0,
    });

    const commands = buildQueueCommands({
      action: QUEUE_ACTION.ASSIGN,
      policy,
      callerCallControlId,
      agents: selection.agents,
      connectionId: input.connectionId,
      queueId: queue.queueId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      metrics.queueTotal({ result: 'failed', action: 'assign' });
      await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_FAILED, { policy, traceId: input.traceId });
      return { ok: false, policy };
    }

    await persistQueueSnapshot(session.id, {
      ...queue,
      status: QUEUE_STATUS.RINGING,
      selectedAgents: selection.agents.map((a) => a.extensionId),
      roundRobinPointer: selection.nextPointer ?? queue.roundRobinPointer,
      sequentialIndex: selection.nextSequentialIndex ?? queue.sequentialIndex,
      lastAssignedAt: new Date().toISOString(),
    }, session.version);

    metrics.queueAgentSelection({ strategy: queue.ringStrategy, count: selection.agents.length });

    await enqueueCommands(commands, session, leg, callerCallControlId, flags.observeOnly);

    const timerService = require('../Timer/timerService');
    const agentTimeoutSec = selection.agents[0]?.timeoutSecs ?? queue.agentTimeoutSec ?? 25;
    await timerService.scheduleTimer(session.id, 'queue-agent-timeout', agentTimeoutSec).catch(() => {});

    for (const agent of selection.agents) {
      await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_AGENT_SELECTED, {
        traceId: input.traceId,
        agentExtensionId: agent.extensionId,
        strategy: queue.ringStrategy,
        commandsEnqueued: !flags.observeOnly,
      });
    }

    v3Logger.info('queue.agent_selected', {
      sessionId: session.id,
      strategy: queue.ringStrategy,
      agentCount: selection.agents.length,
    });

    return { ok: true, agents: selection.agents, policy };
  } catch (error) {
    metrics.queueTotal({ result: 'failed', action: 'assign' });
    await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_FAILED, { error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   connectionId?: string|null,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function handleOverflow(input) {
  const requestKey = `${input.sessionId}:queue:overflow:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const { session, queue } = await loadQueueContext(input.sessionId, input.tenantId);
  if (!queue) {
    return { ok: false, error: 'queue_not_found' };
  }

  const callerCallControlId = queue.callerCallControlId || session.primaryCallControlId;
  const leg = session.legs?.find((l) => l.callControlId === callerCallControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: callerCallControlId,
  };

  const policy = await evaluateQueuePolicy({
    tenantId: input.tenantId,
    sessionId: session.id,
    action: QUEUE_ACTION.OVERFLOW,
    queueEnabled: flags.queueEnabled,
    observeOnly: flags.observeOnly,
    queue,
    overflowDestination: queue.overflowDestination,
  });

  const commands = buildQueueCommands({
    action: QUEUE_ACTION.OVERFLOW,
    policy,
    callerCallControlId,
    overflowDestination: queue.overflowDestination,
    connectionId: input.connectionId,
    queueId: queue.queueId,
  });

  await persistQueueSnapshot(session.id, {
    ...queue,
    status: QUEUE_STATUS.OVERFLOW,
    overflowAt: new Date().toISOString(),
  }, session.version);

  await enqueueCommands(commands, session, leg, callerCallControlId, flags.observeOnly);
  metrics.queueOverflow({ reason: policy.reason || 'max_retries' });

  await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_OVERFLOW, {
    traceId: input.traceId,
    overflowDestination: queue.overflowDestination,
  });

  await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_COMPLETED, {
    traceId: input.traceId,
    reason: 'overflow',
  });

  return { ok: true, policy };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   agentCallControlId?: string,
 *   agentExtensionId?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function agentAnswered(input) {
  const requestKey = `${input.sessionId}:queue:answered:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const { session, queue } = await loadQueueContext(input.sessionId, input.tenantId);
  if (!queue) {
    return { ok: false, error: 'queue_not_found' };
  }

  const callerCallControlId = queue.callerCallControlId || session.primaryCallControlId;
  const leg = session.legs?.find((l) => l.callControlId === callerCallControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: callerCallControlId,
  };

  const agents = [{
    extensionId: input.agentExtensionId,
    callControlId: input.agentCallControlId,
  }];

  const policy = await evaluateQueuePolicy({
    tenantId: input.tenantId,
    sessionId: session.id,
    action: QUEUE_ACTION.AGENT_ANSWERED,
    queueEnabled: flags.queueEnabled,
    observeOnly: flags.observeOnly,
    queue,
  });

  const commands = buildQueueCommands({
    action: QUEUE_ACTION.AGENT_ANSWERED,
    policy,
    callerCallControlId,
    agents,
    queueId: queue.queueId,
  });

  await persistQueueSnapshot(session.id, {
    ...queue,
    status: QUEUE_STATUS.CONNECTED,
    connectedAt: new Date().toISOString(),
    connectedAgentExtensionId: input.agentExtensionId ?? null,
    retryCount: 0,
  }, session.version);

  await enqueueCommands(commands, session, leg, callerCallControlId, flags.observeOnly);

  await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_AGENT_ANSWERED, {
    traceId: input.traceId,
    agentExtensionId: input.agentExtensionId,
  });

  await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_COMPLETED, {
    traceId: input.traceId,
    reason: 'agent_answered',
  });

  metrics.queueTotal({ result: 'connected', action: 'agent_answered' });

  return { ok: true };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   connectionId?: string|null,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function handleAgentTimeout(input) {
  const { session, queue } = await loadQueueContext(input.sessionId, input.tenantId);
  if (!queue) {
    return { ok: false, error: 'queue_not_found' };
  }

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const callerCallControlId = queue.callerCallControlId || session.primaryCallControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: callerCallControlId,
  };

  const retryCount = (queue.retryCount ?? 0) + 1;
  await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_TIMEOUT, {
    traceId: input.traceId,
    retryCount,
    agentTimeoutSec: queue.agentTimeoutSec,
  });
  metrics.queueTimeout({ reason: 'agent_timeout' });

  const policy = await evaluateQueuePolicy({
    tenantId: input.tenantId,
    sessionId: session.id,
    action: QUEUE_ACTION.RETRY,
    queueEnabled: flags.queueEnabled,
    observeOnly: flags.observeOnly,
    queue: { ...queue, retryCount },
    agents: queue.agents,
    overflowDestination: queue.overflowDestination,
  });

  if (policy.overflow || policy.reason === 'overflow') {
    return handleOverflow({
      ...input,
      requestId: `${input.requestId || 'timeout'}-overflow`,
    });
  }

  if (policy.effectiveAction === POLICY_ACTION.DENY) {
    return handleOverflow(input);
  }

  await persistQueueSnapshot(session.id, {
    ...queue,
    retryCount,
    status: QUEUE_STATUS.WAITING,
  }, session.version);

  metrics.queueRetry({ attempt: retryCount });

  await publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_RETRY, {
    traceId: input.traceId,
    retryCount,
  });

  return assignAgent({
    ...input,
    requestId: `${input.requestId || 'retry'}-${retryCount}`,
  });
}

module.exports = {
  assignAgent,
  agentAnswered,
  handleAgentTimeout,
  handleOverflow,
  persistQueueSnapshot,
  publishQueueEvent,
  loadQueueContext,
  enqueueCommands,
  resetQueueAgentManagerForTests,
};
