import {
  fetchAuthenticatedAudioUrl,
  revokeAuthenticatedAudioUrl,
} from '@/lib/media-playback';

export type VoicemailPlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type VoicemailPlaybackState = {
  activePlayerId: string | null;
  streamPath: string | null;
  status: VoicemailPlaybackStatus;
  currentTime: number;
  duration: number;
  error: string | null;
};

type PlaybackListener = (state: VoicemailPlaybackState) => void;

type ToggleHooks = {
  onPlayStart?: () => void;
};

const INITIAL_STATE: VoicemailPlaybackState = {
  activePlayerId: null,
  streamPath: null,
  status: 'idle',
  currentTime: 0,
  duration: 0,
  error: null,
};

/**
 * Singleton voicemail playback controller.
 * Owns exactly one HTMLAudioElement for the entire application.
 */
class VoicemailPlaybackManager {
  private audio: HTMLAudioElement | null = null;

  private state: VoicemailPlaybackState = { ...INITIAL_STATE };

  private listeners = new Set<PlaybackListener>();

  private blobCache = new Map<string, string>();

  private loadGeneration = 0;

  private eventsAttached = false;

  /** @internal Test-only injection */
  setAudioElementForTests(element: HTMLAudioElement | null): void {
    this.audio = element;
    this.eventsAttached = false;
    if (element) {
      this.attachAudioEvents();
    }
  }

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) {
      if (typeof Audio === 'undefined') {
        throw new Error('Voicemail playback requires a browser Audio environment');
      }
      this.audio = new Audio();
      this.audio.preload = 'none';
    }
    if (!this.eventsAttached) {
      this.attachAudioEvents();
    }
    return this.audio;
  }

  private attachAudioEvents(): void {
    if (!this.audio || this.eventsAttached) return;
    const audio = this.audio;

    audio.addEventListener('timeupdate', () => {
      if (this.state.activePlayerId) {
        this.patch({ currentTime: audio.currentTime });
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration) && this.state.activePlayerId) {
        this.patch({ duration: audio.duration });
      }
    });

    audio.addEventListener('playing', () => {
      if (this.state.activePlayerId) {
        this.patch({ status: 'playing', error: null });
      }
    });

    audio.addEventListener('pause', () => {
      if (!this.state.activePlayerId || audio.ended) return;
      this.patch({ status: 'paused' });
    });

    audio.addEventListener('ended', () => {
      if (!this.state.activePlayerId) return;
      audio.currentTime = 0;
      this.patch({ status: 'ended', currentTime: 0 });
    });

    this.eventsAttached = true;
  }

  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): VoicemailPlaybackState {
    return this.state;
  }

  getActivePlayerId(): string | null {
    return this.state.activePlayerId;
  }

  /** Returns 0 or 1 — the manager never creates more than one element. */
  getAudioElementCount(): number {
    return this.audio ? 1 : 0;
  }

  isPlaying(playerId: string): boolean {
    return this.state.activePlayerId === playerId && this.state.status === 'playing';
  }

  async toggle(playerId: string, streamPath: string, hooks: ToggleHooks = {}): Promise<void> {
    const audio = this.ensureAudio();

    if (this.state.activePlayerId === playerId) {
      if (this.state.status === 'playing') {
        audio.pause();
        return;
      }
      if (this.state.status === 'paused' || this.state.status === 'ended') {
        if (this.state.status === 'ended') {
          audio.currentTime = 0;
          this.patch({ currentTime: 0, status: 'paused' });
        }
        try {
          await audio.play();
        } catch (err) {
          this.patch({
            status: 'error',
            error: err instanceof Error ? err.message : 'Playback failed',
          });
        }
        return;
      }
      if (this.state.status === 'loading') {
        return;
      }
    }

    audio.pause();
    audio.currentTime = 0;

    const generation = ++this.loadGeneration;
    this.patch({
      activePlayerId: playerId,
      streamPath,
      status: 'loading',
      currentTime: 0,
      error: null,
    });

    try {
      let blobUrl = this.blobCache.get(streamPath);
      if (!blobUrl) {
        blobUrl = await fetchAuthenticatedAudioUrl(streamPath);
        this.blobCache.set(streamPath, blobUrl);
      }

      if (generation !== this.loadGeneration) return;

      audio.src = blobUrl;
      audio.load();
      hooks.onPlayStart?.();
      await audio.play();
    } catch (err) {
      if (generation !== this.loadGeneration) return;
      this.patch({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not load audio',
      });
    }
  }

  stop(): void {
    this.loadGeneration += 1;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.patch({
      status: this.state.activePlayerId ? 'ended' : 'idle',
      currentTime: 0,
    });
  }

  reset(): void {
    this.loadGeneration += 1;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.removeAttribute('src');
    }
    for (const url of this.blobCache.values()) {
      revokeAuthenticatedAudioUrl(url);
    }
    this.blobCache.clear();
    this.state = { ...INITIAL_STATE };
    this.notify();
  }

  /** @internal Test helper — bypass network fetch during validation */
  seedStreamForTests(streamPath: string, blobUrl = 'blob:mock-voicemail-audio'): void {
    this.blobCache.set(streamPath, blobUrl);
  }

  /** @internal Test helper */
  resetForTests(): void {
    this.eventsAttached = false;
    this.audio = null;
    this.listeners.clear();
    this.blobCache.clear();
    this.loadGeneration = 0;
    this.state = { ...INITIAL_STATE };
  }

  private patch(partial: Partial<VoicemailPlaybackState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const voicemailPlaybackManager = new VoicemailPlaybackManager();
