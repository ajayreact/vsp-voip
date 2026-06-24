export const SOFTPHONE_RECONNECT_INITIAL_DELAY_MS = 1500;
export const SOFTPHONE_RECONNECT_MAX_DELAY_MS = 60_000;
export const SOFTPHONE_RECONNECT_BACKOFF_MULTIPLIER = 2;

export type TelnyxReconnectController = {
  schedule: () => void;
  cancel: () => void;
  reset: () => void;
  getAttempt: () => number;
};

export function createTelnyxReconnectController(options: {
  connect: () => void;
  shouldAbort: () => boolean;
  onAttempt?: (attempt: number, delayMs: number) => void;
}): TelnyxReconnectController {
  let attempt = 0;
  let timerId: number | null = null;

  const cancel = () => {
    if (timerId != null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  };

  const reset = () => {
    attempt = 0;
    cancel();
  };

  const schedule = () => {
    cancel();
    attempt += 1;
    const delayMs = Math.min(
      SOFTPHONE_RECONNECT_INITIAL_DELAY_MS * SOFTPHONE_RECONNECT_BACKOFF_MULTIPLIER ** (attempt - 1),
      SOFTPHONE_RECONNECT_MAX_DELAY_MS,
    );
    options.onAttempt?.(attempt, delayMs);
    timerId = window.setTimeout(() => {
      timerId = null;
      if (options.shouldAbort()) return;
      options.connect();
    }, delayMs);
  };

  return {
    schedule,
    cancel,
    reset,
    getAttempt: () => attempt,
  };
}

export function formatTelnyxErrorMessage(event: unknown) {
  if (!event || typeof event !== 'object') return 'Softphone connection failed';
  const payload = event as {
    error?: { message?: string; description?: string; name?: string };
    message?: string;
  };
  if (payload.error?.message) return payload.error.message;
  if (payload.error?.description) return payload.error.description;
  if (payload.error?.name) return payload.error.name;
  if (typeof payload.message === 'string') return payload.message;
  return 'Softphone connection failed';
}
