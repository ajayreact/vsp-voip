/**
 * k6 — 1000 virtual users (scale tier). Run against staging only.
 * Run: k6 run tests/performance/k6-1000-users.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '2m', target: 500 },
    { duration: '3m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const res = http.get(`${API_BASE}/ready`);
  check(res, { 'ready': (r) => r.status === 200 || r.status === 503 });
  sleep(0.3);
}
