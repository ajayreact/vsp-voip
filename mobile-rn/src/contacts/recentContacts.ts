import type { CallLogEntry } from '../api/types';
import type { PlatformConversation } from '../messaging/types';
import { findContactByNumber } from './contactLookup';
import type { ContactEntry } from '../api/types';
import { normalizePhoneKey } from './contactPresence';
import type { UnifiedContact } from './types';

export type RecentContactEntry = {
  id: string;
  peer: string;
  label: string;
  source: 'call' | 'message';
  lastContactAt: string;
  kind: 'company' | 'customer' | 'unknown';
  contactId?: string;
};

export function buildRecentContactEntries(params: {
  calls: CallLogEntry[];
  conversations: PlatformConversation[];
  companyContacts: ContactEntry[];
}): RecentContactEntry[] {
  const merged = new Map<string, RecentContactEntry>();

  for (const call of params.calls) {
    const peer = call.direction === 'inbound' ? call.from : call.to;
    const key = normalizePhoneKey(peer);
    if (!key) continue;
    const match = findContactByNumber(params.companyContacts, peer);
    const existing = merged.get(key);
    const entry: RecentContactEntry = {
      id: `call-${call.id}`,
      peer,
      label: match?.name || peer,
      source: 'call',
      lastContactAt: call.createdAt,
      kind: match ? 'company' : 'unknown',
      contactId: match?.id,
    };
    if (!existing || new Date(entry.lastContactAt) > new Date(existing.lastContactAt)) {
      merged.set(key, entry);
    }
  }

  for (const conversation of params.conversations) {
    const peer = conversation.peer;
    const key = normalizePhoneKey(peer);
    if (!key) continue;
    const match = findContactByNumber(params.companyContacts, peer);
    const at = conversation.lastMessageAt || conversation.updatedAt || '';
    const existing = merged.get(key);
    const entry: RecentContactEntry = {
      id: `msg-${conversation.id}`,
      peer,
      label: match?.name || conversation.peer,
      source: 'message',
      lastContactAt: at,
      kind: match ? 'company' : 'unknown',
      contactId: match?.id,
    };
    if (!existing || (at && new Date(at) > new Date(existing.lastContactAt))) {
      merged.set(key, entry);
    }
  }

  return [...merged.values()].sort(
    (a, b) => new Date(b.lastContactAt).getTime() - new Date(a.lastContactAt).getTime(),
  );
}

export function recentEntriesToUnified(
  entries: RecentContactEntry[],
  companyDirectory: UnifiedContact[],
  customers: UnifiedContact[] = [],
  limit = 50,
): UnifiedContact[] {
  const byId = new Map(companyDirectory.map((item) => [item.id, item]));
  const byPhone = new Map<string, UnifiedContact>();
  for (const contact of [...companyDirectory, ...customers]) {
    for (const number of contact.phoneNumbers) {
      byPhone.set(normalizePhoneKey(number), contact);
    }
    if (contact.extensionNumber) byPhone.set(normalizePhoneKey(contact.extensionNumber), contact);
  }

  const results: UnifiedContact[] = [];
  const seen = new Set<string>();

  for (const entry of entries.slice(0, limit)) {
    let contact =
      (entry.contactId ? byId.get(entry.contactId) : undefined)
      || byPhone.get(normalizePhoneKey(entry.peer));

    if (!contact) {
      contact = {
        id: `recent-${normalizePhoneKey(entry.peer)}`,
        kind: 'customer',
        name: entry.label,
        phoneNumbers: [entry.peer],
        presence: 'unknown',
        lastContactAt: entry.lastContactAt,
      };
    }

    const dedupeKey = `${contact.kind}:${contact.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    results.push({ ...contact, lastContactAt: entry.lastContactAt });
  }

  return results;
}
