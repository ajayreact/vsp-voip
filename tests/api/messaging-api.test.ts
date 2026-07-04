import { describe, it, expect } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';

describe('api / messaging', () => {
  it('GET /api/conversations requires JWT', async () => {
    const res = await apiRequest('/api/conversations');
    if (skipIfUnreachable(res)) return;
    expect(res.status).toBe(401);
  });

  it('GET /api/conversations returns list with valid token', async () => {
    const session = await loginOrSkip();
    if (!session) return;

    const res = await apiRequest<{ success?: boolean; conversations?: unknown[] }>(
      '/api/conversations',
      { token: session.token },
    );
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.conversations)).toBe(true);
  });

  it('POST /api/messages/send rejects empty payload', async () => {
    const session = await loginOrSkip();
    if (!session) return;

    const res = await apiRequest('/api/messages/send', {
      method: 'POST',
      token: session.token,
      body: { from: '', to: '', text: '' },
    });
    expect([400, 403]).toContain(res.status);
  });

  it('GET /api/sms/conversations remains available for legacy clients', async () => {
    const session = await loginOrSkip();
    if (!session) return;

    const res = await apiRequest('/api/sms/conversations', { token: session.token });
    expect(res.status).toBe(200);
  });

  it('POST /api/messages/attachments rejects missing data', async () => {
    const session = await loginOrSkip();
    if (!session) return;

    const res = await apiRequest('/api/messages/attachments', {
      method: 'POST',
      token: session.token,
      body: {},
    });
    expect(res.status).toBe(400);
  });
});
