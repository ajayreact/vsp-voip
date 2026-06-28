/**
 * k6 load test — messaging API read path.
 * Requires: k6 (https://k6.io), API running, QA credentials in env.
 *
 * Run:
 *   API_BASE=http://localhost:3000 QA_EMAIL=... QA_PASSWORD=... k6 run tests/performance/k6-messaging.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = (__ENV.API_BASE || 'http://localhost:3000').replace(/\/$/, '');
const QA_EMAIL = __ENV.QA_EMAIL || __ENV.EMAIL || 'admin@asuitech.com';
const QA_PASSWORD = __ENV.QA_PASSWORD || __ENV.PASSWORD || 'Admin@123';

export const options = {
  scenarios: {
    messaging_reads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000'],
    checks: ['rate>0.90'],
  },
};

export function setup() {
  const loginRes = http.post(
    `${API_BASE}/api/auth/login`,
    JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.body}`);
  }

  const body = loginRes.json();
  if (!body.accessToken) {
    throw new Error('Login response missing accessToken');
  }

  return { token: body.accessToken };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    Accept: 'application/json',
  };

  const conversations = http.get(`${API_BASE}/api/conversations`, { headers });
  check(conversations, {
    'conversations 200': (r) => r.status === 200,
    'conversations json': (r) => {
      try {
        const parsed = r.json();
        return parsed.success === true && Array.isArray(parsed.conversations);
      } catch {
        return false;
      }
    },
  });

  const legacy = http.get(`${API_BASE}/api/sms/conversations`, { headers });
  check(legacy, { 'legacy sms conversations 200': (r) => r.status === 200 });

  const config = http.get(`${API_BASE}/api/sms/config`, { headers });
  check(config, { 'sms config 200': (r) => r.status === 200 });

  sleep(0.5);
}
