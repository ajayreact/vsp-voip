import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchConversationMessages } from '../messaging/messagingService';
import { mergeInboundThreadMessages } from '../messaging/messagingQueryCache';
import { useMessagingUiStore } from '../messaging/messagingUiStore';
import { useAppStore } from '../store/appStore';

const THREAD_SYNC_MS = 8_000;

export function useThreadBackgroundSync(conversationId: string | null) {
  const queryClient = useQueryClient();
  const isOnline = useAppStore((s) => s.isOnline);
  const isAtBottom = useMessagingUiStore((s) => s.isAtBottom);
  const addNewBelow = useMessagingUiStore((s) => s.addNewMessagesBelow);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    useMessagingUiStore.getState().setActiveConversation(conversationId);
    return () => {
      useMessagingUiStore.getState().setActiveConversation(null);
    };
  }, [conversationId]);

  const isAtBottomRef = useRef(isAtBottom);
  isAtBottomRef.current = isAtBottom;

  useEffect(() => {
    if (!conversationId || !isOnline) return undefined;

    let cancelled = false;

    const sync = async () => {
      try {
        const res = await fetchConversationMessages(conversationId, { limit: 30 });
        if (cancelled) return;

        const added = mergeInboundThreadMessages(queryClient, conversationId, res.messages);
        if (added > 0 && !isAtBottomRef.current) {
          addNewBelow(added);
        }

        lastMessageIdRef.current = res.messages[0]?.id ?? lastMessageIdRef.current;
      } catch {
        // Background sync — silent failure.
      }
    };

    void sync();
    const timer = setInterval(() => {
      void sync();
    }, THREAD_SYNC_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [addNewBelow, conversationId, isOnline, queryClient]);
}
