/**
 * ProviderManager — Super-Admin-facing lifecycle/health/credential surface
 * for telephony providers (VSP Phone V3 Multi-Provider Architecture, Phase 3/5).
 *
 * This module owns all reads/writes to the new additive provider tables
 * (`Provider`, `TenantProvider`, `ProviderCredential`). It never touches the
 * legacy `telnyx*`-prefixed columns on `User`/`Extension`/`PhoneNumber`/
 * `PlatformSettings` — those remain owned by `lib/platformSettings.js` and
 * the legacy Telnyx modules.
 */

const { getPrisma } = require('../../db');
const { encrypt, decrypt, maskSecret } = require('../platformSettings');
const { createProvider, isRegisteredProvider, getRegisteredProviderKeys } = require('./ProviderFactory');
const ProviderResolver = require('./ProviderResolver');
const { logger } = require('../logger');

/**
 * @returns {Promise<Array<import('@prisma/client').Provider>>}
 */
async function listProviders() {
  const prisma = await getPrisma();
  return prisma.provider.findMany({ orderBy: { key: 'asc' } });
}

/**
 * @param {string} key
 */
async function getProviderByKey(key) {
  const prisma = await getPrisma();
  return prisma.provider.findUnique({ where: { key: String(key || '').toLowerCase() } });
}

/**
 * Registers (or updates) a Provider row for a provider key that has a
 * runtime implementation in ProviderFactory. Called lazily by admin routes
 * so a provider can be "discovered" without a bespoke migration per provider.
 * @param {string} key
 * @param {{ displayName?: string, capabilities?: Record<string, boolean> }} [defaults]
 */
async function ensureProviderRow(key, defaults = {}) {
  const normalizedKey = String(key || '').toLowerCase();
  const prisma = await getPrisma();
  let capabilities = defaults.capabilities;

  if (!capabilities && isRegisteredProvider(normalizedKey)) {
    try {
      capabilities = createProvider(normalizedKey).getCapabilities();
    } catch {
      capabilities = {};
    }
  }

  return prisma.provider.upsert({
    where: { key: normalizedKey },
    update: {},
    create: {
      id: normalizedKey,
      key: normalizedKey,
      displayName: defaults.displayName || normalizedKey,
      isActive: false,
      capabilities: capabilities || {},
    },
  });
}

/**
 * @param {string} key
 * @param {boolean} isActive
 */
async function setProviderActive(key, isActive) {
  const prisma = await getPrisma();
  const provider = await prisma.provider.update({
    where: { key: String(key || '').toLowerCase() },
    data: { isActive: Boolean(isActive) },
  });
  ProviderResolver.invalidateAll();
  return provider;
}

/**
 * Runtime health check — instantiates the provider and calls its
 * `checkHealth()`. Never throws; failures are surfaced as `{ ok: false }`.
 * @param {string} key
 */
async function checkHealth(key) {
  const normalizedKey = String(key || '').toLowerCase();
  if (!isRegisteredProvider(normalizedKey)) {
    return { ok: false, message: `No runtime implementation registered for "${key}"`, checkedAt: new Date().toISOString() };
  }
  try {
    const provider = createProvider(normalizedKey);
    return await provider.checkHealth();
  } catch (error) {
    // Never throws — a non-Telnyx provider being unreachable/misconfigured
    // must only ever surface here (Super Admin health panel), never as an
    // unhandled error that could affect Telnyx traffic on the same process.
    logger.warn('provider.health_check_failed', { providerKey: normalizedKey, error: error.message });
    return { ok: false, message: error.message, checkedAt: new Date().toISOString() };
  }
}

/**
 * @param {{ tenantId?: string|null, providerKey: string, scope: 'VOICE'|'MESSAGING'|'SIP',
 *   externalAccountId?: string, secret?: string, authToken?: string, metadata?: Record<string, unknown> }} input
 */
async function upsertCredential(input) {
  const prisma = await getPrisma();
  const provider = await getProviderByKey(input.providerKey);
  if (!provider) {
    const error = new Error(`Unknown provider "${input.providerKey}"`);
    error.status = 404;
    throw error;
  }

  const tenantId = input.tenantId || null;
  const existing = await prisma.providerCredential.findFirst({
    where: { tenantId, providerId: provider.id, scope: input.scope },
  });

  const data = {
    tenantId,
    providerId: provider.id,
    scope: input.scope,
    externalAccountId: input.externalAccountId ?? existing?.externalAccountId ?? null,
    metadata: input.metadata ?? existing?.metadata ?? undefined,
  };

  if (input.secret) data.secretEnc = encrypt(String(input.secret).trim());
  if (input.authToken) data.authTokenEnc = encrypt(String(input.authToken).trim());

  if (existing) {
    return prisma.providerCredential.update({ where: { id: existing.id }, data });
  }
  return prisma.providerCredential.create({ data });
}

