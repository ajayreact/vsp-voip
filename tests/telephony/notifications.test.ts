import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip } from '../lib/api-client';

describe('telephony / notifications', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('POST /api/softphone/presence heartbeat', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/presence', {
      method: 'POST',
      token,
      body: { online: true },
    });
    expect([200, 201]).toContain(res.status);
  });

  it('POST /api/softphone/push-token endpoint exists', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/push-token', {
      method: 'POST',
      token,
      body: { token: 'qa-test-token', platform: 'android' },
    });
    expect(res.status).not.toBe(404);
    expect([200, 201, 400, 422]).toContain(res.status);
  });
});
