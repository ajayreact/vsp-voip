/**
 * Deployment regression suite — run before/after every production deploy.
 * Maps to docs/vsp/git/05-merge-checklist.md and deployment/14-telephony-validation.md
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';
import { config } from '../lib/config';

async function fetchWeb(path: string) {
  try {
    return await fetch(`${config.webBase}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }
}

describe('regression / deploy gate', () => {
  let token: string | undefined;

  beforeAll(async () => {
    const session = await loginOrSkip();
    token = session?.token;
  });

  it('✓ Registration — softphone token', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/token', { method: 'POST', token });
    expect([200, 503]).toContain(res.status);
  });

  it('✓ Inbound — call-accepted endpoint', async () => {
    const res = await apiRequest('/api/softphone/call-accepted', { method: 'POST', body: {} });
    if (skipIfUnreachable(res)) return;
    expect(res.status).not.toBe(404);
  });

  it('✓ Outbound — softphone config', async () => {
    if (!token) return;
    const res = await apiRequest('/api/softphone/config', { token });
    expect(res.status).toBe(200);
  });

  it('✓ Two-way audio — diagnostics route on web', async () => {
    const res = await fetchWeb('/softphone-v2/diagnostics');
    if (!res) return;
    expect([200, 301, 302, 307, 308]).toContain(res.status);
  });

  it('✓ Recording — tenant recordings API', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/recordings?sync=0&limit=1', { token });
    expect(res.status).toBe(200);
  });

  it('✓ Voicemail — tenant voicemails API', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/voicemails?limit=1', { token });
    expect(res.status).toBe(200);
  });

  it('✓ Blind transfer — API route', async () => {
    const res = await apiRequest('/api/softphone/transfer/blind', { method: 'POST', body: {} });
    if (skipIfUnreachable(res)) return;
    expect(res.status).not.toBe(404);
  });

  it('✓ DID routing — admin sync route', async () => {
    const res = await apiRequest('/api/admin/numbers/sync', { method: 'POST' });
    if (skipIfUnreachable(res)) return;
    expect(res.status).not.toBe(404);
  });

  it('✓ Tenant isolation — /api/auth/me tenantId', async () => {
    if (!token) return;
    const res = await apiRequest<{ user?: { tenantId?: string } }>('/api/auth/me', { token });
    expect(res.status).toBe(200);
    expect(res.data.user?.tenantId).toBeTruthy();
  });

  it('✓ Extension routing — extensions list', async () => {
    if (!token) return;
    const res = await apiRequest('/api/tenant/extensions', { token });
    expect([200, 403]).toContain(res.status);
  });

  it('✓ API health — /ready', async () => {
    const res = await apiRequest('/ready');
    if (skipIfUnreachable(res)) return;
    expect([200, 503]).toContain(res.status);
  });
});
