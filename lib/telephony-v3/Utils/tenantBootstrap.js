const { getPrisma } = require('../internal/prisma');
const { normalizePhoneNumber } = require('../../phone');
const { safeJsonParse } = require('./safeJson');
const { v3Logger } = require('./v3Logger');
const { metrics } = require('./metrics');

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
 * Resolve tenant for a webhook before session bootstrap.
 * Priority: client_state → inbound DID lookup.
 *
 * @param {import('../types').V3NormalizedWebhook} normalized
 * @returns {Promise<{ tenantId: string|null, source: string|null, rejected?: boolean, reason?: string }>}
 */
async function resolveTenantForWebhook(normalized) {
  const fromClientState = extractTenantFromClientState(normalized);
  if (fromClientState) {
    return { tenantId: fromClientState, source: 'client_state' };
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
  resolveTenantForWebhook,
};
