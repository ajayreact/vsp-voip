import { useEffect, useState } from 'react';
import {
  voicemailPlaybackManager,
  type VoicemailPlaybackState,
} from '../voicemail/voicemailPlayback';

export function useVoicemailPlayback() {
  const [state, setState] = useState<VoicemailPlaybackState>(() =>
    voicemailPlaybackManager.getState(),
  );

  useEffect(() => voicemailPlaybackManager.subscribe(setState), []);

  return {
    ...state,
    play: (id: string) => voicemailPlaybackManager.play(id),
    pause: () => voicemailPlaybackManager.pause(),
    toggle: (id: string) => voicemailPlaybackManager.toggle(id),
    seek: (ms: number) => voicemailPlaybackManager.seek(ms),
    stop: () => voicemailPlaybackManager.stop(),
  };
}
