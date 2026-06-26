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
  themeMode: 'dark',
  notificationPrefs: defaultNotificationPrefs,
  hydrated: false,

  hydrate: async () => {
    try {
      const [themeRaw, notifRaw] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(NOTIFICATIONS_KEY),
      ]);
      set({
        themeMode: (themeRaw as ThemeMode) || 'dark',
        notificationPrefs: notifRaw
          ? { ...defaultNotificationPrefs, ...JSON.parse(notifRaw) }
          : defaultNotificationPrefs,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setThemeMode: async (mode) => {
    await AsyncStorage.setItem(THEME_KEY, mode);
    set({ themeMode: mode });
  },

  setNotificationPrefs: async (prefs) => {
    const next = { ...get().notificationPrefs, ...prefs };
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
    set({ notificationPrefs: next });
  },
}));
