import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { mergeMessagesById, isPendingMessageStatus } from '../messaging/format';
import { fetchConversationMessages, markConversationRead } from '../messaging/messagingService';
import type { PlatformMessage } from '../messaging/types';

const PAGE_SIZE = 50;

export function useConversationMessages(conversationId: string | null) {
  const query = useInfiniteQuery({
    queryKey: ['messaging', 'thread', conversationId],
    enabled: Boolean(conversationId),
    queryFn: async ({ pageParam }) => {
      const res = await fetchConversationMessages(conversationId!, {
        cursor: pageParam,
        limit: PAGE_SIZE,
      });
      if (!pageParam && conversationId) {
        void markConversationRead(conversationId).catch(() => {});
      }
      return res;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const pages = query.state.data?.pages ?? [];
      const all = pages.flatMap((p) => p.messages);
      const hasPending = all.some(
        (msg) => String(msg.direction).toUpperCase() === 'OUTBOUND' && isPendingMessageStatus(msg.status),
      );
      return hasPending ? 8_000 : false;
    },
  });

  const messages = useMemo(() => {
    if (!query.data?.pages.length) return [] as PlatformMessage[];
    const chronological = [...query.data.pages].reverse().flatMap((page) => page.messages);
    return mergeMessagesById(chronological);
  }, [query.data?.pages]);

  return { ...query, messages };
}
