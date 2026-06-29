import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { mergeMessagesById } from '../messaging/format';
import { fetchConversationMessages, markConversationRead } from '../messaging/messagingService';
import { markConversationReadInCache } from '../messaging/messagingQueryCache';
import type { PlatformMessage } from '../messaging/types';

const PAGE_SIZE = 50;

export function useConversationMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['messaging', 'thread', conversationId],
    enabled: Boolean(conversationId),
    queryFn: async ({ pageParam }) => {
      const res = await fetchConversationMessages(conversationId!, {
        cursor: pageParam,
        limit: PAGE_SIZE,
      });
      if (!pageParam && conversationId) {
        markConversationReadInCache(queryClient, conversationId);
        void markConversationRead(conversationId).catch(() => {});
      }
      return res;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const messages = useMemo(() => {
    if (!query.data?.pages.length) return [] as PlatformMessage[];
    const chronological = [...query.data.pages].reverse().flatMap((page) => page.messages);
    return mergeMessagesById(chronological);
  }, [query.data?.pages]);

  return { ...query, messages };
}
