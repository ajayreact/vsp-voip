import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { mergeConversationLists, mergeMessagesById } from './format';
import type { PlatformConversation, PlatformMessage } from './types';

export const MESSAGING_CONVERSATIONS_KEY = ['messaging', 'conversations'] as const;

export type ConversationsPage = {
  success: boolean;
  count: number;
  conversations: PlatformConversation[];
  nextCursor: string | null;
};

export type ThreadPage = {
  success: boolean;
  conversationId: string;
  count: number;
  messages: PlatformMessage[];
  nextCursor: string | null;
};

export function threadQueryKey(conversationId: string) {
  return ['messaging', 'thread', conversationId] as const;
}

function getThreadData(
  queryClient: QueryClient,
  conversationId: string,
): InfiniteData<ThreadPage> | undefined {
  return queryClient.getQueryData<InfiniteData<ThreadPage>>(threadQueryKey(conversationId));
}

export function flattenThreadMessages(data: InfiniteData<ThreadPage> | undefined): PlatformMessage[] {
  if (!data?.pages.length) return [];
  const chronological = [...data.pages].reverse().flatMap((page) => page.messages);
  return mergeMessagesById(chronological);
}

export function upsertThreadMessage(
  queryClient: QueryClient,
  conversationId: string,
  message: PlatformMessage,
): void {
  queryClient.setQueryData<InfiniteData<ThreadPage>>(threadQueryKey(conversationId), (current) => {
    if (!current?.pages.length) {
      return {
        pageParams: [undefined],
        pages: [
          {
            success: true,
            conversationId,
            count: 1,
            messages: [message],
            nextCursor: null,
          },
        ],
      };
    }

    const pages = current.pages.map((page, index) => {
      if (index !== 0) return page;
      const without = page.messages.filter((item) => item.id !== message.id);
      const withoutOptimistic =
        message._outboxId
          ? without.filter((item) => item._outboxId !== message._outboxId)
          : without;
      return {
        ...page,
        messages: [message, ...withoutOptimistic].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      };
    });

    return { ...current, pages };
  });
}

export function reconcileOptimisticThreadMessage(
  queryClient: QueryClient,
  conversationId: string,
  optimisticId: string,
  serverMessage: PlatformMessage,
): void {
  queryClient.setQueryData<InfiniteData<ThreadPage>>(threadQueryKey(conversationId), (current) => {
    if (!current?.pages.length) {
      return {
        pageParams: [undefined],
        pages: [
          {
            success: true,
            conversationId,
            count: 1,
            messages: [serverMessage],
            nextCursor: null,
          },
        ],
      };
    }

    const pages = current.pages.map((page, index) => {
      if (index !== 0) return page;
      const replaced = page.messages.map((item) =>
        item.id === optimisticId || item._outboxId === serverMessage._outboxId ? serverMessage : item,
      );
      const deduped = replaced.filter(
        (item, idx, arr) => arr.findIndex((entry) => entry.id === item.id) === idx,
      );
      return { ...page, messages: deduped };
    });

    return { ...current, pages };
  });
}

export function reconcileThreadMessageByOutboxId(
  queryClient: QueryClient,
  conversationId: string,
  outboxId: string,
  serverMessage: PlatformMessage,
): void {
  queryClient.setQueryData<InfiniteData<ThreadPage>>(threadQueryKey(conversationId), (current) => {
    if (!current?.pages.length) {
      return {
        pageParams: [undefined],
        pages: [
          {
            success: true,
            conversationId,
            count: 1,
            messages: [serverMessage],
            nextCursor: null,
          },
        ],
      };
    }

    const pages = current.pages.map((page, index) => {
      if (index !== 0) return page;
      const replaced = page.messages.map((item) =>
        item._outboxId === outboxId ? serverMessage : item,
      );
      const withoutDupes = replaced.filter(
        (item, idx, arr) => arr.findIndex((entry) => entry.id === item.id) === idx,
      );
      return { ...page, messages: withoutDupes };
    });

    return { ...current, pages };
  });
}

export function patchThreadMessage(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  patch: Partial<PlatformMessage>,
): void {
  queryClient.setQueryData<InfiniteData<ThreadPage>>(threadQueryKey(conversationId), (current) => {
    if (!current?.pages.length) return current;
    const pages = current.pages.map((page) => ({
      ...page,
      messages: page.messages.map((item) =>
        item.id === messageId ? { ...item, ...patch } : item,
      ),
    }));
    return { ...current, pages };
  });
}

export function mergeInboundThreadMessages(
  queryClient: QueryClient,
  conversationId: string,
  incoming: PlatformMessage[],
): number {
  if (!incoming.length) return 0;

  const existing = new Set(flattenThreadMessages(getThreadData(queryClient, conversationId)).map((m) => m.id));
  const fresh = incoming.filter((message) => !existing.has(message.id));
  if (!fresh.length) return 0;

  for (const message of fresh) {
    upsertThreadMessage(queryClient, conversationId, message);
  }
  return fresh.length;
}

export function upsertConversationSummary(
  queryClient: QueryClient,
  conversation: PlatformConversation,
): void {
  queryClient.setQueryData<InfiniteData<ConversationsPage>>(MESSAGING_CONVERSATIONS_KEY, (current) => {
    if (!current?.pages.length) {
      return {
        pageParams: [undefined],
        pages: [{ success: true, count: 1, conversations: [conversation], nextCursor: null }],
      };
    }

    const firstPage = current.pages[0];
    const merged = mergeConversationLists(firstPage.conversations, [conversation], false);
    const pages = [...current.pages];
    pages[0] = { ...firstPage, conversations: merged };
    return { ...current, pages };
  });
}

export function mergeConversationListFromServer(
  queryClient: QueryClient,
  incoming: PlatformConversation[],
): void {
  queryClient.setQueryData<InfiniteData<ConversationsPage>>(MESSAGING_CONVERSATIONS_KEY, (current) => {
    if (!current?.pages.length) {
      return {
        pageParams: [undefined],
        pages: [{ success: true, count: incoming.length, conversations: incoming, nextCursor: null }],
      };
    }

    const pages = [...current.pages];
    pages[0] = {
      ...pages[0],
      conversations: mergeConversationLists(pages[0].conversations, incoming, false),
    };
    return { ...current, pages };
  });
}

export function conversationFromOutboundMessage(
  message: PlatformMessage,
  peer: string,
  line: string,
  existing?: PlatformConversation,
): PlatformConversation {
  return {
    id: message.conversationId,
    peer: peer || message.to,
    line: line || message.from,
    unreadCount: existing?.unreadCount ?? 0,
    lastMessageAt: message.createdAt,
    lastMessagePreview: message.body || existing?.lastMessagePreview || '',
    lastMessage: message,
    updatedAt: message.createdAt,
  };
}

export function markConversationReadInCache(
  queryClient: QueryClient,
  conversationId: string,
): void {
  queryClient.setQueryData<InfiniteData<ConversationsPage>>(MESSAGING_CONVERSATIONS_KEY, (current) => {
    if (!current?.pages.length) return current;
    const pages = current.pages.map((page) => ({
      ...page,
      conversations: page.conversations.map((item) =>
        item.id === conversationId ? { ...item, unreadCount: 0 } : item,
      ),
    }));
    return { ...current, pages };
  });
}
