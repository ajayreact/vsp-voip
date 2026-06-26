import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip } from '../lib/api-client';

describe('telephony / recording', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('GET /api/tenant/recordings returns list', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/recordings?limit=5&sync=0', { token });
    expect(res.status).toBe(200);
  });

  it('POST /api/softphone/record-start exists', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/record-start', {
      method: 'POST',
      token,
      body: {},
    });
    expect(res.status).not.toBe(404);
    expect([400, 401, 422]).toContain(res.status);
  });

  it('GET /api/tenant/recordings/setup', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/recordings/setup', { token });
    expect([200, 403]).toContain(res.status);
  });
});
