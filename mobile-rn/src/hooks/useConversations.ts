import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchConversations } from '../messaging/messagingService';
import { mergeConversationLists } from '../messaging/format';
import { useMemo } from 'react';

const PAGE_SIZE = 50;

export function useConversationsInfinite() {
  const query = useInfiniteQuery({
    queryKey: ['messaging', 'conversations'],
    queryFn: ({ pageParam }) => fetchConversations({ cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });

  const conversations = useMemo(() => {
    if (!query.data?.pages.length) return [];
    return query.data.pages.reduce(
      (acc, page, index) => mergeConversationLists(acc, page.conversations, index > 0),
      [] as ReturnType<typeof mergeConversationLists>,
    );
  }, [query.data?.pages]);

  return { ...query, conversations };
}

export function useConversations() {
  return useQuery({
    queryKey: ['messaging', 'conversations', 'simple'],
    queryFn: async () => {
      const res = await fetchConversations({ limit: PAGE_SIZE });
      return res.conversations;
    },
    staleTime: 15_000,
  });
}
