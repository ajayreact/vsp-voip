const gateway = require('./gateway');
const config = require('./config');
const errors = require('./errors');
const retry = require('./retry');
const redaction = require('./redaction');
const featureFlags = require('./featureFlags');
const promptManager = require('./promptManager');
const contextManager = require('./contextManager');
const costTracker = require('./costTracker');
const usageLogger = require('./usageLogger');
const tenantSettings = require('./tenantSettings');
const providerManager = require('./providerManager');
const healthMonitor = require('./healthMonitor');
const failover = require('./failover');
const providers = require('./providers');
const summaryModules = require('./modules');
const transcription = require('./transcription');
const assistant = require('./assistant');

module.exports = {
  ...gateway,
  ...config,
  ...errors,
  ...retry,
  ...redaction,
  ...featureFlags,
  ...promptManager,
  ...contextManager,
  ...costTracker,
  ...usageLogger,
  ...tenantSettings,
  ...providerManager,
  ...healthMonitor,
  ...failover,
  ...summaryModules,
  ...transcription,
  ...assistant,
  // Provider factory is internal — modules must use runCompletion/streamCompletion.
  createAiProvider: providers.createAiProvider,
};
