const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const timerService = require('../Timer/timerService');
const featureFlags = require('../FeatureFlags/featureFlagService');
const sessionManager = require('../Sessions/sessionManager');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { registerSessionCleanup } = require('./sessionCleanup');

/** @type {boolean} */
let registered = false;

/**
 * Handle Telnyx media/lifecycle webhooks after CallManager FSM processing.
 * @param {{
 *   normalized: import('../types').V3NormalizedWebhook,
 *   sessionId: string,
 *   tenantId: string|null,
 *   callControlId?: string|null,
 * }} ctx
 */
async function handlePostIngressMedia(ctx) {
  const { normalized, sessionId, tenantId } = ctx;
  if (!sessionId || !tenantId) return;

  const eventType = normalized.eventType;
  const requestBase = normalized.telnyxEventId || `${sessionId}:${eventType}`;

  try {
    if (eventType === 'call.gather.ended') {
      const flags = await featureFlags.getTenantFlags(tenantId);
      if (!flags.ivrEnabled) return;
      const digits = normalized.raw?.body?.data?.payload?.digits
        ?? normalized.raw?.body?.data?.payload?.dtmf
        ?? null;
      const ivrManager = require('../IVR/ivrManager');
      await ivrManager.handleInput({
        sessionId,
        tenantId,
        digits: digits != null ? String(digits) : null,
        requestId: `${requestBase}-gather`,
      });
      return;
    }

    if (eventType === 'call.recording.saved') {
      const flags = await featureFlags.getTenantFlags(tenantId);
      if (!flags.voicemailEnabled) return;
      const voicemailManager = require('../Voicemail/voicemailManager');
      const recordingUrl = normalized.raw?.body?.data?.payload?.recording_urls?.mp3
        ?? normalized.raw?.body?.data?.payload?.public_recording_urls?.mp3
        ?? null;
      await voicemailManager.saveVoicemail({
        sessionId,
        tenantId,
        recordingUrl,
        requestId: `${requestBase}-vm-saved`,
      }).catch((err) => {
        v3Logger.warn('sidecar.voicemail_saved.failed', { sessionId, error: err.message });
      });
    }
  } catch (error) {
    v3Logger.error('sidecar.post_ingress.failed', {
      sessionId,
      eventType,
      error: error.message,
    });
  }
}

/**
 * Start IVR when PSTN routing selects IVR destination.
 * @param {{ sessionId: string, tenantId: string, callControlId: string, connectionId?: string|null }} input
 */
async function startIvrFromRouting(input) {
  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.ivrEnabled) return { skipped: true, reason: 'ivr_disabled' };
  const ivrManager = require('../IVR/ivrManager');
  return ivrManager.startIvr({
    sessionId: input.sessionId,
    tenantId: input.tenantId,
    callControlId: input.callControlId,
    connectionId: input.connectionId,
    requestId: `route-ivr-${input.sessionId}`,
  });
}

async function handleTimerExpired({ sessionId, name }) {
  metrics.timerExecutionTotal({ timer_name: name || 'unknown' });
  v3Logger.info('sidecar.timer.expired', { sessionId, name });

  const prisma = require('../internal/prisma').getPrisma;
  const db = await prisma();
  const session = await db.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { tenantId: true, primaryCallControlId: true },
  });
  if (!session?.tenantId) return;

  const tenantId = session.tenantId;

  if (name === 'ivr-digit-timeout') {
    const ivrManager = require('../IVR/ivrManager');
    await ivrManager.handleTimeout({
      sessionId,
      tenantId,
      requestId: `timer-ivr-${sessionId}`,
    });
    return;
  }

  if (name === 'queue-wait-timeout') {
    const queueManager = require('../Queue/queueManager');
    await queueManager.handleWaitTimeout({
      sessionId,
      tenantId,
      requestId: `timer-queue-wait-${sessionId}`,
    });
    return;
  }

  if (name === 'queue-agent-timeout') {
    const queueManager = require('../Queue/queueManager');
    await queueManager.handleAgentTimeout({
      sessionId,
      tenantId,
      requestId: `timer-queue-agent-${sessionId}`,
    });
    return;
  }

  if (name === 'transfer-timeout') {
    const transferManager = require('../HoldTransfer/transferManager');
    await transferManager.failTransfer({
      sessionId,
      tenantId,
      transferType: 'ATTENDED',
      requestId: `timer-transfer-${sessionId}`,
    }).catch(() => {});
    return;
  }

  if (name === 'conference-cleanup') {
    const conferenceManager = require('../Conference/conferenceManager');
    await conferenceManager.cleanupConference({
      sessionId,
      tenantId,
      requestId: `timer-conf-${sessionId}`,
    });
  }
}

async function handleSessionStateChanged(event) {
  if (!event?.sessionId || !event?.tenantId) return;
  const toState = event.payload?.transition?.toState;
  if (toState !== 'ACTIVE' && toState !== 'BRIDGED') return;

  const flags = await featureFlags.getTenantFlags(event.tenantId);
  if (!flags.recordingEnabled) return;

  try {
    const recordingManager = require('../Recording/recordingManager');
    await recordingManager.startAutomaticRecording({
      sessionId: event.sessionId,
      tenantId: event.tenantId,
      requestId: `auto-rec-${event.sessionId}`,
    });
  } catch (error) {
    v3Logger.debug('sidecar.auto_recording.skipped', { error: error.message });
  }
}

function registerSidecarCoordinator() {
  if (registered) return;
  registered = true;

  registerSessionCleanup();

  timerService.registerExpireHandler('sidecar-coordinator', (payload) => {
    handleTimerExpired(payload).catch((err) => {
      v3Logger.error('sidecar.timer.handler_failed', { error: err.message });
    });
  });

  eventBus.subscribe(DOMAIN_EVENTS.SESSION_STATE_CHANGED, handleSessionStateChanged);

  v3Logger.info('sidecar.coordinator.registered', { phase: '3.9.5' });
}

function resetSidecarCoordinatorForTests() {
  registered = false;
  require('./sessionCleanup').resetSessionCleanupForTests();
}

module.exports = {
  registerSidecarCoordinator,
  handlePostIngressMedia,
  startIvrFromRouting,
  handleTimerExpired,
  resetSidecarCoordinatorForTests,
};
