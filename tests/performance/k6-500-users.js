/**
 * k6 — 500 virtual users (growth tier).
 * Run: k6 run tests/performance/k6-500-users.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';

export const options = {
  vus: 500,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.08'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const res = http.get(`${API_BASE}/health`);
  check(res, { 'health ok': (r) => r.status === 200 });
  sleep(0.5);
}
