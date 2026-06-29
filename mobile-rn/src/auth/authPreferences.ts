import * as SecureStore from 'expo-secure-store';
import { logger } from '../lib/logger';

const REMEMBER_ME_KEY = 'vsp.auth.rememberMe';
const BIOMETRIC_ENABLED_KEY = 'vsp.auth.biometricEnabled';
const LAST_USERNAME_KEY = 'vsp.auth.lastUsername';
const BIOMETRIC_PROMPTED_KEY = 'vsp.auth.biometricPrompted';

export type AuthPreferences = {
  rememberMe: boolean;
  biometricEnabled: boolean;
  lastUsername: string | null;
  biometricPrompted: boolean;
};

const DEFAULT_PREFERENCES: AuthPreferences = {
  rememberMe: true,
  biometricEnabled: false,
  lastUsername: null,
  biometricPrompted: false,
};

async function readBool(key: string, fallback: boolean): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch (error) {
    logger.warn('auth', `SecureStore read failed (${key})`, error);
    return fallback;
  }
}

async function writeBool(key: string, value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value ? 'true' : 'false');
  } catch (error) {
    logger.warn('auth', `SecureStore write failed (${key})`, error);
  }
}

export async function loadAuthPreferences(): Promise<AuthPreferences> {
  try {
    const [rememberMe, biometricEnabled, biometricPrompted, lastUsername] = await Promise.all([
      readBool(REMEMBER_ME_KEY, DEFAULT_PREFERENCES.rememberMe),
      readBool(BIOMETRIC_ENABLED_KEY, DEFAULT_PREFERENCES.biometricEnabled),
      readBool(BIOMETRIC_PROMPTED_KEY, DEFAULT_PREFERENCES.biometricPrompted),
      SecureStore.getItemAsync(LAST_USERNAME_KEY).catch(() => null),
    ]);

    return {
      rememberMe,
      biometricEnabled,
      biometricPrompted,
      lastUsername: lastUsername?.trim() || null,
    };
  } catch (error) {
    logger.warn('auth', 'Failed to load auth preferences', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function saveAuthPreferences(partial: Partial<AuthPreferences>): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (partial.rememberMe !== undefined) {
    tasks.push(writeBool(REMEMBER_ME_KEY, partial.rememberMe));
  }
  if (partial.biometricEnabled !== undefined) {
    tasks.push(writeBool(BIOMETRIC_ENABLED_KEY, partial.biometricEnabled));
  }
  if (partial.biometricPrompted !== undefined) {
    tasks.push(writeBool(BIOMETRIC_PROMPTED_KEY, partial.biometricPrompted));
  }
  if (partial.lastUsername !== undefined) {
    tasks.push(
      partial.lastUsername
        ? SecureStore.setItemAsync(LAST_USERNAME_KEY, partial.lastUsername.trim())
        : SecureStore.deleteItemAsync(LAST_USERNAME_KEY),
    );
  }

  await Promise.all(tasks);
}

export async function clearAuthPreferences(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(REMEMBER_ME_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
      SecureStore.deleteItemAsync(LAST_USERNAME_KEY),
      SecureStore.deleteItemAsync(BIOMETRIC_PROMPTED_KEY),
    ]);
  } catch (error) {
    logger.warn('auth', 'Failed to clear auth preferences', error);
  }
}
