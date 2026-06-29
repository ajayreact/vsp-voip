import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useAppStore } from '../store/appStore';

/** Keeps Zustand online state in sync with React Query's single NetInfo listener. */
export function useSyncAppOnline() {
  const setOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    void NetInfo.fetch().then((state) => {
      setOnline(state.isConnected !== false);
    });
    setOnline(onlineManager.isOnline());
    return onlineManager.subscribe((online) => {
      setOnline(online);
    });
  }, [setOnline]);
}
