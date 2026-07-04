import type { ContactEntry } from '../api/types';
import {
  conversationDisplayName,
  resolveConversationContact,
} from './conversationDisplay';
import { formatPhoneDisplay } from './format';
import type { PlatformConversation, PlatformMessage } from './types';

export type MessageSearchHit =
  | {
      kind: 'conversation';
      conversation: PlatformConversation;
      contactName?: string;
      matchedField: 'contact' | 'number' | 'preview';
    }
  | {
      kind: 'message';
      conversation: PlatformConversation;
      message: PlatformMessage;
      contactName?: string;
      snippet: string;
    };

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function messageMatchesQuery(message: PlatformMessage, query: string) {
  return (message.body || '').toLowerCase().includes(query);
}

export function searchMessaging(
  conversations: PlatformConversation[],
  contacts: ContactEntry[],
  query: string,
  cachedMessagesByConversation: Record<string, PlatformMessage[]> = {},
): MessageSearchHit[] {
  const q = normalizeSearch(query);
  if (!q) return [];

  const hits: MessageSearchHit[] = [];
  const seenConversation = new Set<string>();
  const seenMessage = new Set<string>();

  for (const conversation of conversations) {
    const contact = resolveConversationContact(conversation, contacts);
    const displayName = conversationDisplayName(conversation, contact);
    const peer = conversation.peer || '';
    const preview = conversation.lastMessagePreview || '';
    const line = conversation.line || '';

    if (
      displayName.toLowerCase().includes(q)
      || peer.toLowerCase().includes(q)
      || line.toLowerCase().includes(q)
      || preview.toLowerCase().includes(q)
      || formatPhoneDisplay(peer).toLowerCase().includes(q)
    ) {
      hits.push({
        kind: 'conversation',
        conversation,
        contactName: contact?.name,
        matchedField: displayName.toLowerCase().includes(q) ? 'contact' : 'preview',
      });
      seenConversation.add(conversation.id);
    }

    const messages = [
      ...(conversation.lastMessage ? [conversation.lastMessage] : []),
      ...(cachedMessagesByConversation[conversation.id] ?? []),
    ];

    for (const message of messages) {
      if (!messageMatchesQuery(message, q)) continue;
      const key = `${conversation.id}:${message.id}`;
      if (seenMessage.has(key)) continue;
      seenMessage.add(key);
      hits.push({
        kind: 'message',
        conversation,
        message,
        contactName: contact?.name,
        snippet: message.body,
      });
    }
  }

  return hits;
}

export function collectCachedThreadMessages(
  queryClientData: { pages?: { messages: PlatformMessage[] }[] } | undefined,
): PlatformMessage[] {
  if (!queryClientData?.pages?.length) return [];
  return queryClientData.pages.flatMap((page) => page.messages);
}
