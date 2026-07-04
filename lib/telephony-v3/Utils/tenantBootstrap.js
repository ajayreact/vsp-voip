const { getPrisma } = require('../internal/prisma');
const { normalizePhoneNumber } = require('../../phone');
const {
  isOutboundDirection,
  isDeskOriginatedParkedOutbound,
} = require('../../telephony/PayloadNormalizer');
const { safeJsonParse } = require('./safeJson');
const { v3Logger } = require('./v3Logger');
const { metrics } = require('./metrics');

/**
 * @param {import('../types').V3NormalizedWebhook} normalized
 * @returns {Record<string, unknown>|null}
 */
function getTelnyxPayload(normalized) {
  const payload = normalized?.raw?.body?.data?.payload;
  return payload && typeof payload === 'object' ? payload : null;
}

/**
 * Extract tenant from Telnyx client_state payload.
 * @param {import('../types').V3NormalizedWebhook} normalized
 */
function extractTenantFromClientState(normalized) {
  const clientState = normalized.raw?.body?.data?.payload?.client_state;
  if (!clientState) return null;
  const parsed = typeof clientState === 'string' ? safeJsonParse(clientState) : clientState;
  if (parsed?.tenantId) return String(parsed.tenantId);
  if (parsed?.tenant_id) return String(parsed.tenant_id);
  return null;
}

/**
 * Resolve tenant from inbound DID (PhoneNumber → Tenant).
 * @param {string|null|undefined} toAddress
 */
async function resolveTenantFromDid(toAddress) {
  const normalizedDid = normalizePhoneNumber(toAddress);
  if (!normalizedDid) return null;

  const prisma = await getPrisma();
  const phoneRecord = await prisma.phoneNumber.findFirst({
    where: { number: normalizedDid, isActive: true },
    select: { tenantId: true, id: true, number: true },
  });

  if (!phoneRecord?.tenantId) return null;
  return String(phoneRecord.tenantId);
}

/**
 * True when webhook is desk Pattern 1 parked outbound (never use inbound DID on `to`).
 * @param {import('../types').V3NormalizedWebhook} normalized
 */
function isDeskOutboundWebhook(normalized) {
  const payload = getTelnyxPayload(normalized);
  if (payload && isDeskOriginatedParkedOutbound(payload)) {
    return true;
  }
  return String(normalized.state || '').toLowerCase() === 'parked'
    && isOutboundDirection(normalized.direction);
}

/**
 * Resolve desk parked outbound tenant + caller via SIP username, credential fields,
 * extension mapping, or outbound caller-ID DID — not inbound DID on `to`.
 *
 * @param {import('../types').V3NormalizedWebhook} normalized
 */
async function resolveDeskOutboundContext(normalized) {
  if (!isDeskOutboundWebhook(normalized)) {
    return null;
  }

  const payload = getTelnyxPayload(normalized) || {
    from: normalized.from,
    to: normalized.to,
    direction: normalized.direction,
    state: normalized.state,
    connection_id: normalized.connectionId,
    call_control_id: normalized.callControlId,
  };

  const prisma = await getPrisma();
  const { loadPlatformSettings } = require('../../platformSettings');
  const { resolveCallerFromPayload } = require('../../telephony/CallerResolver');
  const platform = await loadPlatformSettings(prisma);

  const caller = await resolveCallerFromPayload(prisma, payload, platform);
  if (!caller?.tenantId) {
    return null;
  }

  return {
    tenantId: String(caller.tenantId),
    source: caller.resolvedVia ? `desk_${caller.resolvedVia}` : 'desk_outbound_payload',
    callKind: 'DESK_OUTBOUND',
    callerUserId: caller.user?.id ?? null,
    callerExtensionId: caller.callerExtension?.id ?? null,
    extensionNumber: caller.callerExtension?.extensionNumber ?? null,
    sipUsername: caller.sipUsername ?? null,
    resolvedVia: caller.resolvedVia ?? null,
  };
}

/** @deprecated Use resolveDeskOutboundContext */
async function resolveTenantFromDeskOutboundFrom(normalized) {
  const ctx = await resolveDeskOutboundContext(normalized);
  return ctx?.tenantId ?? null;
}

/**
 * Resolve tenant for a webhook before session bootstrap.
 * Priority: client_state → desk parked outbound (SIP/credential/extension) → inbound DID.
 *
 * @param {import('../types').V3NormalizedWebhook} normalized
 * @returns {Promise<{
 *   tenantId: string|null,
 *   source: string|null,
 *   rejected?: boolean,
 *   reason?: string,
 *   callKind?: string,
 *   callerUserId?: string|null,
 *   callerExtensionId?: string|null,
 *   extensionNumber?: string|null,
 *   sipUsername?: string|null,
 * }>}
 */
async function resolveTenantForWebhook(normalized) {
  const fromClientState = extractTenantFromClientState(normalized);
  if (fromClientState) {
    return { tenantId: fromClientState, source: 'client_state' };
  }

  if (isDeskOutboundWebhook(normalized)) {
    const deskContext = await resolveDeskOutboundContext(normalized);
    if (deskContext?.tenantId) {
      metrics.tenantBootstrapSuccess({ source: deskContext.source || 'desk_outbound' });
      console.log('[V3] tenant resolved', {
        tenantId: deskContext.tenantId,
        source: deskContext.source,
        extension: deskContext.extensionNumber ?? null,
        callKind: deskContext.callKind,
      });
      console.log('[V3] origin=DESK', {
        tenantId: deskContext.tenantId,
        extension: deskContext.extensionNumber ?? null,
      });
      console.log('[V3] tenantId=', deskContext.tenantId);
      console.log('[V3] extension=', deskContext.extensionNumber ?? null);
      v3Logger.info('tenant.bootstrap.desk', {
        tenantId: deskContext.tenantId,
        source: deskContext.source,
        extensionNumber: deskContext.extensionNumber,
        resolvedVia: deskContext.resolvedVia,
        callControlId: normalized.callControlId,
      });
      return deskContext;
    }

    metrics.tenantBootstrapFailed({ reason: 'desk_caller_unresolved' });
    v3Logger.warn('tenant.bootstrap.failed', {
      reason: 'desk_caller_unresolved',
      from: normalized.from,
      to: normalized.to,
      callControlId: normalized.callControlId,
      eventType: normalized.eventType,
    });
    return { tenantId: null, source: null, rejected: true, reason: 'desk_caller_unresolved' };
  }

  const isInboundPstn = normalized.direction === 'incoming'
    && normalized.state !== 'parked';

  if (isInboundPstn) {
    const tenantId = await resolveTenantFromDid(normalized.to);
    if (tenantId) {
      metrics.tenantBootstrapSuccess({ source: 'did_lookup' });
      return { tenantId, source: 'did_lookup' };
    }

    metrics.tenantBootstrapFailed({ reason: 'unknown_did' });
    v3Logger.warn('tenant.bootstrap.failed', {
      reason: 'unknown_did',
      to: normalized.to,
      callControlId: normalized.callControlId,
      eventType: normalized.eventType,
    });
    return { tenantId: null, source: null, rejected: true, reason: 'unknown_did' };
  }

  return { tenantId: null, source: null };
}

module.exports = {
  extractTenantFromClientState,
  resolveTenantFromDid,
  resolveTenantFromDeskOutboundFrom,
  resolveDeskOutboundContext,
  isDeskOutboundWebhook,
  getTelnyxPayload,
  resolveTenantForWebhook,
};
