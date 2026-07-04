import { describe, it, expect } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable, isApiReachable } from '../lib/api-client';

describe('api / auth lifecycle', () => {
  it('POST /api/auth/logout requires JWT', async () => {
    const res = await apiRequest('/api/auth/logout', { method: 'POST' });
    if (skipIfUnreachable(res)) return;
    expect(res.status).toBe(401);
  });

  it('login → me → logout → refresh revoked', async () => {
    if (!(await isApiReachable())) return;

    const loginRes = await apiRequest<{
      accessToken?: string;
      refreshToken?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: {
        email: process.env.QA_EMAIL || process.env.EMAIL || 'admin@asuitech.com',
        password: process.env.QA_PASSWORD || process.env.PASSWORD || 'Admin@123',
      },
    });
    if (skipIfUnreachable(loginRes)) return;
    if (loginRes.status !== 200 || !loginRes.data.accessToken) {
      console.warn('[skip] QA credentials unavailable');
      return;
    }

    const { accessToken, refreshToken } = loginRes.data;
    expect(accessToken).toBeTruthy();

    const me = await apiRequest('/api/auth/me', { token: accessToken });
    expect(me.status).toBe(200);

    const logout = await apiRequest('/api/auth/logout', {
      method: 'POST',
      token: accessToken,
      body: refreshToken ? { refreshToken } : undefined,
    });
    expect(logout.status).toBe(200);

    if (refreshToken) {
      const refresh = await apiRequest('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      expect(refresh.status).toBe(401);
    }
  });

  it('GET /api/tenant/profile returns tenant context after login', async () => {
    const session = await loginOrSkip();
    if (!session) return;

    const res = await apiRequest<{ success?: boolean }>('/api/tenant/profile', {
      token: session.token,
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});
