import { beforeEach, describe, expect, it } from 'vitest';
import { __resetSecureStoreForTests } from 'expo-secure-store';
import {
  clearAuthPreferences,
  loadAuthPreferences,
  saveAuthPreferences,
} from '../../mobile-rn/src/auth/authPreferences';

describe('mobile / auth preferences (Phase 4.1)', () => {
  beforeEach(() => {
    __resetSecureStoreForTests();
  });

  it('defaults remember me to true and biometrics to disabled', async () => {
    const prefs = await loadAuthPreferences();
    expect(prefs.rememberMe).toBe(true);
    expect(prefs.biometricEnabled).toBe(false);
    expect(prefs.biometricPrompted).toBe(false);
    expect(prefs.lastUsername).toBeNull();
  });

  it('persists remember me, username, and biometric flags', async () => {
    await saveAuthPreferences({
      rememberMe: false,
      lastUsername: 'jane@acme.com',
      biometricEnabled: true,
      biometricPrompted: true,
    });

    const prefs = await loadAuthPreferences();
    expect(prefs.rememberMe).toBe(false);
    expect(prefs.lastUsername).toBe('jane@acme.com');
    expect(prefs.biometricEnabled).toBe(true);
    expect(prefs.biometricPrompted).toBe(true);
  });

  it('clears all auth preferences on logout', async () => {
    await saveAuthPreferences({
      rememberMe: true,
      lastUsername: 'jane@acme.com',
      biometricEnabled: true,
      biometricPrompted: true,
    });

    await clearAuthPreferences();
    const prefs = await loadAuthPreferences();
    expect(prefs.lastUsername).toBeNull();
    expect(prefs.biometricEnabled).toBe(false);
    expect(prefs.rememberMe).toBe(true);
  });
});
