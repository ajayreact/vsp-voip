import { describe, it, expect } from 'vitest';
import { apiRequest, login, loginOrSkip, skipIfUnreachable, isApiReachable } from '../lib/api-client';

describe('api / authentication', () => {
  it('POST /api/auth/login rejects empty credentials', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: '', password: '' },
    });
    if (skipIfUnreachable(res)) return;
    expect([400, 401, 422]).toContain(res.status);
  });

  it('POST /api/auth/login succeeds with QA credentials when API available', async () => {
    if (!(await isApiReachable())) return;
    try {
      const session = await login();
      expect(session.token).toBeTruthy();
    } catch {
      const health = await apiRequest('/health');
      if (health.status !== 200) {
        console.warn('[skip] API not reachable for login test');
        return;
      }
      throw new Error('Login failed against reachable API');
    }
  });

  it('GET /api/auth/me requires JWT', async () => {
    const res = await apiRequest('/api/auth/me');
    if (skipIfUnreachable(res)) return;
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns user with valid token', async () => {
    const session = await loginOrSkip();
    if (!session) return;
    const res = await apiRequest('/api/auth/me', { token: session.token });
    expect(res.status).toBe(200);
  });
});
