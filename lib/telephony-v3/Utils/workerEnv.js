const { GLOBAL_FLAGS } = require('../constants');

/** Env vars that must be set (value may be true or false) before the V3 worker starts. */
const REQUIRED_WORKER_ENV = [
  GLOBAL_FLAGS.TELEPHONY_V3_GLOBAL,
  GLOBAL_FLAGS.TELEPHONY_V3_INGRESS_ENABLED,
  GLOBAL_FLAGS.TELEPHONY_V3_CALLMANAGER_ENABLED,
  GLOBAL_FLAGS.TELEPHONY_V3_EXECUTOR_ENABLED,
  'DATABASE_URL',
  'REDIS_URL',
];

/**
 * Fail fast when required worker configuration is missing.
 * @param {{ skip?: boolean }} [options]
 */
function validateWorkerEnv(options = {}) {
  if (options.skip || process.env.V3_WORKER_SKIP_ENV_VALIDATE === 'true') {
    return;
  }

  const errors = [];
  for (const name of REQUIRED_WORKER_ENV) {
    const value = process.env[name];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(`${name} is required`);
    }
  }

  if (errors.length) {
    throw new Error(
      'V3 worker environment validation failed:\n' +
        errors.map((entry) => `  - ${entry}`).join('\n') +
        '\nSet all TELEPHONY_V3_* flags and DATABASE_URL / REDIS_URL before starting telephony-v3-worker.',
    );
  }
}

module.exports = { validateWorkerEnv, REQUIRED_WORKER_ENV };
