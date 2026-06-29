import { vi } from 'vitest';

export const Audio = {
  Sound: {
    createAsync: vi.fn(async () => ({
      sound: {
        playAsync: vi.fn(),
        pauseAsync: vi.fn(),
        stopAsync: vi.fn(),
        unloadAsync: vi.fn(),
        setPositionAsync: vi.fn(),
      },
    })),
  },
  setAudioModeAsync: vi.fn(),
};

export type AVPlaybackStatus = {
  isLoaded: boolean;
  isPlaying?: boolean;
  positionMillis?: number;
  durationMillis?: number;
  didJustFinish?: boolean;
};
