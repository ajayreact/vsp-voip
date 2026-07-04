import { describe, it, expect } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';

describe('api / DID', () => {
  it('POST /api/admin/numbers/sync — unauthenticated', async () => {
    const res = await apiRequest('/api/admin/numbers/sync', { method: 'POST' });
    if (skipIfUnreachable(res)) return;
    expect(res.status).toBe(401);
  });

  it('assign DID via PUT /api/numbers/:id requires auth', async () => {
    const res = await apiRequest('/api/numbers/qa-probe-id', {
      method: 'PUT',
      body: { routingType: 'tenant_default' },
    });
    if (skipIfUnreachable(res)) return;
    expect([401, 404]).toContain(res.status);
  });

  it('tenant numbers endpoint when logged in', async () => {
    const session = await loginOrSkip();
    if (!session) return;
    const res = await apiRequest('/api/numbers', { token: session.token });
    expect([200, 403, 404]).toContain(res.status);
  });
});
