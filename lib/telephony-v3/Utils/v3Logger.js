const { log } = require('../../logger');

const SCHEMA = 'v3.log.v1';

/**
 * @param {string} level
 * @param {string} msg
 * @param {Record<string, unknown>} [fields]
 */
function write(level, msg, fields = {}) {
  log(level, msg, {
    schema: SCHEMA,
    ...fields,
  });
}

const v3Logger = {
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
  debug: (msg, fields) => {
    if (process.env.LOG_LEVEL === 'debug') write('debug', msg, fields);
  },
};

module.exports = { v3Logger, SCHEMA };
