import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';

describe('api / transfer', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('blind transfer route exists', async () => {
    const res = await apiRequest('/api/softphone/transfer/blind', { method: 'POST', body: {} });
    if (skipIfUnreachable(res)) return;
    expect(res.status).not.toBe(404);
  });

  it('blind transfer rejects unauthenticated', async () => {
    const res = await apiRequest('/api/softphone/transfer/blind', {
      method: 'POST',
      body: { destination: '102' },
    });
    if (skipIfUnreachable(res)) return;
    expect(res.status).toBe(401);
  });
});

describe('api / recording', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('recordings list', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/recordings?sync=0', { token });
    expect(res.status).toBe(200);
  });

  it('record-start endpoint', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/record-start', { method: 'POST', token, body: {} });
    expect(res.status).not.toBe(404);
  });
});

describe('api / voicemail', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('voicemails list', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/voicemails?limit=5', { token });
    expect(res.status).toBe(200);
  });
});
