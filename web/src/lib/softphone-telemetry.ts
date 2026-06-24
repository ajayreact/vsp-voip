import { postSoftphoneTelemetry } from '@/lib/api';

export type SoftphoneTelemetryEvent =
  | 'Call Started'
  | 'Call Connected'
  | 'Call Failed'
  | 'Call Ended'
  | 'Voicemail Played'
  | 'Recording Played'
  | 'Reconnect Attempt'
  | 'Registration Success'
  | 'Registration Failed'
  | 'Registration Restored';

export type SoftphoneTelemetrySnapshot = {
  event: SoftphoneTelemetryEvent;
  at: string;
};

let lastTelemetryEvent: SoftphoneTelemetrySnapshot | null = null;
const telemetryListeners = new Set<(snapshot: SoftphoneTelemetrySnapshot) => void>();

export function getLastSoftphoneTelemetryEvent() {
  return lastTelemetryEvent;
}

export function subscribeSoftphoneTelemetry(
  listener: (snapshot: SoftphoneTelemetrySnapshot) => void,
) {
  telemetryListeners.add(listener);
  if (lastTelemetryEvent) {
    listener(lastTelemetryEvent);
  }
  return () => {
    telemetryListeners.delete(listener);
  };
}

export function trackSoftphoneEvent(
  event: SoftphoneTelemetryEvent,
  properties?: Record<string, unknown>,
) {
  const at = new Date().toISOString();
  const payload = {
    event,
    properties: {
      source: 'softphone-v2',
      at,
      ...properties,
    },
  };

  lastTelemetryEvent = { event, at };
  telemetryListeners.forEach((listener) => {
    listener(lastTelemetryEvent!);
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('[softphone-telemetry]', payload);
  }

  void postSoftphoneTelemetry(payload).catch(() => {
    /* telemetry must not break the softphone */
  });
}
