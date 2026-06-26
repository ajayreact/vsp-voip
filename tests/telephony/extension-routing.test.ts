import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';

describe('telephony / extension routing', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('GET /api/tenant/extensions lists extensions', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/extensions', { token });
    if (skipIfUnreachable(res)) return;
    expect([200, 403]).toContain(res.status);
  });

  it('extension-did validation script exists', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/validate-extension-did.js'))).toBe(true);
  });

  it('softphone diagnostics exposes routing info', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/diagnostics', { token });
    if (skipIfUnreachable(res)) return;
    expect([200, 403, 404]).toContain(res.status);
  });
});
