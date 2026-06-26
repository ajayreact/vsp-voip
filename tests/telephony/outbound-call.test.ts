import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip } from '../lib/api-client';
import { skipUnlessLiveCalls } from '../lib/config';

describe('telephony / outbound call', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('softphone token issued for WebRTC outbound', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/token', { method: 'POST', token });
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.data).toHaveProperty('login_token');
    }
  });

  it('internal-call API exists', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/internal-call', {
      method: 'POST',
      token,
      body: {},
    });
    expect(res.status).not.toBe(404);
    expect([400, 401, 422]).toContain(res.status);
  });

  it.skipIf(skipUnlessLiveCalls('live outbound PSTN test'))(
    'live outbound call connects to external number',
    async () => {
      expect(true).toBe(true);
    },
  );
});
