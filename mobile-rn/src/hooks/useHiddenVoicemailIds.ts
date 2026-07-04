import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIDDEN_VOICEMAILS_KEY = 'vsp.hiddenVoicemailIds';

export function useHiddenVoicemailIds() {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(HIDDEN_VOICEMAILS_KEY).then((raw) => {
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
    await AsyncStorage.setItem(HIDDEN_VOICEMAILS_KEY, JSON.stringify([...next]));
  }, []);

  const hideVoicemail = useCallback(
    (id: string) => {
      const next = new Set(hiddenIds);
      next.add(id);
      void persistHidden(next);
    },
    [hiddenIds, persistHidden],
  );

  return { hiddenIds, hydrated, hideVoicemail, persistHidden };
}
