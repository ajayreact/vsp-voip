const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');

/** @type {boolean} */
let registered = false;

/**
 * Clean sidecar metadata and in-memory registries after session ends.
 * @param {{ sessionId: string, tenantId?: string|null, reason?: string }} input
 */
async function cleanupSessionSidecars(input) {
  const { sessionId, tenantId, reason = 'session_closed' } = input;
  let cleaned = 0;

  try {
    const ivrManager = require('../IVR/ivrManager');
    if (ivrManager.isIvrActive(sessionId)) {
      await ivrManager.exitIvr({
        sessionId,
        tenantId: tenantId || 'unknown',
        requestId: `cleanup-${sessionId}`,
      }).catch(() => {});
      cleaned += 1;
    }
  } catch { /* sidecar optional */ }

  try {
    const queueManager = require('../Queue/queueManager');
    const result = await queueManager.cleanupQueue({
      sessionId,
      tenantId: tenantId || 'unknown',
      requestId: `cleanup-${sessionId}`,
    }).catch(() => null);
    if (result?.ok) cleaned += 1;
  } catch { /* sidecar optional */ }

  try {
    const conferenceManager = require('../Conference/conferenceManager');
    const result = await conferenceManager.cleanupConference({
      sessionId,
      tenantId: tenantId || 'unknown',
      requestId: `cleanup-${sessionId}`,
    }).catch(() => null);
    if (result?.ok) cleaned += 1;
  } catch { /* sidecar optional */ }

  try {
    const recordingManager = require('../Recording/recordingManager');
    await recordingManager.stopRecording({
      sessionId,
      tenantId: tenantId || 'unknown',
      requestId: `cleanup-${sessionId}`,
    }).catch(() => {});
    cleaned += 1;
  } catch { /* sidecar optional */ }

  try {
    const holdManager = require('../HoldTransfer/holdManager');
    await holdManager.forceReleaseHold({
      sessionId,
      tenantId: tenantId || 'unknown',
      requestId: `cleanup-${sessionId}`,
    }).catch(() => {});
  } catch { /* optional */ }

  try {
    const transferManager = require('../HoldTransfer/transferManager');
    await transferManager.forceCancelTransfer({
      sessionId,
      tenantId: tenantId || 'unknown',
      requestId: `cleanup-${sessionId}`,
    }).catch(() => {});
  } catch { /* optional */ }

  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true, version: true },
  });

  if (row?.routeSnapshot && typeof row.routeSnapshot === 'object') {
    const snap = { ...row.routeSnapshot };
    delete snap.ivr;
    delete snap.ivrMenuTree;
    delete snap.queue;
    delete snap.conference;
    delete snap.recording;
    delete snap.voicemail;
    if (snap.holdTransfer) {
      snap.holdTransfer = {
        ...(typeof snap.holdTransfer === 'object' ? snap.holdTransfer : {}),
        holdActive: false,
        transferActive: false,
        cleanedAt: new Date().toISOString(),
      };
    }
    await prisma.v3CallSession.updateMany({
      where: { id: sessionId },
      data: { routeSnapshot: snap, updatedAt: new Date() },
    });
  }

  metrics.sessionCleanupTotal({ reason }, cleaned);
  v3Logger.info('session.cleanup.completed', { sessionId, tenantId, reason, cleaned });
  return { ok: true, cleaned };
}

async function handleSessionClosedEvent(event) {
  if (!event?.sessionId) return;
  await cleanupSessionSidecars({
    sessionId: event.sessionId,
    tenantId: event.tenantId,
    reason: 'session_closed',
  });
}

async function handleLegEndedEvent(event) {
  if (!event?.sessionId) return;
  const prisma = await getPrisma();
  const session = await prisma.v3CallSession.findUnique({
    where: { id: event.sessionId },
    select: { state: true, tenantId: true },
  });
  if (session && ['ENDED', 'FAILED'].includes(session.state)) {
    await cleanupSessionSidecars({
      sessionId: event.sessionId,
      tenantId: session.tenantId || event.tenantId,
      reason: 'session_terminal',
    });
  }
}

function registerSessionCleanup() {
  if (registered) return;
  registered = true;
  eventBus.subscribe(DOMAIN_EVENTS.SESSION_CLOSED, handleSessionClosedEvent);
  eventBus.subscribe(DOMAIN_EVENTS.LEG_ENDED, handleLegEndedEvent);
}

function resetSessionCleanupForTests() {
  registered = false;
}

module.exports = {
  cleanupSessionSidecars,
  registerSessionCleanup,
  resetSessionCleanupForTests,
};
