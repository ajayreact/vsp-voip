import { postSoftphonePresence } from './softphoneService';

export const SOFTPHONE_PRESENCE_HEARTBEAT_MS = 30_000;

let heartbeatId: ReturnType<typeof setInterval> | null = null;

async function markOnline() {
  await postSoftphonePresence(true);
}

async function markOffline() {
  try {
    await postSoftphonePresence(false);
  } catch {
    // Best-effort on teardown.
  }
}

export function startSoftphonePresenceHeartbeat() {
  stopSoftphonePresenceHeartbeat();
  void markOnline().catch(() => {});
  heartbeatId = setInterval(() => {
    void markOnline().catch(() => {});
  }, SOFTPHONE_PRESENCE_HEARTBEAT_MS);
}

export function stopSoftphonePresenceHeartbeat() {
  if (heartbeatId != null) {
    clearInterval(heartbeatId);
    heartbeatId = null;
  }
  void markOffline();
}
