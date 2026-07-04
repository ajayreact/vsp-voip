import { useEffect, useMemo } from 'react';
import { useContactsDirectory } from './useContactsDirectory';
import { useRecentCalls } from './useRecentCalls';
import { useConversations } from './useConversations';
import {
  buildRecentContactEntries,
  recentEntriesToUnified,
} from '../contacts/recentContacts';
import { loadRecentContactsCache, saveRecentContactsCache } from '../contacts/contactCache';
import { useState } from 'react';

export function useRecentContactsDirectory() {
  const { companyDirectory, customerDirectory, entries } = useContactsDirectory();
  const { data: recentCalls = [] } = useRecentCalls();
  const { data: conversations = [] } = useConversations();
  const [cachedRecent, setCachedRecent] = useState<Awaited<ReturnType<typeof loadRecentContactsCache>>>([]);

  useEffect(() => {
    void loadRecentContactsCache().then(setCachedRecent);
  }, []);

  const recentContacts = useMemo(() => {
    const built = buildRecentContactEntries({
      calls: recentCalls,
      conversations,
      companyContacts: entries,
    });
    void saveRecentContactsCache(built);
    return recentEntriesToUnified(built, companyDirectory, customerDirectory);
  }, [companyDirectory, conversations, customerDirectory, entries, recentCalls]);

  return {
    recentContacts: recentContacts.length ? recentContacts : [],
    cachedRecent,
  };
}
