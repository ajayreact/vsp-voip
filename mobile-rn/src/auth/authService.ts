import { endpoints } from '../api/endpoints';
import {
  apiRequest,
  loginRequest,
  refreshRequest,
} from '../api/client';
import type { LoginResponse, User } from '../api/types';
import { isNotFoundError, isUnauthorizedError } from '../utils/errors';
import {
  clearTokens,
  getAccessToken,
  loadStoredTokens,
  saveTokens,
} from './tokenStorage';

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export async function hydrateTokenCache(): Promise<void> {
  const stored = await loadStoredTokens();
  accessTokenCache = stored.accessToken;
  refreshTokenCache = stored.refreshToken;
}

export function getCachedAccessToken(): string | null {
  return accessTokenCache;
}

async function setSessionTokens(accessToken: string, refreshToken?: string | null) {
  accessTokenCache = accessToken;
  refreshTokenCache = refreshToken ?? null;
  await saveTokens(accessToken, refreshToken ?? null);
}

export async function clearSession(): Promise<void> {
  accessTokenCache = null;
  refreshTokenCache = null;
  refreshPromise = null;
  await clearTokens();
}

export async function loginWithAccessToken(accessToken: string, refreshToken?: string | null): Promise<User> {
  await setSessionTokens(accessToken, refreshToken ?? null);
  return fetchCurrentUser();
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await loginRequest(email.trim(), password);
  await setSessionTokens(response.accessToken, response.refreshToken ?? null);
  return response;
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (!refreshTokenCache) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshed = await refreshRequest(refreshTokenCache!);
      await setSessionTokens(refreshed.accessToken, refreshed.refreshToken ?? refreshTokenCache);
      return refreshed.accessToken;
    } catch (error) {
      if (isNotFoundError(error) || isUnauthorizedError(error)) {
        await clearSession();
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function authorizedRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (!accessTokenCache) {
    accessTokenCache = await getAccessToken();
  }

  const attempt = async (token: string | null) => apiRequest<T>(path, {
    ...options,
    token,
  });

  try {
    if (!accessTokenCache) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    return await attempt(accessTokenCache);
  } catch (error) {
    if (!isUnauthorizedError(error)) throw error;
    const refreshed = await tryRefreshAccessToken();
    if (!refreshed) throw error;
    return attempt(refreshed);
  }
}

export async function fetchCurrentUser(): Promise<User> {
  return authorizedRequest<User>(endpoints.auth.me);
}

export async function bootstrapSession(): Promise<User | null> {
  await hydrateTokenCache();
  if (!accessTokenCache) return null;

  try {
    return await fetchCurrentUser();
  } catch (error) {
    if (!isUnauthorizedError(error)) throw error;
    const refreshed = await tryRefreshAccessToken();
    if (!refreshed) return null;
    return fetchCurrentUser();
  }
}

export async function logout(): Promise<void> {
  const refreshToken = refreshTokenCache || (await loadStoredTokens()).refreshToken;
  try {
    if (accessTokenCache) {
      await apiRequest(endpoints.auth.logout, {
        method: 'POST',
        token: accessTokenCache,
        body: refreshToken ? { refreshToken } : undefined,
      });
    }
  } catch {
    // Clear local session even if server logout fails.
  } finally {
    await clearSession();
  }
}
