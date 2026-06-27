import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { logger, setTelemetrySink } from '../lib/logger';
import { postSoftphoneTelemetry } from '../calling/softphoneService';
import {
  registerPushWithBackend,
  subscribeAndroidTokenRefresh,
} from './pushTokenService';
import {
  clearPendingNativePushAction,
  getPendingNativePushAction,
} from './nativeBridge';
import {
  addNotificationResponseListener,
  handleNotificationAction,
  initializeMessageNotifications,
  requestNotificationPermissions,
} from './messageNotifications';
import { navigateToConversation } from '../navigation/navigationRef';

type Props = {
  children: React.ReactNode;
};

export function PushNotificationProvider({ children }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pushEnabled = useSettingsStore((s) => s.notificationPrefs.pushEnabled);

  useEffect(() => {
    setTelemetrySink(({ event, properties }) => {
      void postSoftphoneTelemetry(event, properties).catch(() => {});
    });
    return () => setTelemetrySink(null);
  }, []);

  useEffect(() => {
    void initializeMessageNotifications();
    const sub = addNotificationResponseListener((response) => {
      void handleNotificationAction(response);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !pushEnabled) return;

    let disposed = false;

    async function bootstrap() {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        logger.warn('push', 'Notification permission not granted');
        return;
      }
      if (disposed) return;

      const pending = await getPendingNativePushAction();
      if (pending?.metadata) {
        try {
          const metadata = JSON.parse(String(pending.metadata)) as {
            conversationId?: string;
            peer?: string;
            peerNumber?: string;
            line?: string;
          };
          if (metadata.conversationId) {
            navigateToConversation({
              conversationId: metadata.conversationId,
              peerLabel: metadata.peer || metadata.peerNumber || 'Message',
              peerNumber: metadata.peerNumber || metadata.peer,
              lineLabel: metadata.line,
            });
          }
        } catch {
          // ignore malformed metadata
        }
        await clearPendingNativePushAction();
      }

      await registerPushWithBackend();
    }

    void bootstrap();

    const unsubAndroid = subscribeAndroidTokenRefresh(() => {
      void registerPushWithBackend();
    });

    return () => {
      disposed = true;
      unsubAndroid();
    };
  }, [isAuthenticated, pushEnabled]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // Keep process alive awareness for battery diagnostics — no extra work in foreground.
    const sub = AppState.addEventListener('change', (state) => {
      logger.debug('lifecycle', `AppState → ${state}`);
    });
    return () => sub.remove();
  }, []);

  return <>{children}</>;
}
