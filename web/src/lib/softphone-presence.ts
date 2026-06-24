import { setSoftphonePresence } from '@/lib/api';

export const SOFTPHONE_PRESENCE_HEARTBEAT_MS = 30_000;

export type SoftphonePresenceStatus = 'pending' | 'online' | 'offline' | 'error';

export function markSoftphoneOnline() {
  return setSoftphonePresence(true);
}

export function markSoftphoneOffline() {
  return setSoftphonePresence(false);
}

export function startSoftphonePresenceHeartbeat(
  onOnline = markSoftphoneOnline,
  onStatusChange?: (status: SoftphonePresenceStatus) => void,
) {
  onStatusChange?.('pending');
  void onOnline()
    .then(() => onStatusChange?.('online'))
    .catch(() => onStatusChange?.('error'));

  const intervalId = window.setInterval(() => {
    void onOnline()
      .then(() => onStatusChange?.('online'))
      .catch(() => onStatusChange?.('error'));
  }, SOFTPHONE_PRESENCE_HEARTBEAT_MS);

  const markOffline = () => {
    onStatusChange?.('offline');
    void markSoftphoneOffline();
  };

  window.addEventListener('pagehide', markOffline);
  window.addEventListener('beforeunload', markOffline);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener('pagehide', markOffline);
    window.removeEventListener('beforeunload', markOffline);
    markOffline();
  };
}
