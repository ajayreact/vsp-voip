import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type { VoicemailRecord } from '../api/types';

export async function fetchVoicemails(limit = 50): Promise<VoicemailRecord[]> {
  const response = await authorizedRequest<{
    success?: boolean;
    voicemails?: VoicemailRecord[];
  }>(endpoints.voicemail.list(limit));
  return response.voicemails ?? [];
}

export async function markVoicemailRead(id: string): Promise<VoicemailRecord> {
  const response = await authorizedRequest<{ success?: boolean; voicemail: VoicemailRecord }>(
    endpoints.voicemail.markRead(id),
    { method: 'PATCH' },
  );
  return response.voicemail;
}

export function voicemailStreamPath(id: string): string {
  return endpoints.voicemail.stream(id);
}
