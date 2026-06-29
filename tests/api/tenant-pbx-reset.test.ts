import { describe, expect, it } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';

describe('api / tenant PBX reset', () => {
  it('POST /api/tenant/pbx/reset requires authentication', async () => {
    const res = await apiRequest('/api/tenant/pbx/reset', {
      method: 'POST',
      body: {
        password: 'secret',
        confirmationPhrase: 'RESET PBX',
      },
    });
    if (skipIfUnreachable(res)) return;
    expect(res.status).toBe(401);
  });

  it('POST /api/tenant/pbx/reset validates confirmation phrase', async () => {
    const session = await loginOrSkip();
    if (!session) return;

    const res = await apiRequest('/api/tenant/pbx/reset', {
      method: 'POST',
      token: session.token,
      body: {
        password: 'wrong-password',
        confirmationPhrase: 'reset pbx',
      },
    });
    if (skipIfUnreachable(res)) return;
    expect([400, 403]).toContain(res.status);
  });

  it('POST /api/tenant/pbx/reset rejects incorrect password for tenant admin', async () => {
    const session = await loginOrSkip();
    if (!session) return;

    const me = await apiRequest<{ role?: string }>('/api/auth/me', { token: session.token });
    if (me.status !== 200 || me.data.role !== 'TENANT_ADMIN') return;

    const res = await apiRequest('/api/tenant/pbx/reset', {
      method: 'POST',
      token: session.token,
      body: {
        password: 'definitely-not-the-admin-password',
        confirmationPhrase: 'RESET PBX',
      },
    });
    if (skipIfUnreachable(res)) return;
    expect([401, 403]).toContain(res.status);
  });
});
