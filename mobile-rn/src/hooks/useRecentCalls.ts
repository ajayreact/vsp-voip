import { useQuery } from '@tanstack/react-query';
import { fetchRecentCalls } from '../calling/callsService';
import { RECENT_CALLS_LIMIT } from '../calling/recentCallsConstants';

export function useRecentCalls() {
  return useQuery({
    queryKey: ['calls', 'recent'],
    queryFn: () => fetchRecentCalls(RECENT_CALLS_LIMIT),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnReconnect: true,
  });
}
