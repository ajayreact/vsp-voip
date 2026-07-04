import React, { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { fetchVoicemails } from '../voicemail/voicemailService';
import { mergeVoicemailListFromServer } from '../voicemail/voicemailQueryCache';
import { notifyNewVoicemail } from '../notifications/appNotifications';
import { useSettingsStore } from '../store/settingsStore';
import { useAfterInteractions } from '../hooks/useAfterInteractions';
import { logger } from '../lib/logger';
import { createAppStateAwareInterval } from '../lib/appStateSync';
import { SYNC_PROFILES } from '../lib/syncProfiles';

const SYNC_PROFILE = { foregroundMs: SYNC_PROFILES.voicemail.foregroundMs, backgroundMs: SYNC_PROFILES.voicemail.backgroundMs };

export function VoicemailSyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnline = useAppStore((s) => s.isOnline);
  const voicemailAlerts = useSettingsStore((s) => s.notificationPrefs.voicemailAlerts);
  const unreadSnapshotRef = useRef<Set<string>>(new Set());
  const interactionsReady = useAfterInteractions(isAuthenticated);

  const syncVoicemail = useCallback(async () => {
    try {
      const list = await fetchVoicemails();
      mergeVoicemailListFromServer(queryClient, list);

      const unread = list.filter((item) => !item.isRead);
      const background = AppState.currentState !== 'active';

      if (!voicemailAlerts || !background) {
        unreadSnapshotRef.current = new Set(unread.map((item) => item.id));
        return;
      }

      for (const vm of unread) {
        if (!unreadSnapshotRef.current.has(vm.id)) {
          await notifyNewVoicemail(vm);
        }
      }
      unreadSnapshotRef.current = new Set(unread.map((item) => item.id));
    } catch (error) {
      logger.warn('voicemail', 'Background sync failed', error);
    }
  }, [queryClient, voicemailAlerts]);

  useEffect(() => {
    if (!interactionsReady || !isAuthenticated || !isOnline) return undefined;

    void syncVoicemail();
    return createAppStateAwareInterval(() => {
      void syncVoicemail();
    }, SYNC_PROFILE);
  }, [interactionsReady, isAuthenticated, isOnline, syncVoicemail]);

  return <>{children}</>;
}
