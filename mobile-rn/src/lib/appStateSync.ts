import { AppState, type AppStateStatus } from 'react-native';

export type SyncIntervalProfile = {
  foregroundMs: number;
  backgroundMs: number;
};

/** Runs `tick` on an interval that slows when the app is backgrounded to save battery. */
export function createAppStateAwareInterval(
  tick: () => void,
  profile: SyncIntervalProfile,
): () => void {
  let appState: AppStateStatus = AppState.currentState;
  let timer: ReturnType<typeof setInterval> | null = null;

  const intervalMs = () => (appState === 'active' ? profile.foregroundMs : profile.backgroundMs);

  const restart = () => {
    if (timer) clearInterval(timer);
    timer = setInterval(tick, intervalMs());
  };

  restart();

  const subscription = AppState.addEventListener('change', (next) => {
    if (next === appState) return;
    appState = next;
    restart();
  });

  return () => {
    subscription.remove();
    if (timer) clearInterval(timer);
  };
}
