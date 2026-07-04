import type { QueryClient } from '@tanstack/react-query';
import { fetchConversationMessages, markConversationRead } from './messagingService';
import { markConversationReadInCache, mergeInboundThreadMessages } from './messagingQueryCache';

export async function syncThreadOnOpen(queryClient: QueryClient, conversationId: string) {
  try {
    const res = await fetchConversationMessages(conversationId, { limit: 40 });
    mergeInboundThreadMessages(queryClient, conversationId, res.messages);
    markConversationReadInCache(queryClient, conversationId);
    await markConversationRead(conversationId);
  } catch {
    // Silent background reconcile when opening from push or resume.
  }
}
