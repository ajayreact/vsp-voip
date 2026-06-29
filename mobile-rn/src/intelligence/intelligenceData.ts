import type { QueryClient } from '@tanstack/react-query';
import type { CallLogEntry, VoicemailRecord } from '../api/types';
import type { PlatformConversation } from '../messaging/types';
import type { AiSummaryEntityType, AiSummaryResponse } from '../ai/types';
import type { IntelligenceInput } from './types';

export function readCachedSummaries(queryClient: QueryClient) {
  const entries = queryClient.getQueriesData<AiSummaryResponse>({ queryKey: ['ai-summary'] });
  const cachedSummaries: IntelligenceInput['cachedSummaries'] = [];
  for (const [key, response] of entries) {
    if (!response || !Array.isArray(key) || key.length < 3) continue;
    cachedSummaries.push({
      entityType: key[1] as AiSummaryEntityType,
      entityId: String(key[2]),
      response,
    });
  }
  return cachedSummaries;
}

export function buildIntelligenceInput(params: {
  calls?: CallLogEntry[];
  voicemails?: VoicemailRecord[];
  conversations?: PlatformConversation[];
  queryClient: QueryClient;
  dashboardStats?: IntelligenceInput['dashboardStats'];
  now?: Date;
}): IntelligenceInput {
  return {
    calls: params.calls ?? [],
    voicemails: params.voicemails ?? [],
    conversations: params.conversations ?? [],
    cachedSummaries: readCachedSummaries(params.queryClient),
    dashboardStats: params.dashboardStats,
    now: params.now,
  };
}
