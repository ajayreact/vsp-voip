import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { AppNotification, NotificationKind } from './notificationGrouping';
import { notificationDedupeKey } from './notificationGrouping';

const STORAGE_KEY = 'vsp.appNotifications';
const MAX_ITEMS = 200;

type NotificationsState = {
  items: AppNotification[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (notification: AppNotification) => void;
  upsertMany: (notifications: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
};

async function persistItems(items: AppNotification[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      set({
        items: raw ? (JSON.parse(raw) as AppNotification[]) : [],
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  upsert: (notification) => {
    const current = get().items;
    const without = current.filter((item) => item.id !== notification.id);
    const next = [notification, ...without].slice(0, MAX_ITEMS);
    set({ items: next });
    void persistItems(next);
  },

  upsertMany: (notifications) => {
    if (!notifications.length) return;
    const map = new Map(get().items.map((item) => [item.id, item]));
    for (const notification of notifications) {
      map.set(notification.id, notification);
    }
    const next = [...map.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ).slice(0, MAX_ITEMS);
    set({ items: next });
    void persistItems(next);
  },

  markRead: (id) => {
    const next = get().items.map((item) =>
      item.id === id ? { ...item, isRead: true } : item,
    );
    set({ items: next });
    void persistItems(next);
  },

  markAllRead: () => {
    const next = get().items.map((item) => ({ ...item, isRead: true }));
    set({ items: next });
    void persistItems(next);
  },

  clear: (id) => {
    const next = get().items.filter((item) => item.id !== id);
    set({ items: next });
    void persistItems(next);
  },

  clearAll: () => {
    set({ items: [] });
    void persistItems([]);
  },

  unreadCount: () => get().items.filter((item) => !item.isRead).length,
}));

export function buildNotification(params: {
  kind: NotificationKind;
  referenceId: string;
  title: string;
  body: string;
  createdAt?: string;
  isRead?: boolean;
  deepLink?: AppNotification['deepLink'];
}): AppNotification {
  return {
    id: notificationDedupeKey(params.kind, params.referenceId),
    kind: params.kind,
    title: params.title,
    body: params.body,
    createdAt: params.createdAt ?? new Date().toISOString(),
    isRead: params.isRead ?? false,
    deepLink: params.deepLink,
  };
}
