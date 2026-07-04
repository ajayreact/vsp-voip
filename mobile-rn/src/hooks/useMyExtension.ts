import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExtensions } from '../contacts/contactsService';
import { resolveMyExtension } from '../settings/diagnosticsFormat';
import { useAuth } from './useAuth';

export function useMyExtension() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['settings', 'my-extension', user?.id],
    queryFn: fetchExtensions,
    staleTime: 60_000,
    enabled: Boolean(user?.id),
  });

  const extension = useMemo(
    () => resolveMyExtension(query.data ?? [], user?.id),
    [query.data, user?.id],
  );

  return {
    ...query,
    extension,
  };
}
