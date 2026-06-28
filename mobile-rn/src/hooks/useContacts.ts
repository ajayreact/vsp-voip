import { useQuery } from '@tanstack/react-query';
import { fetchContactDetail, fetchContacts } from '../contacts/contactsService';

export function useContacts() {
  return useQuery({
    queryKey: ['contacts', 'directory'],
    queryFn: fetchContacts,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnReconnect: true,
  });
}

export function useContactDetail(contactId: string) {
  return useQuery({
    queryKey: ['contacts', 'detail', contactId],
    queryFn: () => fetchContactDetail(contactId),
    staleTime: 2 * 60_000,
    refetchOnReconnect: true,
  });
}
