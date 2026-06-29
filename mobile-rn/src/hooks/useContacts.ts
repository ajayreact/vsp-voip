import { useQuery } from '@tanstack/react-query';
import { fetchContactDetail } from '../contacts/contactsService';
import { useContactsDirectory } from './useContactsDirectory';

export { useContactsDirectory };

export function useContacts() {
  return useContactsDirectory();
}

export function useContactDetail(contactId: string) {
  return useQuery({
    queryKey: ['contacts', 'detail', contactId],
    queryFn: () => fetchContactDetail(contactId),
    staleTime: 2 * 60_000,
    refetchOnReconnect: true,
  });
}
