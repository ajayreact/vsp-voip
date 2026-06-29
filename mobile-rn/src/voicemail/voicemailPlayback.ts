import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { endpoints } from '../api/endpoints';
import { getCachedAccessToken } from '../auth/authService';
import { env } from '../shared/config/env';
import { useSettingsStore } from '../store/settingsStore';

function playbackRateFromPrefs(): number {
  const speed = useSettingsStore.getState().clientPrefs.voicemailPlaybackSpeed;
  return Number(speed) || 1;
}

export type VoicemailPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export type VoicemailPlaybackState = {
  voicemailId: string | null;
  status: VoicemailPlaybackStatus;
  positionMillis: number;
  durationMillis: number;
  error: string | null;
};

type Listener = (state: VoicemailPlaybackState) => void;

const INITIAL: VoicemailPlaybackState = {
  voicemailId: null,
  status: 'idle',
  positionMillis: 0,
  durationMillis: 0,
  error: null,
};

class VoicemailPlaybackManager {
  private player: AudioPlayer | null = null;

  private statusSubscription: { remove: () => void } | null = null;

  private state: VoicemailPlaybackState = { ...INITIAL };

  private listeners = new Set<Listener>();

  private fileCache = new Map<string, string>();

  private readonly maxFileCacheEntries = 5;

  private loadGeneration = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): VoicemailPlaybackState {
    return this.state;
  }

  private emit(patch: Partial<VoicemailPlaybackState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  private async resolveLocalUri(voicemailId: string): Promise<string> {
    const cached = this.fileCache.get(voicemailId);
    if (cached) {
      const info = await FileSystem.getInfoAsync(cached);
      if (info.exists) return cached;
      this.fileCache.delete(voicemailId);
    }

    const token = getCachedAccessToken();
    if (!token) throw new Error('Not authenticated');

    const remote = `${env.apiBaseUrl}${endpoints.voicemail.stream(voicemailId)}`;
    const dest = `${FileSystem.cacheDirectory ?? ''}vm-${voicemailId}.mp3`;
    const result = await FileSystem.downloadAsync(remote, dest, {
      headers: { Authorization: `Bearer ${token}` },
    });
    this.rememberCachedFile(voicemailId, result.uri);
    return result.uri;
  }

  private rememberCachedFile(voicemailId: string, uri: string) {
    if (this.fileCache.has(voicemailId)) {
      this.fileCache.delete(voicemailId);
    }
    this.fileCache.set(voicemailId, uri);
    while (this.fileCache.size > this.maxFileCacheEntries) {
      const oldest = this.fileCache.keys().next().value;
      if (!oldest) break;
      this.fileCache.delete(oldest);
    }
  }

  async clearFileCache(): Promise<void> {
    for (const uri of this.fileCache.values()) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        /* ignore cache cleanup errors */
      }
    }
    this.fileCache.clear();
  }

  private onStatusUpdate = (status: AudioStatus) => {
    if (!status.isLoaded) {
      return;
    }

    if (status.error) {
      this.emit({ status: 'error', error: status.error });
      return;
    }

    const positionMillis = Math.round((status.currentTime ?? 0) * 1000);
    const durationMillis = Math.round((status.duration ?? 0) * 1000);

    if (status.didJustFinish) {
      this.emit({ status: 'ended', positionMillis: 0, durationMillis });
      return;
    }

    this.emit({
      positionMillis,
      durationMillis,
      status: status.playing ? 'playing' : 'paused',
    });
  };

  private attachPlayer(player: AudioPlayer) {
    this.statusSubscription?.remove();
    this.statusSubscription = player.addListener('playbackStatusUpdate', this.onStatusUpdate);
    this.player = player;
  }

  async play(voicemailId: string): Promise<void> {
    const generation = ++this.loadGeneration;

    if (this.state.voicemailId === voicemailId && this.player) {
      if (this.state.status === 'paused' || this.state.status === 'ended') {
        this.player.play();
        this.emit({ status: 'playing', error: null });
        return;
      }
      if (this.state.status === 'playing') return;
    }

    await this.stopInternal(false);
    this.emit({
      voicemailId,
      status: 'loading',
      positionMillis: 0,
      durationMillis: 0,
      error: null,
    });

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
      });

      const uri = await this.resolveLocalUri(voicemailId);
      if (generation !== this.loadGeneration) return;

      const player = createAudioPlayer({ uri });
      if (generation !== this.loadGeneration) {
        player.remove();
        return;
      }

      this.attachPlayer(player);
      player.setPlaybackRate(playbackRateFromPrefs());
      player.play();
      this.emit({ status: 'playing' });
    } catch (error) {
      if (generation !== this.loadGeneration) return;
      this.emit({
        status: 'error',
        error: error instanceof Error ? error.message : 'Playback failed',
      });
    }
  }

  async pause(): Promise<void> {
    if (!this.player) return;
    this.player.pause();
    this.emit({ status: 'paused' });
  }

  async toggle(voicemailId: string): Promise<void> {
    if (this.state.voicemailId === voicemailId && this.state.status === 'playing') {
      await this.pause();
      return;
    }
    await this.play(voicemailId);
  }

  async seek(positionMillis: number): Promise<void> {
    if (!this.player) return;
    await this.player.seekTo(Math.max(0, positionMillis / 1000));
    this.emit({ positionMillis });
  }

  async stop(): Promise<void> {
    await this.stopInternal(true);
  }

  private async stopInternal(resetState: boolean) {
    this.loadGeneration += 1;
    this.statusSubscription?.remove();
    this.statusSubscription = null;
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        /* ignore release errors */
      }
      this.player = null;
    }
    if (resetState) {
      this.emit({ ...INITIAL });
    }
  }
}

export const voicemailPlaybackManager = new VoicemailPlaybackManager();
