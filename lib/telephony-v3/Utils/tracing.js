const crypto = require('crypto');

let tracer = null;

function getTracer() {
  if (tracer !== null) return tracer;
  if (process.env.OTEL_ENABLED === 'true') {
    try {
      // Optional OpenTelemetry hook — loaded only when enabled in production.
      // eslint-disable-next-line global-require, import/no-unresolved
      const { trace } = require('@opentelemetry/api');
      tracer = trace.getTracer('vsp-telephony-v3');
      return tracer;
    } catch {
      tracer = false;
    }
  } else {
    tracer = false;
  }
  return tracer;
}

/**
 * @param {string} name
 * @param {Record<string, string>} [attributes]
 * @param {() => Promise<T>|T} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withSpan(name, attributes, fn) {
  const activeTracer = getTracer();
  if (!activeTracer) {
    return fn();
  }
  return activeTracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.end();
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      span.end();
      throw error;
    }
  });
}

function newTraceId() {
  return crypto.randomUUID().replace(/-/g, '');
}

module.exports = { withSpan, newTraceId, getTracer };
