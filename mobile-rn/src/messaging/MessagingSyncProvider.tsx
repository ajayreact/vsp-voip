import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { InteractionManager, AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { fetchConversations } from '../messaging/messagingService';
import { mergeConversationListFromServer } from '../messaging/messagingQueryCache';
import { flushMessagingOutbox } from '../messaging/outboxFlush';
import { notifyNewMessages, updateBadgeCount } from '../notifications/messageNotifications';
import { useSettingsStore } from '../store/settingsStore';
import { logger } from '../lib/logger';
import { useAfterInteractions } from '../hooks/useAfterInteractions';
import { createAppStateAwareInterval } from '../lib/appStateSync';
import { SYNC_PROFILES } from '../lib/syncProfiles';

const SYNC_PROFILE = { foregroundMs: SYNC_PROFILES.messaging.foregroundMs, backgroundMs: SYNC_PROFILES.messaging.backgroundMs };
const OUTBOX_PROFILE = { foregroundMs: SYNC_PROFILES.messagingOutbox.foregroundMs, backgroundMs: SYNC_PROFILES.messagingOutbox.backgroundMs };

export function MessagingSyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnline = useAppStore((s) => s.isOnline);
  const messageAlerts = useSettingsStore((s) => s.notificationPrefs.messageAlerts);
  const unreadSnapshotRef = useRef<Map<string, number>>(new Map());
  const wasOnlineRef = useRef(isOnline);
  const interactionsReady = useAfterInteractions(isAuthenticated);

  useEffect(() => {
    const wasOffline = !wasOnlineRef.current && isOnline;
    wasOnlineRef.current = isOnline;
    if (wasOffline && isAuthenticated && interactionsReady) {
      void flushMessagingOutbox(queryClient);
    }
  }, [isOnline, isAuthenticated, interactionsReady, queryClient]);

  useEffect(() => {
    if (!interactionsReady || !isAuthenticated || !isOnline) return undefined;

    const bootstrap = InteractionManager.runAfterInteractions(() => {
      void flushMessagingOutbox(queryClient);
    });

    const stopOutbox = createAppStateAwareInterval(() => {
      void flushMessagingOutbox(queryClient);
    }, OUTBOX_PROFILE);

    return () => {
      bootstrap.cancel();
      stopOutbox();
    };
  }, [interactionsReady, isAuthenticated, isOnline, queryClient]);

  const syncConversations = useCallback(async () => {
    try {
      const res = await fetchConversations({ limit: 50 });
      mergeConversationListFromServer(queryClient, res.conversations);

      const unreadTotal = res.conversations.reduce((sum, item) => sum + item.unreadCount, 0);
      await updateBadgeCount(unreadTotal);

      if (!messageAlerts) return;

      const background = AppState.currentState !== 'active';
      if (!background) {
        for (const conv of res.conversations) {
          unreadSnapshotRef.current.set(conv.id, conv.unreadCount);
        }
        return;
      }

      const newlyUnread = res.conversations.filter((conv) => {
        const prev = unreadSnapshotRef.current.get(conv.id) ?? 0;
        return conv.unreadCount > prev;
      });

      for (const conv of res.conversations) {
        unreadSnapshotRef.current.set(conv.id, conv.unreadCount);
      }

      if (newlyUnread.length) {
        await notifyNewMessages(newlyUnread);
      }
    } catch (error) {
      logger.warn('messaging-sync', 'Background sync failed', error);
      logger.telemetry('messaging_sync_failed', {
        message: error instanceof Error ? error.message : 'sync failed',
      });
    }
  }, [messageAlerts, queryClient]);

  useEffect(() => {
    if (!interactionsReady || !isAuthenticated || !isOnline) return undefined;

    void syncConversations();
    return createAppStateAwareInterval(() => {
      void syncConversations();
    }, SYNC_PROFILE);
  }, [interactionsReady, isAuthenticated, isOnline, syncConversations]);

  return <>{children}</>;
}
