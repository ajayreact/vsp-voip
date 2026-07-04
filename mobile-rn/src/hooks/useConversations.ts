import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fetchConversations } from '../messaging/messagingService';
import { loadConversationsCache, saveConversationsCache } from '../messaging/conversationCache';
import { mergeConversationLists } from '../messaging/format';

const PAGE_SIZE = 50;

export function useConversationsInfinite() {
  const [offlineCache, setOfflineCache] = useState<Awaited<ReturnType<typeof loadConversationsCache>>>([]);

  useEffect(() => {
    void loadConversationsCache().then(setOfflineCache);
  }, []);

  const query = useInfiniteQuery({
    queryKey: ['messaging', 'conversations'],
    queryFn: async ({ pageParam }) => {
      const res = await fetchConversations({ cursor: pageParam, limit: PAGE_SIZE });
      if (!pageParam) {
        void saveConversationsCache(res.conversations);
      }
      return res;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });

  const conversations = useMemo(() => {
    if (!query.data?.pages.length) {
      return offlineCache;
    }
    return query.data.pages.reduce(
      (acc, page, index) => mergeConversationLists(acc, page.conversations, index > 0),
      [] as ReturnType<typeof mergeConversationLists>,
    );
  }, [offlineCache, query.data?.pages]);

  return { ...query, conversations };
}

export function useConversations() {
  return useQuery({
    queryKey: ['messaging', 'conversations', 'simple'],
    queryFn: async () => {
      const res = await fetchConversations({ limit: PAGE_SIZE });
      void saveConversationsCache(res.conversations);
      return res.conversations;
    },
    staleTime: 15_000,
  });
}
