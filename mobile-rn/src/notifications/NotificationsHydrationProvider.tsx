import React, { useEffect, useRef } from 'react';
import { usePhoneConnection } from '../hooks/usePhoneConnection';
import { notifyRegistrationWarning } from './appNotifications';
import { useNotificationsStore } from './notificationsStore';
import { useSettingsStore } from '../store/settingsStore';

export function NotificationsHydrationProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useNotificationsStore((s) => s.hydrate);
  const lastStatusRef = useRef<string | null>(null);
  const { status, label, hint } = usePhoneConnection();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (status === 'connected') {
      lastStatusRef.current = status;
      return;
    }
    if (lastStatusRef.current === status) return;
    lastStatusRef.current = status;

    const systemAlerts = useSettingsStore.getState().notificationPrefs.systemAlerts;
    if (!systemAlerts) return;

    if (status === 'auth_failed' || status === 'disconnected' || status === 'reconnecting') {
      notifyRegistrationWarning(hint ? `${label}. ${hint}` : label);
    }
  }, [hint, label, status]);

  return <>{children}</>;
}
