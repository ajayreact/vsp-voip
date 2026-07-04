/**
 * Provider failover framework — disabled by default.
 * When enabled, gateway walks the chain on provider timeout/errors.
 */

const { getAiConfig } = require('./config');

function getFailoverChain(primaryProvider, options = {}) {
  const config = getAiConfig();
  const enabled = options.enabled ?? config.failoverEnabled;
  const primary = (primaryProvider || config.provider || 'noop').toLowerCase();

  if (!enabled) {
    return [primary];
  }

  const configured = config.failoverChain.length
    ? config.failoverChain
    : ['gemini', 'openai', 'noop'];

  const chain = [primary];
  for (const candidate of configured) {
    if (!chain.includes(candidate)) chain.push(candidate);
  }
  if (!chain.includes('noop')) chain.push('noop');

  return chain;
}

function shouldFailover(error) {
  if (!error) return false;
  const status = error.status || 0;
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

module.exports = {
  getFailoverChain,
  shouldFailover,
};
