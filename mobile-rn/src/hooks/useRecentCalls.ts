import { useQuery } from '@tanstack/react-query';
import { fetchRecentCalls } from '../calling/callsService';

export function useRecentCalls(limit = 50) {
  return useQuery({
    queryKey: ['calls', 'recent', limit],
    queryFn: () => fetchRecentCalls(limit),
  });
}
