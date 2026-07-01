const { normalizeTelnyxWebhook } = require('../WebhookGateway/normalize');
const sessionRepository = require('../Session/sessionRepository');
const callManager = require('../CallManager/callManager');
const sidecarCoordinator = require('../Sidecar/sidecarCoordinator');
const streams = require('../Redis/streams');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { withSpan } = require('../Utils/tracing');
const { safeJsonParse } = require('../Utils/safeJson');

/**
 * Ingress dispatcher — Phase 2 delegates to CallManager when enabled.
 *
 * @param {{ id: string, fields: Record<string, string> }} job
 * @param {{ workerId?: string }} [ctx]
 */
async function dispatchIngressJob(job, ctx = {}) {
  const start = Date.now();
  const workerId = ctx.workerId || 'unknown';

  return withSpan('telephony.worker.process', {
    workerId,
    ingressId: job.id,
    eventType: job.fields.eventType || 'unknown',
  }, async () => {
    let body = null;

    if (job.fields.payloadRef) {
      body = await streams.loadIngressPayload(job.fields.payloadRef);
      if (!body) {
        throw new Error(`Ingress payload missing for ref ${job.fields.payloadRef}`);
      }
    } else if (job.fields.payload) {
      body = safeJsonParse(job.fields.payload);
      if (!body) {
        v3Logger.error('worker.payload_parse_failed', {
          ingressId: job.id,
          workerId,
          error: 'invalid_inline_payload',
        });
        throw new Error('Invalid inline ingress payload JSON');
      }
    }

    const normalized = normalizeTelnyxWebhook(body, { source: job.fields.source });

    let result = {
      ingressId: job.id,
      eventType: normalized.eventType,
      sessionId: null,
      correlationId: normalized.correlationId,
      handled: false,
    };

    if (callManager.isCallManagerEnabled()) {
      const cmResult = await callManager.processIngressEvent({
        normalized,
        workerId,
        ingressId: job.id,
        traceId: job.fields.traceId || null,
      });
      result = {
        ...result,
        ...cmResult,
        sessionId: cmResult.sessionId || null,
        tenantId: cmResult.tenantId || null,
        correlationId: normalized.correlationId,
      };

      if (cmResult.handled && cmResult.sessionId) {
        await sidecarCoordinator.handlePostIngressMedia({
          normalized,
          sessionId: cmResult.sessionId,
          tenantId: cmResult.tenantId || null,
          callControlId: normalized.callControlId,
        });
      }
    } else {
      let session = null;
      if (normalized.callControlId) {
        session = await sessionRepository.loadSessionByCallControlId(normalized.callControlId);
      }
      result.sessionId = session?.id || null;
      v3Logger.info('worker.dispatched', {
        workerId,
        ingressId: job.id,
        eventType: normalized.eventType,
        callControlId: normalized.callControlId,
        sessionId: session?.id || null,
        correlationId: job.fields.correlationId || normalized.correlationId,
        traceId: job.fields.traceId || null,
        phase: 1,
      });
    }

    metrics.workerProcessed({
      event_type: normalized.eventType,
      has_session: result.sessionId ? 'true' : 'false',
    });
    metrics.observeWorkerDuration(Date.now() - start, { event_type: normalized.eventType });

    return result;
  });
}

module.exports = { dispatchIngressJob };
