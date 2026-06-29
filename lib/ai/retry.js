const { getAiConfig } = require('./config');
const { isRetryableAiError } = require('./errors');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries async AI provider calls with exponential backoff.
 * Never used on telephony or messaging critical paths.
 */
async function withAiRetry(fn, options = {}) {
  const config = getAiConfig();
  const attempts = options.attempts ?? config.maxRetries + 1;
  const baseDelayMs = options.baseDelayMs ?? config.retryBaseDelayMs;

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const retryable = options.shouldRetry ? options.shouldRetry(error, attempt) : isRetryableAiError(error);
      if (!retryable || attempt >= attempts) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
  throw lastError;
}

module.exports = {
  withAiRetry,
  sleep,
};
