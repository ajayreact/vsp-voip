import * as SecureStore from 'expo-secure-store';
import { logger } from '../lib/logger';

const ACCESS_TOKEN_KEY = 'vsp.accessToken';
const REFRESH_TOKEN_KEY = 'vsp.refreshToken';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY, secureStoreOptions);
  } catch (error) {
    logger.warn('auth', 'SecureStore read failed (access token)', error);
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions);
  } catch (error) {
    logger.warn('auth', 'SecureStore read failed (refresh token)', error);
    return null;
  }
}

export async function saveTokens(accessToken: string, refreshToken?: string | null): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, secureStoreOptions);
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, secureStoreOptions);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions);
    }
  } catch (error) {
    logger.warn('auth', 'SecureStore write failed', error);
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, secureStoreOptions);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions);
  } catch (error) {
    logger.warn('auth', 'SecureStore clear failed', error);
  }
}

export async function loadStoredTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const [accessToken, refreshToken] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);
  return { accessToken, refreshToken };
}
