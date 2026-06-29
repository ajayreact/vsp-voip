import type { QueryClient } from '@tanstack/react-query';
import type { ContactEntry } from '../api/types';

export const CONTACTS_DIRECTORY_KEY = ['contacts', 'directory'] as const;

export function mergeContactsDirectory(
  queryClient: QueryClient,
  incoming: ContactEntry[],
): void {
  queryClient.setQueryData<ContactEntry[]>(CONTACTS_DIRECTORY_KEY, (current) => {
    if (!current?.length) return incoming;
    const byId = new Map(current.map((item) => [item.id, item]));
    for (const contact of incoming) {
      byId.set(contact.id, { ...byId.get(contact.id), ...contact });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function patchContactPresence(
  queryClient: QueryClient,
  contactId: string,
  patch: Pick<ContactEntry, 'isOnline'>,
): void {
  queryClient.setQueryData<ContactEntry[]>(CONTACTS_DIRECTORY_KEY, (current) => {
    if (!current?.length) return current;
    return current.map((item) => (item.id === contactId ? { ...item, ...patch } : item));
  });
}
