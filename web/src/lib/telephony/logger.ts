import type { TelephonySnapshot } from './types';

export type TelephonyLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type TelephonyLogEntry = {
  at: string;
  level: TelephonyLogLevel;
  event: string;
  callId?: string;
  callControlId?: string;
  extension?: string;
  destination?: string;
  fromPhase?: string;
  toPhase?: string;
  connection?: string;
  reason?: string;
  durationSeconds?: number;
  detail?: Record<string, unknown>;
};

const LOG_PREFIX = '[vsp-telephony]';

let logSink: ((entry: TelephonyLogEntry) => void) | null = null;

export function setTelephonyLogSink(sink: ((entry: TelephonyLogEntry) => void) | null) {
  logSink = sink;
}

export function logTelephony(
  level: TelephonyLogLevel,
  event: string,
  snapshot: Partial<TelephonySnapshot> & { detail?: Record<string, unknown> } = {},
) {
  const entry: TelephonyLogEntry = {
    at: new Date().toISOString(),
    level,
    event,
    callId: snapshot.session?.callId,
    callControlId: snapshot.session?.callControlId ?? snapshot.pendingInternal?.callControlId ?? undefined,
    extension: snapshot.pendingInternal?.targetNumber,
    destination: snapshot.session?.remoteLabel,
    fromPhase: snapshot.detail?.fromPhase as string | undefined,
    toPhase: snapshot.detail?.toPhase as string | undefined,
    connection: snapshot.connection,
    reason: snapshot.lastTransitionReason,
    durationSeconds: snapshot.session?.durationSeconds,
    detail: snapshot.detail,
  };

  const line = `${LOG_PREFIX} ${entry.event}`;
  if (level === 'error') console.error(line, entry);
  else if (level === 'warn') console.warn(line, entry);
  else console.log(line, entry);

  logSink?.(entry);
}

export function logTransition(
  snapshot: TelephonySnapshot,
  fromPhase: string,
  toPhase: string,
  reason: string,
  detail?: Record<string, unknown>,
) {
  logTelephony('info', 'state.transition', {
    ...snapshot,
    lastTransitionReason: reason,
    detail: { fromPhase, toPhase, reducer: 'withPhase', ...detail },
  });
}

/** Temporary Bug #7 QA — correlate browser timeline entries. */
export function logDiagnosticTimeline(
  event: string,
  snapshot: Partial<TelephonySnapshot> = {},
  detail: Record<string, unknown> = {},
) {
  logTelephony('info', event, { ...snapshot, detail });
}
