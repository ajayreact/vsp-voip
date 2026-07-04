/**
 * k6 — 5000 virtual users (enterprise planning). Staging/load lab ONLY.
 * Run: API_BASE=https://staging.api.example.com k6 run tests/performance/k6-5000-users.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '3m', target: 1000 },
    { duration: '5m', target: 5000 },
    { duration: '3m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.15'],
  },
};

export default function () {
  const res = http.get(`${API_BASE}/health`);
  check(res, { 'health': (r) => r.status === 200 });
  sleep(0.2);
}
