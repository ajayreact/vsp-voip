import type { ContactEntry } from '../api/types';

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export type ContactLookupMaps = {
  byId: Map<string, ContactEntry>;
  byPhoneKey: Map<string, ContactEntry>;
  namesByPhoneKey: Map<string, string>;
};

export function buildContactLookupMaps(contacts: ContactEntry[]): ContactLookupMaps {
  const byId = new Map<string, ContactEntry>();
  const byPhoneKey = new Map<string, ContactEntry>();
  const namesByPhoneKey = new Map<string, string>();

  for (const contact of contacts) {
    byId.set(contact.id, contact);
    const extKey = digitsOnly(contact.extensionNumber);
    const didKey = digitsOnly(contact.assignedDidNumber || '');
    if (extKey) {
      byPhoneKey.set(extKey, contact);
      namesByPhoneKey.set(extKey, contact.name);
    }
    if (didKey) {
      byPhoneKey.set(didKey, contact);
      namesByPhoneKey.set(didKey, contact.name);
      if (didKey.length >= 10) {
        byPhoneKey.set(didKey.slice(-10), contact);
        namesByPhoneKey.set(didKey.slice(-10), contact.name);
      }
    }
  }

  return { byId, byPhoneKey, namesByPhoneKey };
}

export function findContactInMaps(maps: ContactLookupMaps, number: string): ContactEntry | undefined {
  const key = digitsOnly(number);
  if (!key) return undefined;
  return (
    maps.byPhoneKey.get(key)
    ?? (key.length >= 10 ? maps.byPhoneKey.get(key.slice(-10)) : undefined)
  );
}

export function flattenContactsWithSections(contacts: ContactEntry[]): ContactListItem[] {
  const groups = groupContactsByLetter(contacts);
  const items: ContactListItem[] = [];
  for (const group of groups) {
    items.push({ type: 'section', key: `section-${group.letter}`, letter: group.letter });
    for (const contact of group.items) {
      items.push({ type: 'contact', key: contact.id, contact });
    }
  }
  return items;
}

export type ContactListItem =
  | { type: 'section'; key: string; letter: string }
  | { type: 'contact'; key: string; contact: ContactEntry };

export function groupContactsByLetter(contacts: ContactEntry[]): { letter: string; items: ContactEntry[] }[] {
  const groups = new Map<string, ContactEntry[]>();
  for (const contact of contacts) {
    const letter = (contact.name.trim()[0] || '#').toUpperCase();
    const bucket = groups.get(letter) ?? [];
    bucket.push(contact);
    groups.set(letter, bucket);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, items]) => ({ letter, items }));
}
