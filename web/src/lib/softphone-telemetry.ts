import { postSoftphoneTelemetry } from '@/lib/api';

export type SoftphoneTelemetryEvent =
  | 'Call Started'
  | 'Call Connected'
  | 'Call Failed'
  | 'Call Ended'
  | 'Voicemail Played'
  | 'Recording Played';

export function trackSoftphoneEvent(
  event: SoftphoneTelemetryEvent,
  properties?: Record<string, unknown>,
) {
  const payload = {
    event,
    properties: {
      source: 'softphone-v2',
      at: new Date().toISOString(),
      ...properties,
    },
  };

  if (process.env.NODE_ENV !== 'production') {
    console.log('[softphone-telemetry]', payload);
  }

  void postSoftphoneTelemetry(payload).catch(() => {
    /* telemetry must not break the softphone */
  });
}
