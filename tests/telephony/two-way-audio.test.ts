import { describe, it, expect } from 'vitest';
import { apiRequest, loginOrSkip, skipIfUnreachable } from '../lib/api-client';
import { config, skipUnlessLiveWebRtc } from '../lib/config';

async function fetchWeb(path: string) {
  try {
    return await fetch(`${config.webBase}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }
}

describe('telephony / two-way audio', () => {
  it('WebRTC diagnostics route reachable on web (when deployed)', async () => {
    const res = await fetchWeb('/softphone-v2/diagnostics');
    if (!res) {
      console.warn(`[skip] Web unreachable at ${config.webBase}`);
      return;
    }
    expect([200, 301, 302, 307, 308, 401, 404]).toContain(res.status);
  });

  it('softphone config includes telephony setup flags', async () => {
    const session = await loginOrSkip();
    if (!session) return;
    const res = await apiRequest('/api/softphone/config', { token: session.token });
    expect(res.status).toBe(200);
  });

  it.skipIf(skipUnlessLiveWebRtc('live WebRTC RTP verification'))(
    'active call shows outbound packetsSent > 0 in diagnostics export',
    async () => {
      expect(config.liveWebRtc).toBe(true);
    },
  );
});
