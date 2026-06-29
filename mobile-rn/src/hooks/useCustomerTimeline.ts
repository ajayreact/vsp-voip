import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildCustomerTimeline, readCachedSummaries } from '../intelligence';
import { useRecentCalls } from './useRecentCalls';
import { useVoicemails } from './useVoicemails';
import { useConversations } from './useConversations';

export function useCustomerTimeline(contactPhones: string[], contactName: string) {
  const queryClient = useQueryClient();
  const { data: calls = [] } = useRecentCalls();
  const { data: voicemails = [] } = useVoicemails();
  const { data: conversations = [] } = useConversations();

  return useMemo(
    () =>
      buildCustomerTimeline({
        contactPhones,
        contactName,
        calls,
        conversations,
        voicemails,
        cachedSummaries: readCachedSummaries(queryClient),
      }),
    [calls, contactName, contactPhones, conversations, queryClient, voicemails],
  );
}
