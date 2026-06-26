/**
 * HTTP client for QA API tests — uses fetch only.
 */
import { config } from './config';

export type ApiResponse<T = unknown> = {
  status: number;
  data: T;
  raw: string;
  unreachable?: boolean;
};

let apiReachableCache: boolean | undefined;

export async function isApiReachable(): Promise<boolean> {
  if (apiReachableCache !== undefined) return apiReachableCache;
  try {
    const res = await fetch(`${config.apiBase}/health`, { signal: AbortSignal.timeout(5000) });
    apiReachableCache = res.ok || res.status === 503;
  } catch {
    apiReachableCache = false;
  }
  return apiReachableCache;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', token, body } = options;
  try {
    const res = await fetch(`${config.apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    const raw = await res.text();
    let data: T;
    try {
      data = raw ? JSON.parse(raw) : ({} as T);
    } catch {
      data = { raw: raw.slice(0, 500) } as T;
    }

    return { status: res.status, data, raw };
  } catch (error) {
    return {
      status: 0,
      data: {} as T,
      raw: error instanceof Error ? error.message : String(error),
      unreachable: true,
    };
  }
}

export function skipIfUnreachable(res: ApiResponse): boolean {
  if (res.unreachable) {
    console.warn(`[skip] API unreachable (${config.apiBase}): ${res.raw}`);
    return true;
  }
  return false;
}

export async function login(): Promise<{ token: string; tenantId?: string; role?: string }> {
  const res = await apiRequest<{ accessToken?: string; user?: { tenantId?: string; role?: string } }>(
    '/api/auth/login',
    { method: 'POST', body: { email: config.email, password: config.password } },
  );
  if (res.status !== 200 || !res.data.accessToken) {
    throw new Error(`Login failed: ${res.status} ${res.raw.slice(0, 200)}`);
  }
  return {
    token: res.data.accessToken,
    tenantId: res.data.user?.tenantId,
    role: res.data.user?.role,
  };
}

export async function loginOrSkip(): Promise<{ token: string } | null> {
  if (!(await isApiReachable())) {
    console.warn(`[skip] API unreachable at ${config.apiBase}`);
    return null;
  }
  try {
    const session = await login();
    return { token: session.token };
  } catch (e) {
    console.warn('[skip] API login unavailable:', (e as Error).message);
    return null;
  }
}
