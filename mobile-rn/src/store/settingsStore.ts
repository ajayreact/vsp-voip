import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ThemeMode } from '../shared/theme';
import type {
  ClientSettingsPrefs,
  FontSizePreference,
  LanguagePreference,
  VoicemailPlaybackSpeed,
} from '../settings/types';

const THEME_KEY = 'vsp.themeMode';
const NOTIFICATIONS_KEY = 'vsp.notificationPrefs';
const CLIENT_PREFS_KEY = 'vsp.clientSettingsPrefs';

export type NotificationPrefs = {
  pushEnabled: boolean;
  callAlerts: boolean;
  messageAlerts: boolean;
  voicemailAlerts: boolean;
  systemAlerts: boolean;
};

const defaultNotificationPrefs: NotificationPrefs = {
  pushEnabled: true,
  callAlerts: true,
  messageAlerts: true,
  voicemailAlerts: true,
  systemAlerts: true,
};

const defaultClientPrefs: ClientSettingsPrefs = {
  voicemailPlaybackSpeed: '1',
  voicemailAutoDownload: true,
  messagingDeliveryReports: false,
  messagingSignature: '',
  systemAlerts: true,
  fontSize: 'default',
  language: 'en',
};

type SettingsState = {
  themeMode: ThemeMode;
  notificationPrefs: NotificationPrefs;
  clientPrefs: ClientSettingsPrefs;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setNotificationPrefs: (prefs: Partial<NotificationPrefs>) => Promise<void>;
  setClientPrefs: (prefs: Partial<ClientSettingsPrefs>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: 'light',
  notificationPrefs: defaultNotificationPrefs,
  clientPrefs: defaultClientPrefs,
  hydrated: false,

  hydrate: async () => {
    try {
      const [notifRaw, clientRaw] = await Promise.all([
        AsyncStorage.getItem(NOTIFICATIONS_KEY),
        AsyncStorage.getItem(CLIENT_PREFS_KEY),
      ]);
      set({
        themeMode: 'light',
        notificationPrefs: notifRaw
          ? { ...defaultNotificationPrefs, ...JSON.parse(notifRaw) }
          : defaultNotificationPrefs,
        clientPrefs: clientRaw
          ? { ...defaultClientPrefs, ...JSON.parse(clientRaw) }
          : defaultClientPrefs,
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

  setClientPrefs: async (prefs) => {
    const next = { ...get().clientPrefs, ...prefs };
    await AsyncStorage.setItem(CLIENT_PREFS_KEY, JSON.stringify(next));
    set({ clientPrefs: next });
  },
}));

export type { VoicemailPlaybackSpeed, FontSizePreference, LanguagePreference };
