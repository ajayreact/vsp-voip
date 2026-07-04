import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const appStateListeners: Array<(state: string) => void> = [];

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, handler: (state: string) => void) => {
      appStateListeners.push(handler);
      return { remove: vi.fn() };
    },
  },
}));

import { createAppStateAwareInterval } from '../../mobile-rn/src/lib/appStateSync';

describe('createAppStateAwareInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    appStateListeners.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses foreground interval when app is active', () => {
    const tick = vi.fn();
    const stop = createAppStateAwareInterval(tick, { foregroundMs: 1000, backgroundMs: 5000 });

    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(1);

    stop();
  });

  it('switches to background interval after app state change', () => {
    const tick = vi.fn();
    const stop = createAppStateAwareInterval(tick, { foregroundMs: 1000, backgroundMs: 5000 });
    tick.mockClear();

    for (const handler of appStateListeners) {
      handler('background');
    }
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(1);

    stop();
  });
});
