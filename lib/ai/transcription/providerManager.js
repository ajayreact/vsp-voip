const { SUPPORTED_STT_PROVIDERS, getTranscriptionConfig, validateSttProviderConfiguration } = require('./config');
const { createTranscriptionProvider } = require('./providers');

class TranscriptionProviderManager {
  constructor() {
    this.instances = new Map();
  }

  listProviders() {
    return SUPPORTED_STT_PROVIDERS;
  }

  getProvider(name) {
    const providerName = (name || getTranscriptionConfig().provider || 'noop').toLowerCase();
    if (!this.instances.has(providerName)) {
      this.instances.set(providerName, createTranscriptionProvider(providerName));
    }
    return this.instances.get(providerName);
  }

  validateConfiguration(providerName) {
    return validateSttProviderConfiguration(providerName);
  }

  resetForTests() {
    this.instances.clear();
  }
}

const transcriptionProviderManager = new TranscriptionProviderManager();

module.exports = {
  TranscriptionProviderManager,
  transcriptionProviderManager,
};
