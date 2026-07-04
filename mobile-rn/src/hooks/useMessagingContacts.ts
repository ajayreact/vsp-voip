import { useQuery } from '@tanstack/react-query';
import { CONTACTS_DIRECTORY_KEY } from '../contacts/contactsQueryCache';
import { fetchContacts } from '../contacts/contactsService';
import { saveContactsCache } from '../contacts/contactCache';

export function useMessagingContacts() {
  return useQuery({
    queryKey: CONTACTS_DIRECTORY_KEY,
    queryFn: async () => {
      const contacts = await fetchContacts();
      void saveContactsCache(contacts);
      return contacts;
    },
    staleTime: 60_000,
    gcTime: 60 * 60_000,
    refetchOnReconnect: true,
  });
}
