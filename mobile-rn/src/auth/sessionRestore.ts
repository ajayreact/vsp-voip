import type { User } from '../api/types';
import { loadAuthPreferences } from './authPreferences';
import * as authService from './authService';
import { loadStoredTokens } from './tokenStorage';

export type SessionRestorePhase =
  | 'no_session'
  | 'needs_biometric'
  | 'restored'
  | 'expired';

export type SessionRestorePlan = {
  phase: SessionRestorePhase;
  rememberMe: boolean;
  lastUsername: string | null;
  hasStoredTokens: boolean;
};

export async function planSessionRestore(): Promise<SessionRestorePlan> {
  const preferences = await loadAuthPreferences();
  const { accessToken } = await loadStoredTokens();

  if (!preferences.rememberMe || !accessToken) {
    return {
      phase: 'no_session',
      rememberMe: preferences.rememberMe,
      lastUsername: preferences.lastUsername,
      hasStoredTokens: Boolean(accessToken),
    };
  }

  if (preferences.biometricEnabled) {
    return {
      phase: 'needs_biometric',
      rememberMe: preferences.rememberMe,
      lastUsername: preferences.lastUsername,
      hasStoredTokens: true,
    };
  }

  return {
    phase: 'restored',
    rememberMe: preferences.rememberMe,
    lastUsername: preferences.lastUsername,
    hasStoredTokens: true,
  };
}

export async function restoreStoredSession(): Promise<User | null> {
  return authService.bootstrapSession();
}
