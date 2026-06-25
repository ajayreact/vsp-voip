'use client';

import { useEffect } from 'react';
import { voicemailPlaybackManager } from '@/lib/voicemail-playback-manager';

type VoicemailAudioScopeProps = {
  children: React.ReactNode;
};

/** Stops shared voicemail playback when leaving the voicemail screen. */
export function VoicemailAudioScope({ children }: VoicemailAudioScopeProps) {
  useEffect(() => () => voicemailPlaybackManager.reset(), []);
  return children;
}
