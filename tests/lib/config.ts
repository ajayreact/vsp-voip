/**
 * QA environment configuration — no production code imports.
 */
export const config = {
  apiBase: (process.env.API_BASE || process.env.API_URL || 'http://localhost:3000').replace(/\/$/, ''),
  webBase: (process.env.WEB_BASE || process.env.WEB_URL || 'http://localhost:3001').replace(/\/$/, ''),
  email: process.env.QA_EMAIL || process.env.EMAIL || 'admin@asuitech.com',
  password: process.env.QA_PASSWORD || process.env.PASSWORD || 'Admin@123',
  liveCalls: process.env.QA_LIVE_CALLS === 'true',
  liveWebRtc: process.env.QA_LIVE_WEBRTC === 'true',
  superAdmin: process.env.QA_SUPER_ADMIN === 'true',
};

export function skipUnlessLiveCalls(reason: string): boolean {
  if (!config.liveCalls) {
    console.log(`[skip] ${reason} — set QA_LIVE_CALLS=true`);
    return true;
  }
  return false;
}

export function skipUnlessLiveWebRtc(reason: string): boolean {
  if (!config.liveWebRtc) {
    console.log(`[skip] ${reason} — set QA_LIVE_WEBRTC=true`);
    return true;
  }
  return false;
}
