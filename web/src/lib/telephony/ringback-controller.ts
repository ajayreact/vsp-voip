import {
  primeCallAudioForDial,
  startLocalRingback,
  stopLocalRingback,
} from '@/lib/call-sounds';
import type { TelephonySnapshot } from './types';
import { RINGBACK_PHASES } from './types';
import { logTelephony } from './logger';

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

  if (shouldPlay) {
    logTelephony('debug', 'ringback.start', snapshot);
    await startLocalRingback();
    return;
  }

  logTelephony('debug', 'ringback.stop', snapshot);
  call?.stopRingback?.();
  stopLocalRingback();
}

export function shouldPlayRingback(snapshot: TelephonySnapshot): boolean {
  return RINGBACK_PHASES.has(snapshot.callPhase);
}
