import type { Call } from '@telnyx/react-voice-commons-sdk';
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';
import type { InboundCallerCallFields } from './inboundCallerDisplay';
import { normalizeDestination } from './dialNormalization';

export { normalizeDestination } from './dialNormalization';

export function mapTelnyxCallToInboundFields(call: Call): InboundCallerCallFields {
  const underlying = call.telnyxCall as unknown as {
    remotePartyNumber?: string;
    remotePartyName?: string;
    localPartyNumber?: string;
    direction?: string;
    options?: InboundCallerCallFields['options'];
  };

  return {
    direction: 'inbound',
    remotePartyNumber: underlying?.remotePartyNumber ?? call.callerNumber ?? call.destination,
    remotePartyName: underlying?.remotePartyName ?? call.callerName,
    localPartyNumber: underlying?.localPartyNumber,
    options: underlying?.options,
  };
}

export function isIncomingRinging(call: Call | null | undefined) {
  return Boolean(call?.isIncoming && call.currentState === TelnyxCallState.RINGING);
}

export function isActiveCallState(state: TelnyxCallState) {
  return state === TelnyxCallState.ACTIVE || state === TelnyxCallState.HELD;
}
