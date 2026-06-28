type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const TELEMETRY_EVENTS = new Set([
  'push_registration_failed',
  'push_registration_success',
  'telnyx_registration_failed',
  'telnyx_registration_success',
  'messaging_sync_failed',
  'outbox_flush_failed',
  'uncaught_handler',
]);

type TelemetryPayload = {
  event: string;
  properties?: Record<string, unknown>;
};

let telemetrySink: ((payload: TelemetryPayload) => void) | null = null;

export function setTelemetrySink(sink: ((payload: TelemetryPayload) => void) | null) {
  telemetrySink = sink;
}

function isDev() {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
}

function emit(level: LogLevel, tag: string, message: string, data?: unknown) {
  const line = `[VSP:${tag}] ${message}`;
  if (isDev()) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (data !== undefined) fn(line, data);
    else fn(line);
    return;
  }
  if (level === 'error') {
    console.error(line);
  }
}

export const logger = {
  debug: (tag: string, message: string, data?: unknown) => emit('debug', tag, message, data),
  info: (tag: string, message: string, data?: unknown) => emit('info', tag, message, data),
  warn: (tag: string, message: string, data?: unknown) => emit('warn', tag, message, data),
  error: (tag: string, message: string, data?: unknown) => emit('error', tag, message, data),
  telemetry: (event: string, properties?: Record<string, unknown>) => {
    if (!TELEMETRY_EVENTS.has(event)) return;
    telemetrySink?.({ event, properties: sanitizeTelemetry(properties) });
  },
};

function sanitizeTelemetry(properties?: Record<string, unknown>) {
  if (!properties) return properties;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (/token|password|secret|authorization/i.test(key)) continue;
    if (typeof value === 'string' && value.length > 120) {
      safe[key] = `${value.slice(0, 8)}…`;
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number; label?: string },
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(options?.label || 'retry', `Attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
