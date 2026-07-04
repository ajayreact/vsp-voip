import type { QueryClient } from '@tanstack/react-query';
import type { VoicemailRecord } from '../api/types';

export const VOICEMAILS_QUERY_KEY = ['voicemail', 'list'] as const;

function sortVoicemails(list: VoicemailRecord[]): VoicemailRecord[] {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function mergeVoicemailListFromServer(
  queryClient: QueryClient,
  incoming: VoicemailRecord[],
): void {
  queryClient.setQueryData<VoicemailRecord[]>(VOICEMAILS_QUERY_KEY, (current) => {
    const map = new Map<string, VoicemailRecord>();
    for (const item of current ?? []) map.set(item.id, item);
    for (const item of incoming) {
      const existing = map.get(item.id);
      map.set(item.id, existing ? { ...existing, ...item } : item);
    }
    return sortVoicemails([...map.values()]);
  });
}

export function upsertVoicemailInCache(
  queryClient: QueryClient,
  voicemail: VoicemailRecord,
): void {
  queryClient.setQueryData<VoicemailRecord[]>(VOICEMAILS_QUERY_KEY, (current) => {
    const list = current ?? [];
    const without = list.filter((item) => item.id !== voicemail.id);
    return sortVoicemails([voicemail, ...without]);
  });
}

export function patchVoicemailReadInCache(
  queryClient: QueryClient,
  id: string,
  isRead: boolean,
): void {
  queryClient.setQueryData<VoicemailRecord[]>(VOICEMAILS_QUERY_KEY, (current) => {
    if (!current) return current;
    return current.map((item) => (item.id === id ? { ...item, isRead } : item));
  });
}

export function removeVoicemailFromCache(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<VoicemailRecord[]>(VOICEMAILS_QUERY_KEY, (current) =>
    current?.filter((item) => item.id !== id) ?? [],
  );
}
