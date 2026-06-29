import { create } from 'zustand';
import type { User } from '../api/types';
import {
  clearAuthPreferences,
  loadAuthPreferences,
  saveAuthPreferences,
} from '../auth/authPreferences';
import * as authService from '../auth/authService';
import {
  authenticateWithBiometric,
  getBiometricCapability,
} from '../auth/biometricAuth';
import {
  applyMobileProvisioningResult,
  redeemProvisioningQr,
} from '../auth/provisionService';
import type { QrLoginPayload } from '../auth/qrLogin';
import { mapProvisionError } from '../auth/provisionErrors';
import { planSessionRestore, restoreStoredSession } from '../auth/sessionRestore';
import { isUnauthorizedError } from '../utils/errors';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import { usePushRegistrationStore } from '../notifications/pushTokenService';
import { useOutboxStore } from '../messaging/outboxStore';
import { clearClientSessionCaches } from '../lib/sessionCleanup';

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isSubmitting: boolean;
  sessionExpired: boolean;
  awaitingBiometric: boolean;
  pendingBiometricOptIn: boolean;
  biometricLabel: string;
  lastUsername: string | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  unlockWithBiometric: () => Promise<void>;
  skipBiometricUnlock: () => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithQrToken: (accessToken: string) => Promise<void>;
  provisionWithQr: (payload: QrLoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  markSessionExpired: () => void;
  enableBiometricLogin: () => Promise<void>;
  declineBiometricLogin: () => Promise<void>;
  clearError: () => void;
};

async function maybePromptBiometricOptIn(set: (partial: Partial<AuthState>) => void): Promise<void> {
  const preferences = await loadAuthPreferences();
  if (preferences.biometricPrompted || preferences.biometricEnabled) return;

  const capability = await getBiometricCapability();
  if (!capability.available) {
    await saveAuthPreferences({ biometricPrompted: true });
    return;
  }

  set({
    pendingBiometricOptIn: true,
    biometricLabel: capability.label,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  isSubmitting: false,
  sessionExpired: false,
  awaitingBiometric: false,
  pendingBiometricOptIn: false,
  biometricLabel: 'Biometrics',
  lastUsername: null,
  error: null,

  bootstrap: async () => {
    set({
      isBootstrapping: true,
      error: null,
      sessionExpired: false,
      awaitingBiometric: false,
    });

    try {
      const plan = await planSessionRestore();
      set({ lastUsername: plan.lastUsername });

      if (plan.phase === 'no_session') {
        set({
          user: null,
          isAuthenticated: false,
          isBootstrapping: false,
        });
        return;
      }

      if (plan.phase === 'needs_biometric') {
        const capability = await getBiometricCapability();
        set({
          user: null,
          isAuthenticated: false,
          isBootstrapping: false,
          awaitingBiometric: true,
          biometricLabel: capability.label,
        });
        return;
      }

      const user = await restoreStoredSession();
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

  unlockWithBiometric: async () => {
    set({ error: null });
    const { biometricLabel } = get();
    const result = await authenticateWithBiometric(`Unlock with ${biometricLabel}`);

    if (!result.success) {
      if (result.reason === 'cancelled') {
        await get().skipBiometricUnlock();
        return;
      }
      set({
        error:
          result.reason === 'lockout'
            ? `${biometricLabel} is temporarily locked. Sign in with your password.`
            : `${biometricLabel} failed. Sign in with your password.`,
      });
      await get().skipBiometricUnlock();
      return;
    }

    set({ isBootstrapping: true, awaitingBiometric: false });
    try {
      const user = await restoreStoredSession();
      if (!user) {
        set({
          user: null,
          isAuthenticated: false,
          isBootstrapping: false,
          sessionExpired: true,
        });
        return;
      }

      set({
        user,
        isAuthenticated: true,
        isBootstrapping: false,
        sessionExpired: false,
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isBootstrapping: false,
        sessionExpired: isUnauthorizedError(error),
        error: getFriendlyErrorMessage(error),
      });
    }
  },

  skipBiometricUnlock: async () => {
    await authService.clearSession();
    set({
      awaitingBiometric: false,
      isAuthenticated: false,
      user: null,
      sessionExpired: false,
      error: null,
    });
  },

  login: async (email, password, rememberMe = true) => {
    set({ isSubmitting: true, error: null, sessionExpired: false });
    try {
      const trimmedEmail = email.trim();
      const response = await authService.login(trimmedEmail, password, {
        persistSession: rememberMe,
      });
      await saveAuthPreferences({
        rememberMe,
        lastUsername: trimmedEmail,
      });
      set({
        user: response.user,
        isAuthenticated: true,
        isSubmitting: false,
        sessionExpired: false,
        lastUsername: trimmedEmail,
        awaitingBiometric: false,
      });
      if (rememberMe) {
        await maybePromptBiometricOptIn(set);
      }
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
      await saveAuthPreferences({ rememberMe: true });
      set({
        user,
        isAuthenticated: true,
        isSubmitting: false,
        sessionExpired: false,
      });
      await maybePromptBiometricOptIn(set);
    } catch (error) {
      set({
        isSubmitting: false,
        error: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  },

  provisionWithQr: async (payload: QrLoginPayload) => {
    set({ isSubmitting: true, error: null, sessionExpired: false });
    try {
      const result = await redeemProvisioningQr(payload);
      if (result.purpose === 'desk' || !result.accessToken) {
        throw new Error('This QR code is for desk phone setup. Use SIP settings to import desk profiles.');
      }
      const username = result.user?.email || result.user?.name || null;
      await authService.loginWithAccessToken(result.accessToken, result.refreshToken ?? null, {
        persist: true,
      });
      await applyMobileProvisioningResult(result);
      const user = await authService.fetchCurrentUser();
      await saveAuthPreferences({
        rememberMe: true,
        lastUsername: username,
      });
      set({
        user,
        isAuthenticated: true,
        isSubmitting: false,
        sessionExpired: false,
        lastUsername: username,
      });
      await maybePromptBiometricOptIn(set);
    } catch (error) {
      set({
        isSubmitting: false,
        error: mapProvisionError(error),
      });
      throw error;
    }
  },

  logout: async () => {
    await authService.logout();
    await clearAuthPreferences();
    await clearClientSessionCaches();
    usePushRegistrationStore.getState().reset();
    useOutboxStore.getState().clear();
    set({
      user: null,
      isAuthenticated: false,
      error: null,
      sessionExpired: false,
      awaitingBiometric: false,
      pendingBiometricOptIn: false,
      lastUsername: null,
    });
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
    void authService.clearSession().then(async () => {
      await clearClientSessionCaches();
      usePushRegistrationStore.getState().reset();
    });
    useOutboxStore.getState().clear();
    set({
      user: null,
      isAuthenticated: false,
      sessionExpired: true,
      awaitingBiometric: false,
      pendingBiometricOptIn: false,
    });
  },

  enableBiometricLogin: async () => {
    const capability = await getBiometricCapability();
    if (!capability.available) {
      await saveAuthPreferences({ biometricPrompted: true, biometricEnabled: false });
      set({ pendingBiometricOptIn: false });
      return;
    }

    const result = await authenticateWithBiometric(`Enable ${capability.label}`);
    await saveAuthPreferences({
      biometricEnabled: result.success,
      biometricPrompted: true,
    });
    set({ pendingBiometricOptIn: false, biometricLabel: capability.label });
  },

  declineBiometricLogin: async () => {
    await saveAuthPreferences({
      biometricEnabled: false,
      biometricPrompted: true,
    });
    set({ pendingBiometricOptIn: false });
  },

  clearError: () => set({ error: null }),
}));
