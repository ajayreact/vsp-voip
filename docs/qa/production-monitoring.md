# Production Monitoring Recommendations

QA and operations guidance for VSP Phone production. No application code changes required — configure infrastructure and observability around existing endpoints.

---

## 1. Health checks

### Liveness — `GET /health`

- **Purpose:** Process is running; use for container/orchestrator liveness probes.
- **Expected:** HTTP 200, `{ "status": "ok", "uptimeSeconds": <number> }`
- **Alert:** Any non-200 for 2+ consecutive checks (30s interval).

### Readiness — `GET /ready`

- **Purpose:** Traffic routing; verifies DB, Redis (when required), Telnyx key, SMTP.
- **Expected:** HTTP 200 when fully ready; 503 when degraded.
- **Alert:** 503 for > 5 minutes or database disconnected.

**Docker / Kubernetes example:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  periodSeconds: 15
  failureThreshold: 3
```

**Post-deploy smoke:**

```bash
API_BASE=https://api.example.com npm run smoke:deploy
```

---

## 2. Logging

### Structured application logs

Ensure production log aggregation captures:

- HTTP 5xx responses with request path and correlation ID
- Telnyx webhook processing errors (`/webhook/*`)
- Auth failures spike (`POST /api/auth/login` 401 rate)
- Prisma / database connection errors from `/ready`

### Recommended log fields

| Field | Source |
|-------|--------|
| `gitCommit` | `/ready` → `build.gitCommit` |
| `nodeEnv` | `/ready` → `build.nodeEnv` |
| `requestId` | Reverse proxy / middleware |
| `tenantId` | JWT claims on authenticated routes |

### Retention

- **Hot:** 7–14 days (debugging, incident response)
- **Warm:** 90 days (audit, billing disputes)
- **Cold:** 1 year for admin audit (`GET /api/admin/audit-log` exports if needed)

---

## 3. Telemetry & metrics

### API metrics (RED method)

| Metric | Routes |
|--------|--------|
| Rate | Requests/sec per route group |
| Errors | 4xx/5xx ratio per route |
| Duration | p50/p95 latency |

**Priority route groups for dashboards:**

- `/api/auth/*`
- `/api/softphone/*`
- `/api/conversations`, `/api/messages/*`
- `/webhook/*` (Telnyx inbound)

### Telephony-specific

- Admin endpoint: `GET /api/admin/telephony-health` (SUPER_ADMIN JWT)
- Admin endpoint: `GET /api/admin/monitoring/platform-health`
- Telnyx status: `GET /api/admin/telnyx/status`

### Mobile / client telemetry

- Existing route: `POST /api/softphone/telemetry` — aggregate client-reported events in log pipeline.

---

## 4. Alerting

### Critical (page immediately)

| Condition | Action |
|-----------|--------|
| `/ready` 503 > 5 min | Check DB, Redis, Telnyx key |
| Error rate > 5% on `/webhook/voice` | Telnyx connectivity / signature issues |
| Database latency > 2s (from `/ready`) | Scale or investigate DB |
| Disk / memory > 90% on API hosts | Scale or restart |

### Warning (ticket / Slack)

| Condition | Action |
|-----------|--------|
| `/api/auth/login` 401 rate 3× baseline | Possible credential attack |
| Messaging send 5xx > 1% | Telnyx SMS/MMS or attachment storage |
| Redis unavailable when `REDIS_REQUIRED=true` | Session/refresh token impact |
| Web build failures in CI | Block deploy |

### Synthetic checks (recommended)

Schedule every 5 minutes:

1. `GET /health`
2. `GET /ready`
3. Login + `GET /api/conversations` (use dedicated monitor account)

Use `npm run smoke:deploy` or external uptime monitor with same paths.

---

## 5. Load & capacity

### Baseline load tests

```bash
# Health baseline
npm run qa:perf:100

# Messaging read path
npm run qa:perf:messaging
```

### Thresholds (starting points)

| Scenario | VUs | p95 latency | Error rate |
|----------|-----|-------------|------------|
| Health | 100 | < 2s | < 5% |
| Messaging reads | 50 | < 3s | < 10% |

Run before major releases or tenant onboarding spikes.

---

## 6. Incident runbook hooks

1. **Deploy regression:** `npm run smoke:deploy` against production API (read-only).
2. **Full QA:** `API_BASE=... npm run qa` with production monitor credentials.
3. **Rollback trigger:** `/ready` unhealthy + elevated 5xx on softphone or webhook routes.
4. **Communication:** Include `build.gitCommit` from `/ready` in incident notes.

---

## 7. Security monitoring

- Rate-limit alerts on `POST /api/auth/login` and `POST /api/auth/forgot-password`
- Monitor `GET /api/messages/attachments/:id/download` for abnormal volume (MMS abuse)
- Admin audit: `GET /api/admin/audit-log` weekly review
- JWT secret rotation procedure documented outside this repo

---

## Related automation

| Asset | Location |
|-------|----------|
| CI workflow | `.github/workflows/qa-automation.yml` |
| Release checklist | `docs/qa/release-checklist.md`, `npm run release:checklist` |
| Smoke script | `scripts/smoke-deploy.js` |
| k6 messaging | `tests/performance/k6-messaging*.js` |
