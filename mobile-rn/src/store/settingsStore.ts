import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ThemeMode } from '../shared/theme';

const THEME_KEY = 'vsp.themeMode';
const NOTIFICATIONS_KEY = 'vsp.notificationPrefs';

export type NotificationPrefs = {
  pushEnabled: boolean;
  callAlerts: boolean;
  messageAlerts: boolean;
  voicemailAlerts: boolean;
};

const defaultNotificationPrefs: NotificationPrefs = {
  pushEnabled: true,
  callAlerts: true,
  messageAlerts: true,
  voicemailAlerts: true,
};

type SettingsState = {
  themeMode: ThemeMode;
  notificationPrefs: NotificationPrefs;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setNotificationPrefs: (prefs: Partial<NotificationPrefs>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: 'light',
  notificationPrefs: defaultNotificationPrefs,
  hydrated: false,

  hydrate: async () => {
    try {
      const notifRaw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      set({
        themeMode: 'light',
        notificationPrefs: notifRaw
          ? { ...defaultNotificationPrefs, ...JSON.parse(notifRaw) }
          : defaultNotificationPrefs,
        hydrated: true,
      });
      await AsyncStorage.setItem(THEME_KEY, 'light');
    } catch {
      set({ hydrated: true, themeMode: 'light' });
    }
  },

  setThemeMode: async () => {
    await AsyncStorage.setItem(THEME_KEY, 'light');
    set({ themeMode: 'light' });
  },

  setNotificationPrefs: async (prefs) => {
    const next = { ...get().notificationPrefs, ...prefs };
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
    set({ notificationPrefs: next });
  },
}));
