import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DashboardStats } from '../api/types';
import {
  buildBusinessInsights,
  buildDailyBrief,
  buildIntelligenceInput,
  buildRecommendations,
  buildSmartBanners,
} from '../intelligence';

export function useIntelligenceDashboard(params: {
  stats: DashboardStats | null;
  calls: ReturnType<typeof buildIntelligenceInput>['calls'];
  voicemails: ReturnType<typeof buildIntelligenceInput>['voicemails'];
  conversations: ReturnType<typeof buildIntelligenceInput>['conversations'];
}) {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const input = buildIntelligenceInput({
      calls: params.calls,
      voicemails: params.voicemails,
      conversations: params.conversations,
      queryClient,
      dashboardStats: params.stats ?? undefined,
    });
    const dailyBrief = buildDailyBrief(input);
    const recommendations = buildRecommendations(input);
    const businessInsights = buildBusinessInsights(input);
    const banners = buildSmartBanners(recommendations, dailyBrief);
    return { input, dailyBrief, recommendations, businessInsights, banners };
  }, [params.calls, params.conversations, params.stats, params.voicemails, queryClient]);
}
