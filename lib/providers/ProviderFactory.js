/**
 * ProviderFactory — instantiates and caches provider singletons by key
 * (VSP Phone V3 Multi-Provider Architecture, Phase 3).
 *
 * Providers are lazily `require()`d so that a provider with missing/invalid
 * configuration (e.g. Twilio credentials not yet set up) never breaks
 * startup for tenants still on Telnyx.
 */

/** @type {Record<string, () => import('./ProviderInterface').ProviderInterface>} */
const LOADERS = {
  telnyx: () => require('./TelnyxProvider'),
  twilio: () => require('./TwilioProvider'),
};

/** @type {Map<string, import('./ProviderInterface').ProviderInterface>} */
const instances = new Map();

/**
 * @returns {string[]} All provider keys this factory knows how to build.
 */
function getRegisteredProviderKeys() {
  return Object.keys(LOADERS);
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isRegisteredProvider(key) {
  return Object.prototype.hasOwnProperty.call(LOADERS, String(key || '').toLowerCase());
}

/**
 * @param {string} key e.g. "telnyx" | "twilio"
 * @returns {import('./ProviderInterface').ProviderInterface}
 */
function createProvider(key) {
  const normalizedKey = String(key || '').toLowerCase();

  if (instances.has(normalizedKey)) {
    return instances.get(normalizedKey);
  }

  const loader = LOADERS[normalizedKey];
  if (!loader) {
    const error = new Error(`Unknown telephony provider "${key}"`);
    error.status = 400;
    error.code = 'PROVIDER_NOT_FOUND';
    throw error;
  }

  const providerModule = loader();
  const instance = providerModule.instance || providerModule;
  instances.set(normalizedKey, instance);
  return instance;
}

/** Test-only: clear cached provider singletons. */
function __resetProviderCacheForTests() {
  instances.clear();
}

module.exports = {
  createProvider,
  isRegisteredProvider,
  getRegisteredProviderKeys,
  __resetProviderCacheForTests,
};
