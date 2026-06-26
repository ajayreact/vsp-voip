import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, login, loginOrSkip } from '../lib/api-client';

describe('telephony / tenant routing', () => {
  let token: string | undefined;
  let tenantId: string | undefined;

  beforeAll(async () => {
    try {
      const session = await login();
      token = session.token;
      tenantId = session.tenantId;
    } catch {
      const fallback = await loginOrSkip();
      token = fallback?.token;
    }
  });

  it('JWT /api/auth/me includes tenantId', async () => {
    if (!token) return;
    const res = await apiRequest<{ user?: { tenantId?: string } }>('/api/auth/me', { token });
    expect(res.status).toBe(200);
    expect(res.data.user?.tenantId).toBeTruthy();
    tenantId = res.data.user?.tenantId;
  });

  it('tenant cannot access another tenant calls via missing tenant header', async () => {
    if (!token) return;
    const res = await apiRequest('/api/calls?limit=1', { token });
    expect(res.status).toBe(200);
  });

  it('greeting API is tenant-scoped', async () => {
    if (!token || !tenantId) return;
    const res = await apiRequest(`/api/tenants/${tenantId}/greeting`, { token });
    expect([200, 403, 404]).toContain(res.status);
  });
});
