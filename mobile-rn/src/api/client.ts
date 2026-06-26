import { env } from '../shared/config/env';
import { endpoints } from '../api/endpoints';
import type { ApiErrorBody, LoginResponse, MeResponse, RefreshResponse } from '../api/types';
import { ApiError } from '../utils/errors';

export type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  skipAuth?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, skipAuth = false } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError(
      `Cannot reach API at ${env.apiBaseUrl}. Check EXPO_PUBLIC_API_BASE_URL and that the backend is running.`,
      0,
      error,
    );
  }

  const raw = await response.text();
  let data: T & ApiErrorBody;
  try {
    data = raw ? JSON.parse(raw) : ({} as T & ApiErrorBody);
  } catch {
    throw new ApiError(`Invalid JSON response (${response.status})`, response.status, raw.slice(0, 200));
  }

  if (!response.ok) {
    throw new ApiError(data.error || `Request failed (${response.status})`, response.status, data);
  }

  return data as T;
}

export function loginRequest(email: string, password: string) {
  return apiRequest<LoginResponse>(endpoints.auth.login, {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export function meRequest(token: string) {
  return apiRequest<MeResponse>(endpoints.auth.me, { token });
}

export function refreshRequest(refreshToken: string) {
  return apiRequest<RefreshResponse>(endpoints.auth.refresh, {
    method: 'POST',
    body: { refreshToken },
    skipAuth: true,
  });
}
