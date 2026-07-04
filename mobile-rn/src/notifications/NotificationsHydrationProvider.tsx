import React, { useEffect } from 'react';
import { useNotificationsStore } from './notificationsStore';

/** Hydrates notification inbox — no Telnyx / phone SDK imports on cold start. */
export function NotificationsHydrationProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useNotificationsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
