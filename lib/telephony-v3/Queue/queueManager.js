const sessionManager = require('../Sessions/sessionManager');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const { evaluateQueuePolicy, POLICY_ACTION } = require('./queuePolicy');
const { buildQueueCommands } = require('./queueCommandBuilder');
const {
  QUEUE_ACTION,
  QUEUE_STATUS,
  QUEUE_ENTRY_SOURCE,
} = require('./queueConstants');
const {
  generateQueueId,
  getQueueFromSnapshot,
  buildInitialQueueState,
  addWaitingEntry,
  removeWaitingEntry,
  registerQueueEntry,
  unregisterQueueEntry,
  isInQueue,
  isQueueWaitTimedOut,
} = require('./queueState');
const agentManager = require('./queueAgentManager');

/** @type {Set<string>} */
const handledRequests = new Set();

function resetQueueManagerForTests() {
  handledRequests.clear();
  require('./queueState').resetQueueStateForTests();
  agentManager.resetQueueAgentManagerForTests();
}

/**
 * Load ring group agents from DB when ringGroupId provided.
 * @param {string} tenantId
 * @param {string|null|undefined} ringGroupId
 */
async function loadRingGroupAgents(tenantId, ringGroupId) {
  if (!ringGroupId) return [];
  const prisma = await getPrisma();
  const members = await prisma.ringGroupMember.findMany({
    where: {
      ringGroupId,
      isActive: true,
      ringGroup: { tenantId },
    },
    include: {
      extension: {
        select: {
          id: true,
          displayName: true,
          telnyxSipUsername: true,
          dndEnabled: true,
          dndInboundAction: true,
          isActive: true,
        },
      },
    },
    orderBy: { priority: 'asc' },
  });

  return members.map((m) => ({
    extensionId: m.extensionId,
    sipUsername: m.extension?.telnyxSipUsername,
    dialTo: m.extension?.telnyxSipUsername
      ? `sip:${m.extension.telnyxSipUsername}@sip.telnyx.com`
      : null,
    priority: m.priority,
    lastAnsweredAt: m.lastAnsweredAt,
    lastRungAt: m.lastRungAt,
    available: m.extension?.isActive !== false,
    dnd: m.extension?.dndEnabled === true,
    isActive: m.isActive,
  }));
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   ringGroupId?: string|null,
 *   queueName?: string|null,
 *   ringStrategy?: string,
 *   agents?: Array<Record<string, unknown>>,
 *   overflowDestination?: string|null,
 *   callerCallControlId?: string,
 *   callerLegId?: string,
 *   entrySource?: string,
 *   connectionId?: string|null,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function createQueue(input) {
  const requestKey = `${input.sessionId}:queue:create:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.queueEnabled) {
    return { skipped: true, reason: 'queue_disabled' };
  }

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = session.legs?.find((l) => l.id === input.callerLegId)
    || session.legs?.find((l) => l.callControlId === input.callerCallControlId)
    || session.legs?.[0];

  const callerCallControlId = input.callerCallControlId || leg?.callControlId || session.primaryCallControlId;
  const queueId = generateQueueId();

  let agents = input.agents;
  if (!agents?.length && input.ringGroupId) {
    agents = await loadRingGroupAgents(input.tenantId, input.ringGroupId);
  }

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
      action: QUEUE_ACTION.CREATE,
      queueEnabled: flags.queueEnabled,
      observeOnly: flags.observeOnly,
      overflowDestination: input.overflowDestination,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_FAILED, { policy });
      metrics.queueTotal({ result: 'failed', action: 'create' });
      return { ok: false, policy };
    }

    const queue = buildInitialQueueState({
      queueId,
      ringGroupId: input.ringGroupId,
      queueName: input.queueName,
      ringStrategy: input.ringStrategy,
      entrySource: input.entrySource || QUEUE_ENTRY_SOURCE.DIRECT,
      callerCallControlId,
      callerLegId: leg?.id,
      agents: agents || [],
      overflowDestination: input.overflowDestination,
      maxWaitingTimeSec: policy.maxWaitingTimeSec,
      agentTimeoutSec: policy.agentTimeoutSec,
    });

    await agentManager.persistQueueSnapshot(session.id, queue, session.version);

    await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_CREATED, {
      traceId: input.traceId || requestKey,
      queueId,
      ringStrategy: queue.ringStrategy,
      entrySource: queue.entrySource,
    });

    metrics.queueTotal({ result: 'created', action: 'create' });

    v3Logger.info('queue.created', {
      sessionId: session.id,
      queueId,
      ringStrategy: queue.ringStrategy,
    });

    return { ok: true, queueId, policy };
  } catch (error) {
    metrics.queueTotal({ result: 'failed', action: 'create' });
    await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_FAILED, { error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {Parameters<typeof createQueue>[0]} input
 */
async function joinQueue(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:queue:join:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.queueEnabled) {
    return { skipped: true, reason: 'queue_disabled' };
  }

  if (isInQueue(input.sessionId)) {
    return { skipped: true, reason: 'already_in_queue' };
  }

  const { session, queue: existingQueue } = await agentManager.loadQueueContext(input.sessionId, input.tenantId);
  let queueId = existingQueue?.queueId;

  if (!existingQueue) {
    const created = await createQueue({
      ...input,
      requestId: `${input.requestId || 'join'}-create`,
    });
    if (!created.ok && !created.queueId) {
      return created;
    }
    queueId = created.queueId;
  }

  const { session: freshSession, queue: loadedQueue } = await agentManager.loadQueueContext(input.sessionId, input.tenantId);
  const queue = loadedQueue;
  if (!queue) {
    return { ok: false, error: 'queue_not_found' };
  }

  const callerCallControlId = queue.callerCallControlId || input.callerCallControlId || freshSession.primaryCallControlId;
  const leg = freshSession.legs?.find((l) => l.callControlId === callerCallControlId) || freshSession.legs?.[0];

  const eventBase = {
    sessionId: freshSession.id,
    tenantId: freshSession.tenantId,
    correlationId: freshSession.correlationId,
    callControlId: callerCallControlId,
  };

  try {
    const policy = await evaluateQueuePolicy({
      tenantId: input.tenantId,
      sessionId: freshSession.id,
      action: QUEUE_ACTION.JOIN,
      queueEnabled: flags.queueEnabled,
      observeOnly: flags.observeOnly,
      queue,
      overflowDestination: queue.overflowDestination,
    });

    const commands = buildQueueCommands({
      action: QUEUE_ACTION.JOIN,
      policy,
      callerCallControlId,
      queueId: queue.queueId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_FAILED, { policy });
      return { ok: false, policy };
    }

    const updatedQueue = addWaitingEntry(queue, {
      sessionId: freshSession.id,
      callControlId: callerCallControlId,
      entrySource: input.entrySource || queue.entrySource,
    });

    await agentManager.persistQueueSnapshot(freshSession.id, updatedQueue, freshSession.version);
    registerQueueEntry(freshSession.id, queue.queueId);

    const timerService = require('../Timer/timerService');
    const waitTimeoutSec = queue.maxWaitSec ?? queue.waitTimeoutSec ?? 300;
    await timerService.scheduleTimer(freshSession.id, 'queue-wait-timeout', waitTimeoutSec).catch(() => {});

    await agentManager.enqueueCommands(commands, freshSession, leg, callerCallControlId, flags.observeOnly);

    const waitMs = Date.now() - startedMs;
    metrics.queueTotal({ result: 'entered', action: 'join' });
    metrics.observeQueueWaitDuration(waitMs, { action: 'enter' });

    await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_ENTERED, {
      traceId: input.traceId,
      queueId: queue.queueId,
      entrySource: input.entrySource,
    });

    await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_WAITING, {
      traceId: input.traceId,
      queueId: queue.queueId,
      waitingCount: updatedQueue.waitingEntries?.length ?? 1,
    });

    const assignResult = await agentManager.assignAgent({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      requestId: `${input.requestId || 'join'}-assign`,
      traceId: input.traceId,
    });

    return { ok: true, queueId: queue.queueId, assignResult };
  } catch (error) {
    metrics.queueTotal({ result: 'failed', action: 'join' });
    await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_FAILED, { error: error.message });
    return { ok: false, error: error.message };
  }
}

async function joinQueueFromPstn(input) {
  return joinQueue({ ...input, entrySource: QUEUE_ENTRY_SOURCE.PSTN });
}

async function joinQueueFromDeskTransfer(input) {
  return joinQueue({ ...input, entrySource: QUEUE_ENTRY_SOURCE.DESK_TRANSFER });
}

async function joinQueueFromMobileTransfer(input) {
  return joinQueue({ ...input, entrySource: QUEUE_ENTRY_SOURCE.MOBILE_TRANSFER });
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function leaveQueue(input) {
  const requestKey = `${input.sessionId}:queue:leave:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.queueEnabled) {
    return { skipped: true, reason: 'queue_disabled' };
  }

  const { session, queue } = await agentManager.loadQueueContext(input.sessionId, input.tenantId);
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
    action: QUEUE_ACTION.LEAVE,
    queueEnabled: flags.queueEnabled,
    observeOnly: flags.observeOnly,
    queue,
  });

  const commands = buildQueueCommands({
    action: QUEUE_ACTION.LEAVE,
    policy,
    callerCallControlId,
    queueId: queue.queueId,
  });

  const updatedQueue = removeWaitingEntry({
    ...queue,
    status: QUEUE_STATUS.CLOSED,
    closedAt: new Date().toISOString(),
  }, session.id);

  await agentManager.persistQueueSnapshot(session.id, updatedQueue, session.version);
  unregisterQueueEntry(session.id);

  await agentManager.enqueueCommands(commands, session, leg, callerCallControlId, flags.observeOnly);
  metrics.queueTotal({ result: 'left', action: 'leave' });

  await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_COMPLETED, {
    traceId: input.traceId,
    reason: 'caller_left',
  });

  return { ok: true };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function handleWaitTimeout(input) {
  const { session, queue } = await agentManager.loadQueueContext(input.sessionId, input.tenantId);
  if (!queue) {
    return { ok: false, error: 'queue_not_found' };
  }

  const maxWait = queue.maxWaitingTimeSec ?? 300;
  if (!isQueueWaitTimedOut(input.sessionId, maxWait)) {
    return { skipped: true, reason: 'not_timed_out' };
  }

  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: queue.callerCallControlId,
  };

  await agentManager.publishQueueEvent(eventBase, DOMAIN_EVENTS.QUEUE_TIMEOUT, {
    traceId: input.traceId,
    reason: 'max_waiting_time',
    maxWaitingTimeSec: maxWait,
  });
  metrics.queueTimeout({ reason: 'max_wait' });

  return agentManager.handleOverflow({
    ...input,
    requestId: input.requestId || 'wait-timeout',
  });
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function cleanupQueue(input) {
  const { session, queue } = await agentManager.loadQueueContext(input.sessionId, input.tenantId);
  if (!queue) {
    return { skipped: true, reason: 'no_queue' };
  }

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const callerCallControlId = queue.callerCallControlId || session.primaryCallControlId;
  const leg = session.legs?.[0];

  const commands = buildQueueCommands({
    action: QUEUE_ACTION.CLEANUP,
    policy: { effectiveAction: POLICY_ACTION.ALLOW },
    callerCallControlId,
    queueId: queue.queueId,
  });

  await agentManager.enqueueCommands(commands, session, leg, callerCallControlId, flags.observeOnly);

  await agentManager.persistQueueSnapshot(session.id, {
    ...queue,
    status: QUEUE_STATUS.CLOSED,
    closedAt: new Date().toISOString(),
  }, session.version);

  unregisterQueueEntry(session.id);
  metrics.queueTotal({ result: 'cleaned', action: 'cleanup' });

  await agentManager.publishQueueEvent({
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: callerCallControlId,
  }, DOMAIN_EVENTS.QUEUE_COMPLETED, { traceId: input.traceId, reason: 'cleanup' });

  return { ok: true };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function startQueueRecording(input) {
  const requestKey = `${input.sessionId}:queue:rec-start:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.queueEnabled) {
    return { skipped: true, reason: 'queue_disabled' };
  }

  const { session, queue } = await agentManager.loadQueueContext(input.sessionId, input.tenantId);
  if (!queue) {
    return { ok: false, error: 'queue_not_found' };
  }

  const callerCallControlId = queue.callerCallControlId || session.primaryCallControlId;
  const leg = session.legs?.find((l) => l.callControlId === callerCallControlId) || session.legs?.[0];

  const commands = buildQueueCommands({
    action: QUEUE_ACTION.START_RECORDING,
    policy: { effectiveAction: POLICY_ACTION.ALLOW },
    callerCallControlId,
    queueId: queue.queueId,
  });

  await agentManager.persistQueueSnapshot(session.id, {
    ...queue,
    recordingActive: true,
    recordingStartedAt: new Date().toISOString(),
  }, session.version);

  await agentManager.enqueueCommands(commands, session, leg, callerCallControlId, flags.observeOnly);
  metrics.queueTotal({ result: 'recording_started', action: 'recording' });

  return { ok: true };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function stopQueueRecording(input) {
  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const { session, queue } = await agentManager.loadQueueContext(input.sessionId, input.tenantId);
  if (!queue) {
    return { ok: false, error: 'queue_not_found' };
  }

  const callerCallControlId = queue.callerCallControlId || session.primaryCallControlId;
  const leg = session.legs?.find((l) => l.callControlId === callerCallControlId) || session.legs?.[0];

  const commands = buildQueueCommands({
    action: QUEUE_ACTION.STOP_RECORDING,
    policy: { effectiveAction: POLICY_ACTION.ALLOW },
    callerCallControlId,
    queueId: queue.queueId,
  });

  await agentManager.persistQueueSnapshot(session.id, {
    ...queue,
    recordingActive: false,
    recordingStoppedAt: new Date().toISOString(),
  }, session.version);

  await agentManager.enqueueCommands(commands, session, leg, callerCallControlId, flags.observeOnly);

  return { ok: true };
}

module.exports = {
  createQueue,
  joinQueue,
  joinQueueFromPstn,
  joinQueueFromDeskTransfer,
  joinQueueFromMobileTransfer,
  leaveQueue,
  handleWaitTimeout,
  handleOverflow: agentManager.handleOverflow,
  cleanupQueue,
  startQueueRecording,
  stopQueueRecording,
  assignAgent: agentManager.assignAgent,
  agentAnswered: agentManager.agentAnswered,
  handleAgentTimeout: agentManager.handleAgentTimeout,
  resetQueueManagerForTests,
  isInQueue,
  loadRingGroupAgents,
};
