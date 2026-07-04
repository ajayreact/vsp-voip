const { getAiConfig, validateProviderConfiguration, SUPPORTED_PROVIDERS } = require('./config');
const { createAiProvider } = require('./providers');
const { getHealthSnapshot, recordProviderSuccess, recordProviderFailure } = require('./healthMonitor');
const { getFailoverChain } = require('./failover');

class ProviderManager {
  constructor() {
    this.initialized = false;
    this.providers = new Map();
  }

  initialize() {
    if (this.initialized) return;
    for (const name of SUPPORTED_PROVIDERS) {
      this.providers.set(name, createAiProvider(name));
    }
    this.initialized = true;
  }

  validateConfiguration(providerName) {
    return validateProviderConfiguration(providerName);
  }

  getProvider(providerName) {
    this.initialize();
    const name = (providerName || getAiConfig().provider || 'noop').toLowerCase();
    if (!this.providers.has(name)) {
      this.providers.set(name, createAiProvider(name));
    }
    return this.providers.get(name);
  }

  listProviders() {
    this.initialize();
    return [...this.providers.keys()];
  }

  async healthCheck(providerName) {
    const name = (providerName || getAiConfig().provider || 'noop').toLowerCase();
    const configStatus = this.validateConfiguration(name);

    if (name === 'noop') {
      recordProviderSuccess(name, 0);
      return getHealthSnapshot(name);
    }

    if (!configStatus.valid) {
      recordProviderFailure(name, { code: 'AI_CONFIG_INVALID' });
      return getHealthSnapshot(name);
    }

    try {
      const provider = this.getProvider(name);
      const started = Date.now();
      await provider.complete({
        model: getAiConfig().defaultModel,
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 1,
      });
      recordProviderSuccess(name, Date.now() - started);
    } catch (error) {
      recordProviderFailure(name, error);
    }

    return getHealthSnapshot(name);
  }

  getFailoverChain(primaryProvider) {
    return getFailoverChain(primaryProvider);
  }
}

const providerManager = new ProviderManager();

module.exports = {
  ProviderManager,
  providerManager,
};
