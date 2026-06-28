import { playOutboundRingback, startLocalRingback, stopLocalRingback } from '@/lib/call-sounds';
import { logDiagnosticTimeline } from '@/lib/telephony/logger';
import {
  shouldPlayOutboundRingback,
  shouldStopOutboundRingback,
} from '@/lib/softphone-outbound-answer';

/** Start ringback synchronously inside the dial click handler (user gesture). */
export async function startOutboundRingbackOnDial() {
  await startLocalRingback();
}

export async function syncOutboundRingback(
  call: { playRingback?: () => void; stopRingback?: () => void } | null,
  callDirection: 'inbound' | 'outbound' | '',
  callState: string,
  callAnswered: boolean,
) {
  if (shouldPlayOutboundRingback(callDirection, callAnswered, callState)) {
    await playOutboundRingback(call ?? {});
    return;
  }

  if (call && shouldStopOutboundRingback(callState, callAnswered)) {
    call.stopRingback?.();
  }
  stopLocalRingback();
}

export function stopOutboundRingback(
  call: { stopRingback?: () => void } | null = null,
) {
  logDiagnosticTimeline('ringback.stopOutboundRingback', {}, {
    hasSdkStopRingback: Boolean(call?.stopRingback),
    source: 'softphone-v2-ringback',
  });
  call?.stopRingback?.();
  stopLocalRingback();
}
