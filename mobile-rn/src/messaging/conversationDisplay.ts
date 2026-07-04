import type { ContactEntry } from '../api/types';
import { findContactByNumber } from '../contacts/contactLookup';
import {
  filterConversations,
  formatMessageStatus,
  formatPhoneDisplay,
  sortConversationsByActivity,
} from './format';
import type { PlatformConversation } from './types';

export type ConversationListMode = 'inbox' | 'archived';

export function resolveConversationContact(
  conversation: PlatformConversation,
  contacts: ContactEntry[],
): ContactEntry | undefined {
  return findContactByNumber(contacts, conversation.peer);
}

export function conversationDisplayName(
  conversation: PlatformConversation,
  contact?: ContactEntry,
): string {
  return displayNameForPeer(conversation.peer, contact);
}

export function displayNameForPeer(peer: string, contact?: ContactEntry): string {
  if (contact?.name) return contact.name;
  return formatPhoneDisplay(peer);
}

export function conversationDeliveryPreview(conversation: PlatformConversation): string | undefined {
  const message = conversation.lastMessage;
  if (!message) return undefined;
  const status = formatMessageStatus(message.status);
  if (!status) return undefined;
  if (String(message.direction).toUpperCase() === 'OUTBOUND') return status;
  return undefined;
}

export function applyConversationListFilters(
  items: PlatformConversation[],
  options: {
    query: string;
    mode: ConversationListMode;
    pinnedIds: string[];
    archivedIds: string[];
    hiddenIds: string[];
  },
): PlatformConversation[] {
  const visible = items.filter((item) => {
    if (options.hiddenIds.includes(item.id)) return false;
    const archived = options.archivedIds.includes(item.id);
    if (options.mode === 'archived') return archived;
    return !archived;
  });

  const searched = filterConversations(visible, options.query);
  const pinnedSet = new Set(options.pinnedIds);

  const pinned = options.pinnedIds
    .map((id) => searched.find((item) => item.id === id))
    .filter(Boolean) as PlatformConversation[];

  const rest = sortConversationsByActivity(
    searched.filter((item) => !pinnedSet.has(item.id)),
  );

  return [...pinned, ...rest];
}
