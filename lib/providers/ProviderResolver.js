/**
 * ProviderResolver — maps a tenantId to the telephony provider that should
 * handle its traffic (VSP Phone V3 Multi-Provider Architecture, Phase 3).
 *
 * Default-to-Telnyx guarantee: `resolve()` returns the `telnyx` provider
 * for every tenant that has no `TenantProvider` row (i.e. every tenant that
 * existed before this initiative), and also on any lookup/DB error — this
 * is what makes wiring `telephony-v3`'s executor through this resolver
 * behavior-neutral for 100% of current traffic.
 */

const DEFAULT_PROVIDER_KEY = 'telnyx';
const CACHE_TTL_MS = 30_000;

/** @type {(() => Promise<import('@prisma/client').PrismaClient>) | null} */
let getPrismaImpl = null;

function getPrisma() {
  if (!getPrismaImpl) {
    getPrismaImpl = require('../../db').getPrisma;
  }
  return getPrismaImpl();
}

/** @param {() => Promise<import('@prisma/client').PrismaClient>} fn */
function __setGetPrismaForTests(fn) {
  getPrismaImpl = fn;
}

function __resetGetPrismaForTests() {
  getPrismaImpl = null;
}

/** @type {Map<string, { key: string, expiresAt: number }>} */
const cache = new Map();

/**
 * @param {string|null|undefined} tenantId
 * @returns {Promise<string>} provider key, e.g. "telnyx" | "twilio"
 */
async function resolveProviderKey(tenantId) {
  if (!tenantId) {
    return DEFAULT_PROVIDER_KEY;
  }

  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  try {
    const prisma = await getPrisma();
    const row = await prisma.tenantProvider.findFirst({
      where: { tenantId, isActive: true, isPrimary: true },
      include: { provider: true },
    });

    const key = row?.provider?.isActive ? row.provider.key : DEFAULT_PROVIDER_KEY;
    cache.set(tenantId, { key, expiresAt: Date.now() + CACHE_TTL_MS });
    return key;
  } catch (error) {
    // Fail open to Telnyx so a provider-table outage never breaks live calls.
    // Logged (not thrown) so a Twilio/provider-table problem is visible to
    // ops without ever interrupting Telnyx traffic for this tenant.
    try {
      require('../logger').logger.warn('provider.resolve_failed_open_to_telnyx', {
        tenantId,
        error: error.message,
      });
    } catch { /* logging must never break resolution */ }
    return DEFAULT_PROVIDER_KEY;
  }
}

/**
 * @param {string|null|undefined} tenantId
 * @returns {Promise<import('./ProviderInterface').ProviderInterface>}
 */
async function resolve(tenantId) {
  const { createProvider } = require('./ProviderFactory');
  const key = await resolveProviderKey(tenantId);
  try {
    return createProvider(key);
  } catch (error) {
    // Unknown/misconfigured provider key on the tenant row — fail open to Telnyx.
    if (key !== DEFAULT_PROVIDER_KEY) {
      try {
        require('../logger').logger.error('provider.instantiate_failed_open_to_telnyx', {
          tenantId,
          providerKey: key,
          error: error.message,
        });
      } catch { /* logging must never break resolution */ }
    }
    return createProvider(DEFAULT_PROVIDER_KEY);
  }
}

/**
 * @param {string} tenantId
 */
function invalidateTenant(tenantId) {
  cache.delete(tenantId);
}

function invalidateAll() {
  cache.clear();
}

module.exports = {
  DEFAULT_PROVIDER_KEY,
  resolve,
  resolveProviderKey,
  invalidateTenant,
  invalidateAll,
  __setGetPrismaForTests,
  __resetGetPrismaForTests,
};
