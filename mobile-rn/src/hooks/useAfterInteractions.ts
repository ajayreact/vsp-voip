import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/** True once the JS thread has finished initial transitions / animations. */
export function useAfterInteractions(enabled = true): boolean {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    const handle = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });
    return () => handle.cancel();
  }, [enabled]);

  return ready;
}
