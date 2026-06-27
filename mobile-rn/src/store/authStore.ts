import { create } from 'zustand';
import type { User } from '../api/types';
import * as authService from '../auth/authService';
import { isUnauthorizedError } from '../utils/errors';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import { usePushRegistrationStore } from '../notifications/pushTokenService';
import { useOutboxStore } from '../messaging/outboxStore';

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isSubmitting: boolean;
  sessionExpired: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithQrToken: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  markSessionExpired: () => void;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  isSubmitting: false,
  sessionExpired: false,
  error: null,

  bootstrap: async () => {
    set({ isBootstrapping: true, error: null, sessionExpired: false });
    try {
      const user = await authService.bootstrapSession();
      set({
        user,
        isAuthenticated: Boolean(user),
        isBootstrapping: false,
        sessionExpired: false,
      });
    } catch (error) {
      const expired = isUnauthorizedError(error);
      set({
        user: null,
        isAuthenticated: false,
        isBootstrapping: false,
        sessionExpired: expired,
        error: getFriendlyErrorMessage(error),
      });
    }
  },

  login: async (email, password) => {
    set({ isSubmitting: true, error: null, sessionExpired: false });
    try {
      const response = await authService.login(email, password);
      set({
        user: response.user,
        isAuthenticated: true,
        isSubmitting: false,
        sessionExpired: false,
      });
    } catch (error) {
      set({
        isSubmitting: false,
        error: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  },

  loginWithQrToken: async (accessToken) => {
    set({ isSubmitting: true, error: null, sessionExpired: false });
    try {
      const user = await authService.loginWithAccessToken(accessToken);
      set({
        user,
        isAuthenticated: true,
        isSubmitting: false,
        sessionExpired: false,
      });
    } catch (error) {
      set({
        isSubmitting: false,
        error: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  },

  logout: async () => {
    await authService.logout();
    usePushRegistrationStore.getState().reset();
    useOutboxStore.getState().clear();
    set({ user: null, isAuthenticated: false, error: null, sessionExpired: false });
  },

  refreshUser: async () => {
    try {
      const user = await authService.fetchCurrentUser();
      set({ user });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        get().markSessionExpired();
      }
      throw error;
    }
  },

  markSessionExpired: () => {
    void authService.clearSession().then(() => {
      usePushRegistrationStore.getState().reset();
    });
    useOutboxStore.getState().clear();
    set({
      user: null,
      isAuthenticated: false,
      sessionExpired: true,
    });
  },

  clearError: () => set({ error: null }),
}));
