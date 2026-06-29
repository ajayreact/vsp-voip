const gateway = require('./gateway');
const config = require('./config');
const errors = require('./errors');
const providerManager = require('./providerManager');
const transcriptStore = require('./transcriptStore');
const transcriptionQueue = require('./transcriptionQueue');
const transcriptionEngine = require('./transcriptionEngine');
const audioSource = require('./audioSource');
const costTracker = require('./costTracker');
const providers = require('./providers');

module.exports = {
  ...gateway,
  ...config,
  ...errors,
  ...providerManager,
  ...transcriptStore,
  ...transcriptionQueue,
  ...transcriptionEngine,
  ...audioSource,
  ...costTracker,
  createTranscriptionProvider: providers.createTranscriptionProvider,
};
