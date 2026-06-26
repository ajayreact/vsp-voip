import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type { MessageAttachment, MessageRecord, ConversationSummary } from '../api/types';

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await authorizedRequest<{
    success?: boolean;
    conversations?: ConversationSummary[];
  }>(endpoints.messaging.conversations);
  return response.conversations ?? [];
}

export async function listConversationMessages(conversationId: string): Promise<MessageRecord[]> {
  const response = await authorizedRequest<{
    success?: boolean;
    messages?: MessageRecord[];
  }>(endpoints.messaging.conversationMessages(conversationId));
  return response.messages ?? [];
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await authorizedRequest(endpoints.messaging.markRead(conversationId), { method: 'PATCH' });
}

export async function sendMessage(body: {
  to: string;
  from: string;
  text: string;
}): Promise<{ success?: boolean }> {
  return authorizedRequest(endpoints.messaging.send, {
    method: 'POST',
    body,
  });
}

export type { MessageAttachment };
