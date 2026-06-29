import type { UnifiedContact } from './types';
import { normalizePhoneKey } from './contactPresence';

export function buildUnifiedContactPhoneMap(contacts: UnifiedContact[]): Map<string, UnifiedContact> {
  const map = new Map<string, UnifiedContact>();
  for (const contact of contacts) {
    const keys = [
      contact.extensionNumber,
      contact.assignedDidNumber,
      ...contact.phoneNumbers,
    ]
      .filter(Boolean)
      .map((value) => normalizePhoneKey(String(value)));
    for (const key of keys) {
      if (key) map.set(key, contact);
    }
  }
  return map;
}

export type UnifiedContactListItem =
  | { type: 'section'; key: string; letter: string; title?: string }
  | { type: 'contact'; key: string; contact: UnifiedContact };

export function groupUnifiedContactsByLetter(contacts: UnifiedContact[]) {
  const groups = new Map<string, UnifiedContact[]>();
  for (const contact of contacts) {
    const letter = (contact.name.trim()[0] || '#').toUpperCase();
    const bucket = /[A-Z]/.test(letter) ? letter : '#';
    const list = groups.get(bucket) ?? [];
    list.push(contact);
    groups.set(bucket, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, items]) => ({ letter, items }));
}

export function flattenUnifiedContactsWithSections(
  contacts: UnifiedContact[],
  sectionTitle?: string,
): UnifiedContactListItem[] {
  const items: UnifiedContactListItem[] = [];
  for (const group of groupUnifiedContactsByLetter(contacts)) {
    items.push({
      type: 'section',
      key: `section-${group.letter}`,
      letter: group.letter,
      title: sectionTitle,
    });
    for (const contact of group.items) {
      items.push({
        type: 'contact',
        key: `${contact.kind}-${contact.id}`,
        contact,
      });
    }
  }
  return items;
}

export function flattenRecentContacts(contacts: UnifiedContact[]): UnifiedContactListItem[] {
  if (!contacts.length) return [];
  return [
    { type: 'section', key: 'section-recent', letter: 'Recent', title: 'Recent contacts' },
    ...contacts.map((contact) => ({
      type: 'contact' as const,
      key: `${contact.kind}-${contact.id}`,
      contact,
    })),
  ];
}
