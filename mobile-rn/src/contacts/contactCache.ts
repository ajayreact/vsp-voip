import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ContactEntry } from '../api/types';

const CACHE_KEY = 'vsp.contacts.directory.cache';

export async function saveContactsCache(contacts: ContactEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), contacts }),
    );
  } catch {
    // Non-fatal offline cache.
  }
}

export async function loadContactsCache(): Promise<ContactEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { contacts?: ContactEntry[] };
    return parsed.contacts ?? [];
  } catch {
    return [];
  }
}

const CUSTOMER_KEY = 'vsp.contacts.customers';

export async function saveCustomerContactsCache(
  customers: import('./types').CustomerContactRecord[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOMER_KEY, JSON.stringify(customers));
  } catch {
    // Non-fatal.
  }
}

export async function loadCustomerContactsCache(): Promise<
  import('./types').CustomerContactRecord[]
> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOMER_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as import('./types').CustomerContactRecord[];
  } catch {
    return [];
  }
}

const RECENT_KEY = 'vsp.contacts.recent';

export async function saveRecentContactsCache(
  items: import('./recentContacts').RecentContactEntry[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(items));
  } catch {
    // Non-fatal.
  }
}

export async function loadRecentContactsCache(): Promise<
  import('./recentContacts').RecentContactEntry[]
> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as import('./recentContacts').RecentContactEntry[];
  } catch {
    return [];
  }
}

export async function clearAllContactCaches(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, CUSTOMER_KEY, RECENT_KEY]);
}
