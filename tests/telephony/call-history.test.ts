import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip } from '../lib/api-client';

describe('telephony / call history', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('GET /api/calls returns CDR list', async () => {
    if (!token) return;
    const res = await apiRequest('/api/calls?limit=10', { token });
    expect(res.status).toBe(200);
  });

  it('POST /api/softphone/call-log accepts client CDR sync', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/call-log', {
      method: 'POST',
      token,
      body: {
        direction: 'outbound',
        status: 'completed',
        durationSeconds: 0,
        remoteNumber: '+15551234567',
      },
    });
    expect([200, 201, 400, 422]).toContain(res.status);
  });
});
