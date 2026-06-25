'use client';

import { useEffect } from 'react';
import { clearExclusiveAudioGroup } from '@/lib/exclusive-audio-session';

export const VOICEMAIL_AUDIO_GROUP = 'voicemail';

type VoicemailAudioScopeProps = {
  children: React.ReactNode;
};

/** Clears the voicemail exclusive-audio session when the screen unmounts. */
export function VoicemailAudioScope({ children }: VoicemailAudioScopeProps) {
  useEffect(() => () => clearExclusiveAudioGroup(VOICEMAIL_AUDIO_GROUP), []);
  return children;
}
