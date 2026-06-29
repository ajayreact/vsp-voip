import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type MessagePreferencesState = {
  hiddenMessageIds: string[];
  hideMessage: (messageId: string) => void;
  restoreMessage: (messageId: string) => void;
  isHidden: (messageId: string) => boolean;
};

export const useMessagePreferencesStore = create<MessagePreferencesState>()(
  persist(
    (set, get) => ({
      hiddenMessageIds: [],

      hideMessage: (messageId) =>
        set((state) => ({
          hiddenMessageIds: state.hiddenMessageIds.includes(messageId)
            ? state.hiddenMessageIds
            : [...state.hiddenMessageIds, messageId],
        })),

      restoreMessage: (messageId) =>
        set((state) => ({
          hiddenMessageIds: state.hiddenMessageIds.filter((id) => id !== messageId),
        })),

      isHidden: (messageId) => get().hiddenMessageIds.includes(messageId),
    }),
    {
      name: 'vsp-messaging-message-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ hiddenMessageIds: state.hiddenMessageIds }),
    },
  ),
);