/**
 * @param {{ tenantId?: string|null, providerKey: string, scope: 'VOICE'|'MESSAGING'|'SIP' }} input
 * @param {{ reveal?: boolean }} [options]
 */
async function getCredential(input, options = {}) {
  const prisma = await getPrisma();
  const provider = await getProviderByKey(input.providerKey);
  if (!provider) return null;

  const row = await prisma.providerCredential.findFirst({
    where: { tenantId: input.tenantId || null, providerId: provider.id, scope: input.scope },
  });
  if (!row) return null;

  const secret = decrypt(row.secretEnc);
  const authToken = decrypt(row.authTokenEnc);

  return {
    id: row.id,
    tenantId: row.tenantId,
    providerKey: provider.key,
    scope: row.scope,
    externalAccountId: row.externalAccountId,
    metadata: row.metadata,
    secret: options.reveal ? secret : maskSecret(secret),
    authToken: options.reveal ? authToken : maskSecret(authToken),
    updatedAt: row.updatedAt,
  };
}

/**
 * @param {string} [providerKey]
 */
async function listCredentials(providerKey) {
  const prisma = await getPrisma();
  const where = {};
  if (providerKey) {
    const provider = await getProviderByKey(providerKey);
    where.providerId = provider?.id || '__none__';
  }
  const rows = await prisma.providerCredential.findMany({
    where,
    include: { provider: true },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    providerKey: row.provider.key,
    scope: row.scope,
    externalAccountId: row.externalAccountId,
    secret: maskSecret(decrypt(row.secretEnc)),
    authToken: maskSecret(decrypt(row.authTokenEnc)),
    updatedAt: row.updatedAt,
  }));
}

/**
 * @param {{ tenantId: string, providerKey: string, isPrimary?: boolean }} input
 */
async function setTenantProvider(input) {
  const prisma = await getPrisma();
  const provider = await getProviderByKey(input.providerKey);
  if (!provider) {
    const error = new Error(`Unknown provider "${input.providerKey}"`);
    error.status = 404;
    throw error;
  }

  const isPrimary = input.isPrimary !== false;

  const result = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.tenantProvider.updateMany({
        where: { tenantId: input.tenantId, NOT: { providerId: provider.id } },
        data: { isPrimary: false },
      });
    }

    return tx.tenantProvider.upsert({
      where: { tenantId_providerId: { tenantId: input.tenantId, providerId: provider.id } },
      update: { isPrimary, isActive: true },
      create: { tenantId: input.tenantId, providerId: provider.id, isPrimary, isActive: true },
    });
  });

  ProviderResolver.invalidateTenant(input.tenantId);
  return result;
}

/**
 * @param {string} tenantId
 */
async function getTenantProvider(tenantId) {
  const prisma = await getPrisma();
  const row = await prisma.tenantProvider.findFirst({
    where: { tenantId, isPrimary: true },
    include: { provider: true },
  });
  return row || null;
}

/**
 * @param {string} key
 */
async function setDefaultProvider(key) {
  const prisma = await getPrisma();
  const provider = await getProviderByKey(key);
  if (!provider) {
    const error = new Error(`Unknown provider "${key}"`);
    error.status = 404;
    throw error;
  }
  return prisma.platformSettings.update({
    where: { id: 'platform' },
    data: { defaultProviderId: provider.id },
  });
}

async function getDefaultProvider() {
  const prisma = await getPrisma();
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'platform' } });
  if (!settings?.defaultProviderId) return null;
  return prisma.provider.findUnique({ where: { id: settings.defaultProviderId } });
}

/**
 * Provider event/delivery log for the Super Admin "Provider Logs" panel.
 * Telnyx already has a dedup log (`ProcessedTelnyxEvent`); other providers
 * do not have a dedicated log table yet (deferred design decision, see
 * architecture plan Phase 5) — they return an empty list with an
 * explanatory `note` instead of erroring.
 * @param {string} providerKey
 * @param {number} [limit]
 */
async function getRecentEvents(providerKey, limit = 50) {
  const normalizedKey = String(providerKey || '').toLowerCase();
  if (normalizedKey === 'telnyx') {
    const prisma = await getPrisma();
    const rows = await prisma.processedTelnyxEvent.findMany({
      orderBy: { processedAt: 'desc' },
      take: limit,
    });
    return { events: rows, note: null };
  }
  return {
    events: [],
    note: `Event logging for "${providerKey}" is not yet implemented — deferred per Phase 5 design.`,
  };
}

module.exports = {
  listProviders,
  getProviderByKey,
  ensureProviderRow,
  setProviderActive,
  checkHealth,
  upsertCredential,
  getCredential,
  listCredentials,
  setTenantProvider,
  getTenantProvider,
  setDefaultProvider,
  getDefaultProvider,
  getRecentEvents,
  getRegisteredProviderKeys,
};
