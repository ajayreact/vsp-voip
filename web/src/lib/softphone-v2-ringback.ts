import { playOutboundRingback, stopLocalRingback } from '@/lib/call-sounds';

const OUTBOUND_RINGBACK_STATES = new Set(['requesting', 'trying', 'ringing']);
const RINGBACK_STOP_STATES = new Set(['active', 'hangup', 'destroy', 'error']);

export function isOutboundRingbackState(state: string) {
  return OUTBOUND_RINGBACK_STATES.has(state);
}

export function shouldStopOutboundRingback(state: string) {
  return RINGBACK_STOP_STATES.has(state);
}

export async function syncOutboundRingback(
  call: { playRingback?: () => void; stopRingback?: () => void } | null,
  callDirection: 'inbound' | 'outbound' | '',
  callState: string,
) {
  if (callDirection === 'outbound' && call && isOutboundRingbackState(callState)) {
    await playOutboundRingback(call);
    return;
  }

  if (call && shouldStopOutboundRingback(callState)) {
    call.stopRingback?.();
  }
  stopLocalRingback();
}

export function stopOutboundRingback(
  call: { stopRingback?: () => void } | null = null,
) {
  call?.stopRingback?.();
  stopLocalRingback();
}
