import type { TelephonySnapshot } from './types';
import { RINGBACK_PHASES } from './types';
import { getActiveLocalToneSourceForDiagnostics } from '@/lib/call-sounds';

let sequence = 0;

export function nextDiagnosticSequence(): number {
  sequence += 1;
  return sequence;
}

export function deriveCallAnswered(snapshot: TelephonySnapshot): boolean {
  return snapshot.callPhase === 'connected'
    || snapshot.callPhase === 'hold'
    || snapshot.callPhase === 'recording';
}

export function summarizeSnapshot(snapshot: TelephonySnapshot) {
  const session = snapshot.session;
  return {
    seq: nextDiagnosticSequence(),
    callPhase: snapshot.callPhase,
    connection: snapshot.connection,
    connectedAt: session?.connectedAt ?? null,
    durationSeconds: session?.durationSeconds ?? 0,
    remoteRingSeen: session?.remoteRingSeen ?? false,
    activeTransitionCount: session?.activeTransitionCount ?? 0,
    callAnswered: deriveCallAnswered(snapshot),
    callId: session?.callId ?? null,
    callControlId: session?.callControlId ?? null,
    kind: session?.kind ?? null,
    direction: session?.direction ?? null,
    ringbackActive: RINGBACK_PHASES.has(snapshot.callPhase),
    ringbackSource: getActiveLocalToneSourceForDiagnostics(),
  };
}

export function classifyAnswerConfirmReason(source: string): string {
  if (source.includes('deferred')) return 'deferred';
  if (source.includes('pstn')) return 'pstn_confirmed';
  if (source.includes('inbound_user')) return 'inbound_user_answer';
  if (source.includes('early') || source === 'pstn_deferred') return 'early_media';
  return source;
}
