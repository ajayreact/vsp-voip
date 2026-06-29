import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAiTranscript, requestAiTranscriptGeneration } from '../ai/transcriptService';
import type { AiTranscriptEntityType } from '../ai/transcriptTypes';

export function aiTranscriptQueryKey(entityType: AiTranscriptEntityType, entityId: string) {
  return ['ai-transcript', entityType, entityId] as const;
}

export function useAiTranscript(entityType: AiTranscriptEntityType, entityId: string | null | undefined) {
  return useQuery({
    queryKey: aiTranscriptQueryKey(entityType, entityId || ''),
    queryFn: () => fetchAiTranscript(entityType, entityId!),
    enabled: Boolean(entityId),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'processing') return 3000;
      return false;
    },
  });
}

export function useGenerateAiTranscript(entityType: AiTranscriptEntityType, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestAiTranscriptGeneration(entityType, entityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiTranscriptQueryKey(entityType, entityId) });
    },
  });
}
