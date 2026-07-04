/**
 * k6 smoke — messaging API (low concurrency, CI-friendly).
 * Run: API_BASE=http://localhost:3000 QA_EMAIL=... QA_PASSWORD=... k6 run tests/performance/k6-messaging-smoke.js
 */
import http from 'k6/http';
import { check } from 'k6';

const API_BASE = (__ENV.API_BASE || 'http://localhost:3000').replace(/\/$/, '');
const QA_EMAIL = __ENV.QA_EMAIL || __ENV.EMAIL || 'admin@asuitech.com';
const QA_PASSWORD = __ENV.QA_PASSWORD || __ENV.PASSWORD || 'Admin@123';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

export function setup() {
  const loginRes = http.post(
    `${API_BASE}/api/auth/login`,
    JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (loginRes.status !== 200) {
    console.warn(`Login skipped/failed (${loginRes.status}) — anonymous probes only`);
    return { token: null };
  }
  return { token: loginRes.json('accessToken') };
}

export default function (data) {
  const health = http.get(`${API_BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  if (!data.token) {
    const anon = http.get(`${API_BASE}/api/conversations`);
    check(anon, { 'conversations requires auth': (r) => r.status === 401 });
    return;
  }

  const headers = { Authorization: `Bearer ${data.token}` };
  const conversations = http.get(`${API_BASE}/api/conversations`, { headers });
  check(conversations, { 'conversations 200': (r) => r.status === 200 });
}
