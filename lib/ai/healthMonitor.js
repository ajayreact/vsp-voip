/**
 * In-memory AI health state — updated by the gateway after each request.
 */

const { validateProviderConfiguration, getAiConfig } = require('./config');

const healthByProvider = new Map();

function defaultHealth(provider) {
  return {
    provider,
    healthy: provider === 'noop',
    lastSuccessAt: null,
    lastFailureAt: null,
    lastLatencyMs: null,
    lastErrorCode: null,
    requestCount: 0,
    failureCount: 0,
  };
}

function getProviderHealth(provider) {
  const name = (provider || getAiConfig().provider || 'noop').toLowerCase();
  if (!healthByProvider.has(name)) {
    healthByProvider.set(name, defaultHealth(name));
  }
  return healthByProvider.get(name);
}

function recordProviderSuccess(provider, latencyMs) {
  const state = getProviderHealth(provider);
  state.healthy = true;
  state.lastSuccessAt = new Date().toISOString();
  state.lastLatencyMs = latencyMs ?? null;
  state.lastErrorCode = null;
  state.requestCount += 1;
  return state;
}

function recordProviderFailure(provider, error) {
  const state = getProviderHealth(provider);
  state.healthy = false;
  state.lastFailureAt = new Date().toISOString();
  state.lastErrorCode = error?.code || 'AI_ERROR';
  state.requestCount += 1;
  state.failureCount += 1;
  return state;
}

function getHealthSnapshot(provider) {
  const configStatus = validateProviderConfiguration(provider);
  const runtime = getProviderHealth(provider);
  return {
    provider: runtime.provider,
    healthy: configStatus.valid && runtime.healthy,
    configurationStatus: configStatus.valid ? 'valid' : 'missing_credentials',
    missingConfiguration: configStatus.missing,
    responseLatencyMs: runtime.lastLatencyMs,
    lastSuccessfulRequest: runtime.lastSuccessAt,
    lastFailure: runtime.lastFailureAt,
    lastErrorCode: runtime.lastErrorCode,
    providerVersion: getAiConfig().providerVersion,
    requestCount: runtime.requestCount,
    failureCount: runtime.failureCount,
  };
}

function resetHealthState() {
  healthByProvider.clear();
}

module.exports = {
  getProviderHealth,
  recordProviderSuccess,
  recordProviderFailure,
  getHealthSnapshot,
  resetHealthState,
};
