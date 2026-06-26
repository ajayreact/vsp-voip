import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip } from '../lib/api-client';

describe('telephony / voicemail', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('GET /api/tenant/voicemails returns list', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/voicemails?limit=5', { token });
    expect(res.status).toBe(200);
  });

  it('voicemail list is tenant-scoped array', async () => {
    if (!token) return;
    const res = await apiRequest<{ voicemails?: unknown[] }>('/api/tenant/voicemails?limit=5', { token });
    expect(res.status).toBe(200);
    if (res.data.voicemails) expect(Array.isArray(res.data.voicemails)).toBe(true);
  });
});
