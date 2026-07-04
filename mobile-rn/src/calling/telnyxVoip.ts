import {
  createTelnyxVoipClient,
  type TelnyxVoipClient,
} from '@telnyx/react-voice-commons-sdk';
import { isMobileTraceEnabled } from './mobileInviteTrace';

let client: TelnyxVoipClient | null = null;

export function getTelnyxVoipClient(): TelnyxVoipClient {
  if (!client) {
    client = createTelnyxVoipClient({
      enableAppStateManagement: true,
      debug: __DEV__ || isMobileTraceEnabled(),
    });
  }
  return client;
}
