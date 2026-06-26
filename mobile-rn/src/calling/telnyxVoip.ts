import {
  createTelnyxVoipClient,
  type TelnyxVoipClient,
} from '@telnyx/react-voice-commons-sdk';

let client: TelnyxVoipClient | null = null;

export function getTelnyxVoipClient(): TelnyxVoipClient {
  if (!client) {
    client = createTelnyxVoipClient({
      enableAppStateManagement: true,
      debug: __DEV__,
    });
  }
  return client;
}
