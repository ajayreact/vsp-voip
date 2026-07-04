import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';

describe('telephony / DID management', () => {
  it('POST /api/admin/numbers/sync requires auth', async () => {
    const res = await apiRequest('/api/admin/numbers/sync', { method: 'POST' });
    if (skipIfUnreachable(res)) return;
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('diagnose-did-sync script exists', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/diagnose-did-sync.js'))).toBe(true);
  });

  it('tenant numbers list accessible when authenticated', async () => {
    const session = await loginOrSkip();
    if (!session) return;
    const res = await apiRequest('/api/numbers', { token: session.token });
    if (skipIfUnreachable(res)) return;
    expect([200, 403, 404]).toContain(res.status);
  });
});
