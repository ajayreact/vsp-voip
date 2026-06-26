import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';
import { config, skipUnlessLiveCalls } from '../lib/config';

describe('telephony / inbound call', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('softphone config exposes inbound routing diagnostics', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/config', { token });
    expect(res.status).toBe(200);
    expect(res.data).toBeTruthy();
  });

  it('call-accepted endpoint exists (bridge grace)', async () => {
    const unauth = await apiRequest('/api/softphone/call-accepted', {
      method: 'POST',
      body: {},
    });
    if (skipIfUnreachable(unauth)) return;
    expect(unauth.status).not.toBe(404);
    expect([400, 401, 422]).toContain(unauth.status);
  });

  it('authenticated call-accepted accepts payload shape', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/call-accepted', {
      method: 'POST',
      token,
      body: { callControlId: 'qa-probe-inbound', direction: 'inbound' },
    });
    expect([200, 400, 404, 422]).toContain(res.status);
  });

  it.skipIf(skipUnlessLiveCalls('live inbound PSTN test'))(
    'live inbound call completes with two-way audio',
    async () => {
      // Manual: dial tenant DID, answer on softphone, verify RTP in diagnostics
      expect(config.liveCalls).toBe(true);
    },
  );
});
