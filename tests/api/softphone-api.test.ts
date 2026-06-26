import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';

describe('api / softphone', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('GET /api/softphone/config', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/config', { token });
    expect(res.status).toBe(200);
  });

  it('POST /api/softphone/token', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/token', { method: 'POST', token });
    expect([200, 503]).toContain(res.status);
  });

  it('POST /api/softphone/call-accepted', async () => {
    const unauth = await apiRequest('/api/softphone/call-accepted', { method: 'POST', body: {} });
    if (skipIfUnreachable(unauth)) return;
    expect(unauth.status).toBe(401);
  });

  it('GET /api/softphone/devices', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/devices', { token });
    expect([200, 403]).toContain(res.status);
  });
});
