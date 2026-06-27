import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { fetchConversations } from '../messaging/messagingService';
import { flushMessagingOutbox } from '../messaging/outboxFlush';
import { notifyNewMessages, updateBadgeCount } from '../notifications/messageNotifications';
import { useSettingsStore } from '../store/settingsStore';
import { logger } from '../lib/logger';
import { useAfterInteractions } from '../hooks/useAfterInteractions';

const SYNC_MS = 10_000;
const OUTBOX_FLUSH_MS = 15_000;

export function MessagingSyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnline = useAppStore((s) => s.isOnline);
  const messageAlerts = useSettingsStore((s) => s.notificationPrefs.messageAlerts);
  const unreadSnapshotRef = useRef<Map<string, number>>(new Map());
  const appStateRef = useRef(AppState.currentState);
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
    const sub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!interactionsReady || !isAuthenticated || !isOnline) return undefined;

    const bootstrap = InteractionManager.runAfterInteractions(() => {
      void flushMessagingOutbox(queryClient);
    });

    const timer = setInterval(() => {
      void flushMessagingOutbox(queryClient);
    }, OUTBOX_FLUSH_MS);

    return () => {
      bootstrap.cancel();
      clearInterval(timer);
    };
  }, [interactionsReady, isAuthenticated, isOnline, queryClient]);

  useEffect(() => {
    if (!interactionsReady || !isAuthenticated || !isOnline) return undefined;

    const timer = setInterval(() => {
      void (async () => {
        try {
          const res = await fetchConversations({ limit: 50 });
          void queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });

          const unreadTotal = res.conversations.reduce((sum, item) => sum + item.unreadCount, 0);
          await updateBadgeCount(unreadTotal);

          if (!messageAlerts) return;

          const background = appStateRef.current !== 'active';
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
      })();
    }, SYNC_MS);

    return () => clearInterval(timer);
  }, [interactionsReady, isAuthenticated, isOnline, messageAlerts, queryClient]);

  return <>{children}</>;
}
