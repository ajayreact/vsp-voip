import { useQuery } from '@tanstack/react-query';
import { listConversations } from '../messaging/messagingService';

export function useConversations() {
  return useQuery({
    queryKey: ['messaging', 'conversations'],
    queryFn: listConversations,
    staleTime: 15_000,
  });
}
