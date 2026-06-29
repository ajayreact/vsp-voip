import { create } from 'zustand';

type MessagingUiState = {
  activeConversationId: string | null;
  isAtBottom: boolean;
  newMessagesBelow: number;
  setActiveConversation: (conversationId: string | null) => void;
  setAtBottom: (value: boolean) => void;
  addNewMessagesBelow: (count: number) => void;
  clearNewMessagesBelow: () => void;
};

export const useMessagingUiStore = create<MessagingUiState>((set) => ({
  activeConversationId: null,
  isAtBottom: true,
  newMessagesBelow: 0,

  setActiveConversation: (conversationId) =>
    set({ activeConversationId: conversationId, newMessagesBelow: 0, isAtBottom: true }),

  setAtBottom: (value) => set({ isAtBottom: value }),

  addNewMessagesBelow: (count) =>
    set((state) => ({
      newMessagesBelow: state.isAtBottom ? 0 : state.newMessagesBelow + count,
    })),

  clearNewMessagesBelow: () => set({ newMessagesBelow: 0, isAtBottom: true }),
}));
