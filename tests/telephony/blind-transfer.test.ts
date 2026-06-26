import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';

describe('telephony / blind transfer', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('POST /api/softphone/transfer/blind exists', async () => {
    const res = await apiRequest('/api/softphone/transfer/blind', {
      method: 'POST',
      body: {},
    });
    if (skipIfUnreachable(res)) return;
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('authenticated blind transfer rejects missing active call', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/transfer/blind', {
      method: 'POST',
      token,
      body: { destination: '+15551234567' },
    });
    if (skipIfUnreachable(res)) return;
    expect([400, 404, 422, 409]).toContain(res.status);
  });

  it('legacy validate:blind-transfer script is available', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/validate-blind-transfer.js'))).toBe(true);
  });
});
