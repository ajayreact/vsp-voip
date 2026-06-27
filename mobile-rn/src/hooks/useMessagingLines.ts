import { useQuery } from '@tanstack/react-query';
import { fetchMessagingSetup } from '../messaging/messagingService';

export function useMessagingLines() {
  return useQuery({
    queryKey: ['messaging', 'setup'],
    queryFn: fetchMessagingSetup,
    staleTime: 5 * 60_000,
  });
}
