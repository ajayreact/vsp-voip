import type { Call } from '@telnyx/webrtc';
import { isInboundCall } from '@/lib/softphone-call-utils';
import type { PendingInternalRequest } from './types';

const INTERNAL_BRIDGE_TIMEOUT_MS = 60_000;

export type BridgeLegEvaluation = {
  allowed: boolean;
  reason: string;
};

/**
 * Telnyx internal-api flow originates a Call Control leg TO the caller's WebRTC SIP URI.
 * That leg presents as an inbound INVITE on the dialing client — auto-answer only when
 * correlated to the user's pending extension dial request.
 */
export function evaluateInternalBridgeAutoAnswer(input: {
  pending: PendingInternalRequest | null;
  call: Call;
  hasLiveCall: boolean;
  now?: number;
}): BridgeLegEvaluation {
  const { pending, call, hasLiveCall, now = Date.now() } = input;

  if (!pending) {
    return { allowed: false, reason: 'no_pending_internal_request' };
  }

  if (hasLiveCall && pending.bridgeWebRtcCallId && pending.bridgeWebRtcCallId !== call.id) {
    return { allowed: false, reason: 'different_live_call' };
  }

  if (now - pending.startedAt > INTERNAL_BRIDGE_TIMEOUT_MS) {
    return { allowed: false, reason: 'pending_internal_expired' };
  }

  if (!isInboundCall(call)) {
    return { allowed: false, reason: 'not_inbound_bridge_leg' };
  }

  const extended = call as Call & {
    options?: { destinationNumber?: string; remoteCallerNumber?: string };
  };

  // CC bridge to agent WebRTC should not look like an outbound PSTN dial.
  if (extended.options?.destinationNumber) {
    return { allowed: false, reason: 'has_destination_number_not_bridge' };
  }

  return { allowed: true, reason: 'pending_internal_bridge_leg' };
}

export function createPendingInternalRequest(
  targetNumber: string,
  targetDisplayName: string,
): PendingInternalRequest {
  return {
    targetNumber,
    targetDisplayName,
    callControlId: null,
    bridgeWebRtcCallId: null,
    startedAt: Date.now(),
  };
}
