import { create } from 'zustand';
import { saveCustomerContactsCache, loadCustomerContactsCache } from './contactCache';
import type { CustomerContactRecord } from './types';

function createId() {
  return `cust_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type CustomerContactsState = {
  items: CustomerContactRecord[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (input: Omit<CustomerContactRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<CustomerContactRecord>;
  remove: (id: string) => Promise<void>;
  touchLastContact: (id: string, iso?: string) => Promise<void>;
};

export const useCustomerContactsStore = create<CustomerContactsState>((set, get) => ({
  items: [],
  hydrated: false,

  hydrate: async () => {
    const items = await loadCustomerContactsCache();
    set({ items, hydrated: true });
  },

  upsert: async (input) => {
    const now = new Date().toISOString();
    const existing = input.id ? get().items.find((item) => item.id === input.id) : undefined;
    const nextRecord: CustomerContactRecord = existing
      ? {
          ...existing,
          ...input,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
        }
      : {
          id: input.id || createId(),
          name: input.name,
          company: input.company,
          phoneNumbers: input.phoneNumbers,
          email: input.email,
          notes: input.notes,
          lastContactAt: input.lastContactAt,
          createdAt: now,
          updatedAt: now,
        };

    const items = existing
      ? get().items.map((item) => (item.id === nextRecord.id ? nextRecord : item))
      : [nextRecord, ...get().items];

    await saveCustomerContactsCache(items);
    set({ items });
    return nextRecord;
  },

  remove: async (id) => {
    const items = get().items.filter((item) => item.id !== id);
    await saveCustomerContactsCache(items);
    set({ items });
  },

  touchLastContact: async (id, iso = new Date().toISOString()) => {
    const items = get().items.map((item) =>
      item.id === id ? { ...item, lastContactAt: iso, updatedAt: iso } : item,
    );
    await saveCustomerContactsCache(items);
    set({ items });
  },
}));
