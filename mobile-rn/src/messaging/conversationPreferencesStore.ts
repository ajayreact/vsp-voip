import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ConversationPreferencesState = {
  pinnedIds: string[];
  archivedIds: string[];
  hiddenIds: string[];
  hydrated: boolean;
  pin: (conversationId: string) => void;
  unpin: (conversationId: string) => void;
  togglePin: (conversationId: string) => void;
  archive: (conversationId: string) => void;
  unarchive: (conversationId: string) => void;
  hide: (conversationId: string) => void;
  restore: (conversationId: string) => void;
  isPinned: (conversationId: string) => boolean;
  isArchived: (conversationId: string) => boolean;
  isHidden: (conversationId: string) => boolean;
};

export const useConversationPreferencesStore = create<ConversationPreferencesState>()(
  persist(
    (set, get) => ({
      pinnedIds: [],
      archivedIds: [],
      hiddenIds: [],
      hydrated: false,

      pin: (conversationId) =>
        set((state) => ({
          pinnedIds: state.pinnedIds.includes(conversationId)
            ? state.pinnedIds
            : [conversationId, ...state.pinnedIds],
        })),

      unpin: (conversationId) =>
        set((state) => ({
          pinnedIds: state.pinnedIds.filter((id) => id !== conversationId),
        })),

      togglePin: (conversationId) => {
        if (get().isPinned(conversationId)) get().unpin(conversationId);
        else get().pin(conversationId);
      },

      archive: (conversationId) =>
        set((state) => ({
          archivedIds: state.archivedIds.includes(conversationId)
            ? state.archivedIds
            : [...state.archivedIds, conversationId],
          pinnedIds: state.pinnedIds.filter((id) => id !== conversationId),
        })),

      unarchive: (conversationId) =>
        set((state) => ({
          archivedIds: state.archivedIds.filter((id) => id !== conversationId),
        })),

      hide: (conversationId) =>
        set((state) => ({
          hiddenIds: state.hiddenIds.includes(conversationId)
            ? state.hiddenIds
            : [...state.hiddenIds, conversationId],
          pinnedIds: state.pinnedIds.filter((id) => id !== conversationId),
          archivedIds: state.archivedIds.filter((id) => id !== conversationId),
        })),

      restore: (conversationId) =>
        set((state) => ({
          hiddenIds: state.hiddenIds.filter((id) => id !== conversationId),
        })),

      isPinned: (conversationId) => get().pinnedIds.includes(conversationId),
      isArchived: (conversationId) => get().archivedIds.includes(conversationId),
      isHidden: (conversationId) => get().hiddenIds.includes(conversationId),
    }),
    {
      name: 'vsp-messaging-conversation-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pinnedIds: state.pinnedIds,
        archivedIds: state.archivedIds,
        hiddenIds: state.hiddenIds,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
