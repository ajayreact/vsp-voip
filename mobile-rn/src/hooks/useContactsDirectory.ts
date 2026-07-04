import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchContacts } from '../contacts/contactsService';
import { loadContactsCache, saveContactsCache } from '../contacts/contactCache';
import { CONTACTS_DIRECTORY_KEY } from '../contacts/contactsQueryCache';
import { companyContactFromEntry } from '../contacts/contactPresence';
import { customerContactFromRecord } from '../contacts/contactPresence';
import { useCustomerContactsStore } from '../contacts/customerContactsStore';
import type { UnifiedContact } from '../contacts/types';
import { useCallingStore } from '../store/callingStore';

import { SYNC_PROFILES } from '../lib/syncProfiles';

const PRESENCE_REFRESH_MS = SYNC_PROFILES.contactsPresenceMs;

export function useContactsDirectory() {
  const [offlineCache, setOfflineCache] = useState<Awaited<ReturnType<typeof loadContactsCache>>>([]);
  const customerItems = useCustomerContactsStore((s) => s.items);
  const hydrateCustomers = useCustomerContactsStore((s) => s.hydrate);
  const activeCall = useCallingStore((s) => s.activeCall);
  const incomingCall = useCallingStore((s) => s.incomingCall);

  useEffect(() => {
    void loadContactsCache().then(setOfflineCache);
    void hydrateCustomers();
  }, [hydrateCustomers]);

  const query = useQuery({
    queryKey: CONTACTS_DIRECTORY_KEY,
    queryFn: async () => {
      const contacts = await fetchContacts();
      void saveContactsCache(contacts);
      return contacts;
    },
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: () => (AppState.currentState === 'active' ? PRESENCE_REFRESH_MS : false),
    refetchOnReconnect: true,
    placeholderData: offlineCache.length ? offlineCache : undefined,
  });

  const activePeers = useMemo(() => {
    const peers: string[] = [];
    if (activeCall?.identity.number) peers.push(activeCall.identity.number);
    if (incomingCall?.identity.number) peers.push(incomingCall.identity.number);
    return peers;
  }, [activeCall?.identity.number, incomingCall?.identity.number]);

  const companyDirectory = useMemo(() => {
    const source = query.data ?? offlineCache;
    return source.map((entry) => companyContactFromEntry(entry, null, activePeers));
  }, [activePeers, offlineCache, query.data]);

  const customerDirectory = useMemo(
    () => customerItems.map(customerContactFromRecord),
    [customerItems],
  );

  const allContacts = useMemo(
    () => [...companyDirectory, ...customerDirectory],
    [companyDirectory, customerDirectory],
  );

  return {
    ...query,
    companyDirectory,
    customerDirectory,
    allContacts,
    entries: query.data ?? offlineCache,
    data: query.data ?? offlineCache,
  };
}
