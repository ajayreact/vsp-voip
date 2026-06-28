import {
  primeCallAudioForDial,
  startLocalRingback,
  stopLocalRingback,
} from '@/lib/call-sounds';
import type { TelephonySnapshot } from './types';
import { RINGBACK_PHASES } from './types';
import { getActiveLocalToneSourceForDiagnostics } from '@/lib/call-sounds';
import { logDiagnosticTimeline } from './logger';
import { summarizeSnapshot } from './diagnostics';

let audioPrimed = false;

export async function primeTelephonyAudio(
  remoteAudioEl: HTMLAudioElement | null,
): Promise<boolean> {
  if (audioPrimed) return true;
  const ok = await primeCallAudioForDial(remoteAudioEl);
  audioPrimed = ok;
  return ok;
}

export function resetAudioPrimedFlag() {
  audioPrimed = false;
}

export async function syncRingbackWithSnapshot(
  snapshot: TelephonySnapshot,
  call: { stopRingback?: () => void } | null,
) {
  const shouldPlay = RINGBACK_PHASES.has(snapshot.callPhase);

  logDiagnosticTimeline('ringback.sync', snapshot, {
    shouldPlay,
    callPhase: snapshot.callPhase,
    ringbackSource: getActiveLocalToneSourceForDiagnostics(),
    hasSdkStopRingback: Boolean(call?.stopRingback),
    snapshot: summarizeSnapshot(snapshot),
  });

  if (shouldPlay) {
    await startLocalRingback();
    return;
  }

  logDiagnosticTimeline('ringback.stop', snapshot, {
    callPhase: snapshot.callPhase,
    reason: 'phase_left_ringback',
    ringbackSource: getActiveLocalToneSourceForDiagnostics(),
  });
  call?.stopRingback?.();
  stopLocalRingback();
}

export function shouldPlayRingback(snapshot: TelephonySnapshot): boolean {
  return RINGBACK_PHASES.has(snapshot.callPhase);
}
