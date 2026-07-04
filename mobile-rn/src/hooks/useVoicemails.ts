import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VoicemailRecord } from '../api/types';
import {
  patchVoicemailReadInCache,
  removeVoicemailFromCache,
  upsertVoicemailInCache,
  VOICEMAILS_QUERY_KEY,
} from '../voicemail/voicemailQueryCache';
import { fetchVoicemails, markVoicemailRead } from '../voicemail/voicemailService';

export function useVoicemails(limit = 50) {
  return useQuery({
    queryKey: VOICEMAILS_QUERY_KEY,
    queryFn: () => fetchVoicemails(limit),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnReconnect: true,
  });
}

export function useMarkVoicemailRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markVoicemailRead(id),
    onSuccess: (voicemail) => {
      upsertVoicemailInCache(queryClient, voicemail);
    },
  });
}

export function useMarkVoicemailUnreadLocal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => id,
    onSuccess: (id) => {
      patchVoicemailReadInCache(queryClient, id, false);
    },
  });
}

export function useHideVoicemailLocal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => id,
    onSuccess: (id) => {
      removeVoicemailFromCache(queryClient, id);
    },
  });
}

export function useVoicemailById(voicemailId: string): VoicemailRecord | undefined {
  const { data } = useVoicemails();
  return data?.find((item) => item.id === voicemailId);
}
