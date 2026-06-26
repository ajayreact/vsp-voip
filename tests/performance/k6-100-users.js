/**
 * k6 load test — 100 concurrent virtual users (health/readiness).
 * Requires: k6 installed (https://k6.io)
 * Run: k6 run tests/performance/k6-100-users.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';

export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const health = http.get(`${API_BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const ready = http.get(`${API_BASE}/ready`);
  check(ready, { 'ready responds': (r) => r.status === 200 || r.status === 503 });

  sleep(1);
}
