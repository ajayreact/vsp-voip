import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MessageAttachment } from './types';

export type OutboxMessage = {
  id: string;
  from: string;
  to: string;
  text: string;
  attachmentIds: string[];
  attachments: MessageAttachment[];
  conversationId?: string;
  createdAt: string;
  retryCount: number;
  lastError?: string;
};

type OutboxState = {
  items: OutboxMessage[];
  enqueue: (item: Omit<OutboxMessage, 'retryCount' | 'createdAt'> & { createdAt?: string }) => void;
  remove: (id: string) => void;
  markRetry: (id: string, error: string) => void;
  clear: () => void;
};

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set) => ({
      items: [],
      enqueue: (item) => set((state) => ({
        items: [
          ...state.items,
          {
            ...item,
            createdAt: item.createdAt || new Date().toISOString(),
            retryCount: 0,
          },
        ],
      })),
      remove: (id) => set((state) => ({ items: state.items.filter((entry) => entry.id !== id) })),
      markRetry: (id, error) => set((state) => ({
        items: state.items.map((entry) =>
          entry.id === id
            ? { ...entry, retryCount: entry.retryCount + 1, lastError: error }
            : entry,
        ),
      })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'vsp-messaging-outbox',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export function createOutboxId() {
  return `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createOptimisticId() {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
