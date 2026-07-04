import { queryClient } from './queryClient';
import { clearAllContactCaches } from '../contacts/contactCache';
import { clearStoredSipProfile } from '../sip/storage';
import { useNotificationsStore } from '../notifications/notificationsStore';
import { useCustomerContactsStore } from '../contacts/customerContactsStore';
import { voicemailPlaybackManager } from '../voicemail/voicemailPlayback';

/** Clears in-memory and persisted caches that must not persist across sessions. */
export async function clearClientSessionCaches(): Promise<void> {
  queryClient.clear();
  useNotificationsStore.getState().clearAll();
  useCustomerContactsStore.setState({ items: [], hydrated: false });
  await Promise.all([
    clearAllContactCaches(),
    clearStoredSipProfile(),
    voicemailPlaybackManager.stop(),
    voicemailPlaybackManager.clearFileCache(),
  ]);
}
