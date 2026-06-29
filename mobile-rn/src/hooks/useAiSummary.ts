import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAiSummary, requestAiSummaryGeneration } from './aiSummaryService';
import type { AiSummaryEntityType } from './types';

export function aiSummaryQueryKey(entityType: AiSummaryEntityType, entityId: string) {
  return ['ai-summary', entityType, entityId] as const;
}

export function useAiSummary(entityType: AiSummaryEntityType, entityId: string | null | undefined) {
  return useQuery({
    queryKey: aiSummaryQueryKey(entityType, entityId || ''),
    queryFn: () => fetchAiSummary(entityType, entityId!),
    enabled: Boolean(entityId),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'processing') return 3000;
      return false;
    },
  });
}

export function useGenerateAiSummary(entityType: AiSummaryEntityType, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestAiSummaryGeneration(entityType, entityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiSummaryQueryKey(entityType, entityId) });
    },
  });
}
