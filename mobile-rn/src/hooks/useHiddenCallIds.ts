import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIDDEN_CALLS_KEY = 'vsp.hiddenCallIds';

export function useHiddenCallIds() {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(HIDDEN_CALLS_KEY).then((raw) => {
      if (raw) {
        try {
          setHiddenIds(new Set(JSON.parse(raw) as string[]));
        } catch {
          /* ignore corrupt storage */
        }
      }
      setHydrated(true);
    });
  }, []);

  const persistHidden = useCallback(async (next: Set<string>) => {
    setHiddenIds(next);
    await AsyncStorage.setItem(HIDDEN_CALLS_KEY, JSON.stringify([...next]));
  }, []);

  const hideCall = useCallback(
    (callId: string) => {
      const next = new Set(hiddenIds);
      next.add(callId);
      void persistHidden(next);
    },
    [hiddenIds, persistHidden],
  );

  const hideCalls = useCallback(
    (callIds: Iterable<string>) => {
      const next = new Set(hiddenIds);
      for (const id of callIds) next.add(id);
      void persistHidden(next);
    },
    [hiddenIds, persistHidden],
  );

  return { hiddenIds, hydrated, hideCall, hideCalls, persistHidden };
}
