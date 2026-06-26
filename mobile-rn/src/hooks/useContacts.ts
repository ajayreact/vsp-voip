import { useQuery } from '@tanstack/react-query';
import { fetchContacts } from '../contacts/contactsService';

export function useContacts() {
  return useQuery({
    queryKey: ['contacts', 'directory'],
    queryFn: fetchContacts,
    staleTime: 5 * 60_000,
  });
}
