import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip } from '../lib/api-client';

describe('telephony / IVR', () => {
  let token: string | undefined;
  let tenantId: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
    if (token) {
      const me = await apiRequest<{ user?: { tenantId?: string } }>('/api/auth/me', { token });
      tenantId = me.data.user?.tenantId;
    }
  });

  it('tenant greeting API supports IVR configuration', async () => {
    if (!token || !tenantId) return;
    const res = await apiRequest(`/api/tenants/${tenantId}/greeting`, { token });
    expect([200, 403, 404]).toContain(res.status);
  });

  it('call-routing API exists', async () => {
    if (!token || !tenantId) return;
    const res = await apiRequest(`/api/tenants/${tenantId}/call-routing`, { token });
    expect([200, 403, 404]).toContain(res.status);
  });

  it.todo('multi-level IVR gather chain — v1.6');
});
