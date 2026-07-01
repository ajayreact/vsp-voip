# VSP Phone V3 — Production Staging Readiness Review

**Date:** 2026-07-01  
**Scope:** Staging/production infrastructure for V3 through Phase 3.9.5 (frozen architecture)  
**Mode:** Read-only — no code, architecture, or configuration changes  
**Related:** [13-v3-final-go-no-go-review.md](./13-v3-final-go-no-go-review.md), [16-telephony-v3-worker.md](../deployment/16-telephony-v3-worker.md)

---

## Executive Summary

V3 **staging infrastructure is mostly ready** for a production-like canary environment. Docker Compose defines all required services, deploy scripts enforce API-before-worker ordering, health endpoints cover V3 dependencies, feature-flag defaults are safe (all off), and rollback documentation exists.

**Three FAIL items block production-grade staging without manual remediation:**

1. Postgres and Redis ports are **publicly bound** in `docker-compose.yml` (5432, 6379).
2. **`.env.example` omits all V3 variables** — staging operators lack a canonical env template.
3. **`deploy-api.sh` does not verify `/ready/v3`** — worker can be forgotten after API deploy.

**Overall staging verdict:** **CONDITIONAL PASS** — proceed after addressing FAIL items and completing WARNING checklist on the target host.

| Result | Count |
|--------|-------|
| **PASS** | 42 |
| **WARNING** | 18 |
| **FAIL** | 3 |

---

## 1. Docker Compose

**File:** `docker-compose.yml`

| Check | Result | Detail |
|-------|--------|--------|
| API service defined | **PASS** | Builds from `Dockerfile`, port 3000, `env_file: .env` |
| PostgreSQL 16 | **PASS** | `pgdata` volume, `pg_isready` healthcheck |
| Redis 7 | **PASS** | `redisdata` volume |
| `telephony-v3-worker` | **PASS** | Separate service, `entrypoint: []`, dedicated command |
| Worker depends on API healthy | **PASS** | Migrations complete before worker start |
| Worker `restart: unless-stopped` | **PASS** | Line 53 |
| API healthcheck → `/ready` | **PASS** | 30s interval, 30s start_period |
| Worker healthcheck → heartbeat script | **PASS** | `scripts/v3-worker-healthcheck.js` |
| Postgres healthcheck | **PASS** | `pg_isready` with retries |
| Internal service DNS overrides | **PASS** | `DATABASE_URL` / `REDIS_URL` use `postgres` / `redis` hostnames |
| API `restart` policy | **WARNING** | Worker has `unless-stopped`; **API has none** — container won't auto-restart on crash |
| Redis healthcheck | **WARNING** | No healthcheck; `depends_on: service_started` only (not `service_healthy`) |
| Postgres port exposure | **FAIL** | `"5432:5432"` — binds all interfaces; docs require no public exposure on EC2 |
| Redis port exposure | **FAIL** | `"6379:6379"` — same issue |
| API port binding | **WARNING** | `"3000:3000"` not `127.0.0.1:3000` — docs say bind localhost behind Nginx on EC2 |
| Dockerfile vs Compose healthcheck | **WARNING** | `Dockerfile` HEALTHCHECK uses `/health`; Compose overrides API to `/ready` — worker image inherits Dockerfile `/health` but Compose overrides worker to heartbeat script |
| Worker scaling | **WARNING** | Fixed `V3_WORKER_ID: worker-compose-1` in compose — scaling to 2 requires unsetting or per-replica IDs (documented in `16-telephony-v3-worker.md`) |

**Recommendations (ops, no code change required for staging on isolated host):**

- On EC2: remove `ports` for postgres/redis from security group; use Docker internal network only.
- Bind API to `127.0.0.1:3000:3000` when Nginx terminates TLS.
- Add `restart: unless-stopped` to `api` service (future change — noted only).
- For multi-worker staging: omit fixed `V3_WORKER_ID` or set per container.

---

## 2. Environment Variables

**Files:** `.env.example`, `lib/env.js`, `lib/telephony-v3/Utils/workerEnv.js`, `lib/telephony-v3/constants.js`, `lib/telephony-v3/README.md`

### Required for API (production)

| Variable | Validated by | In `.env.example` | Result |
|----------|--------------|-------------------|--------|
| `DATABASE_URL` | `lib/env.js` | Yes | **PASS** |
| `TELNYX_API_KEY` | `lib/env.js` | Yes | **PASS** |
| `TELNYX_PUBLIC_KEY` | `lib/env.js` (prod) | Yes | **PASS** |
| `JWT_SECRET` | `lib/env.js` (prod) | Yes | **PASS** |
| `SETTINGS_ENCRYPTION_KEY` | `lib/env.js` (prod) | Yes | **PASS** |
| `REDIS_URL` | `lib/env.js` (prod) | Yes | **PASS** |
| `API_PUBLIC_URL` | `lib/env.js` (prod) | Yes | **PASS** |
| `WEB_ORIGIN` / `ADMIN_ORIGIN` | `lib/env.js` (prod) | Yes | **PASS** |
| `STRIPE_WEBHOOK_SECRET` | `lib/env.js` (prod) | Yes | **PASS** |
| `SMTP_HOST` / `SMTP_FROM` | `lib/env.js` (prod) | Yes | **PASS** |

### Required for V3 worker (fail-fast)

| Variable | Validated by | In `.env.example` | Result |
|----------|--------------|-------------------|--------|
| `TELEPHONY_V3_GLOBAL` | `workerEnv.js` | **No** | **FAIL** |
| `TELEPHONY_V3_INGRESS_ENABLED` | `workerEnv.js` | **No** | **FAIL** |
| `TELEPHONY_V3_CALLMANAGER_ENABLED` | `workerEnv.js` | **No** | **FAIL** |
| `TELEPHONY_V3_EXECUTOR_ENABLED` | `workerEnv.js` | **No** | **FAIL** |
| `DATABASE_URL` | `workerEnv.js` | Yes | **PASS** |
| `REDIS_URL` | `workerEnv.js` | Yes | **PASS** |

### V3 optional / operational (documented in README, missing from `.env.example`)

| Variable | Default | Result |
|----------|---------|--------|
| `TELEPHONY_V3_REDIS_REQUIRED` | `true` | **WARNING** — not in `.env.example` |
| `TELEPHONY_V3_OUTBOX_PAUSED` | `false` | **WARNING** |
| `REDIS_REQUIRED` | unset | **WARNING** — platform prod flag; not in `.env.example` |
| `V3_WORKER_ID` | `worker-<HOSTNAME>` | **WARNING** |
| `V3_OUTBOX_POLL_MS` | `500` | **WARNING** |
| `V3_QUEUE_LAG_MAX_MS` | `60000` | **WARNING** |
| `V3_DLQ_DEPTH_MAX` | `1000` | **WARNING** |
| `V3_OUTBOX_DEAD_MAX` | `100` | **WARNING** |
| `V3_PROCESSED_EVENT_RETENTION_DAYS` | `30` | **WARNING** |
| `V3_METRICS_REDIS_MIRROR` | `true` | **WARNING** |
| `OTEL_ENABLED` | `false` | **WARNING** |
| `V3_WORKER_SKIP_ENV_VALIDATE` | — | **WARNING** — test-only; must never be set in staging/prod |

### Duplicated / inconsistent

| Issue | Files | Result |
|-------|-------|--------|
| `REDIS_REQUIRED` (platform `/ready`) vs `TELEPHONY_V3_REDIS_REQUIRED` (V3 fail-closed) | `lib/health.js`, `lib/telephony-v3/Redis/requireRedis.js` | **WARNING** — two flags; staging must set both `true` |
| `ENCRYPTION_KEY` referenced in deployment checklist vs `SETTINGS_ENCRYPTION_KEY` in code | `docs/vsp/phase3/06-deployment-checklist.md`, `lib/env.js` | **WARNING** — doc uses wrong name |
| `getGlobalFlagStatus()` omits `callManagerEnabled` | `lib/telephony-v3/FeatureFlags/featureFlagService.js` vs `lib/telephony-v3/README.md` | **WARNING** — `/ready/v3` featureFlags incomplete vs docs |

### Deprecated / unused

| Item | File | Result |
|------|------|--------|
| `persistProcessedEvent` | `lib/telephony-v3/WebhookGateway/gateway.js` | **WARNING** — deprecated alias; use `markWebhookProcessed` |
| `HEALTH.OUTBOX_PROCESSING_STALE_SEC` | `lib/telephony-v3/constants.js` | **WARNING** — defined, never wired to health |
| `V3_WORKER_SKIP_ENV_VALIDATE` | `workerEnv.js` | **WARNING** — exists for tests only |

### Safe defaults

| Layer | Default | Result |
|-------|---------|--------|
| All `TELEPHONY_V3_*` env flags | `false` if unset | **PASS** |
| Prisma `V3FeatureFlag.*` | `@default(false)` | **PASS** |
| `DEFAULT_FLAGS` in code | all `false` | **PASS** |

**Recommendation:** Maintain a staging `.env` template (copy from `lib/telephony-v3/README.md` env table) until `.env.example` is updated in a future increment.

---

## 3. Deployment Scripts

**Files:** `deploy/deploy-api.sh`, `deploy/deploy-v3-worker.sh`, `scripts/docker-entrypoint.sh`

| Check | Result | Detail |
|-------|--------|--------|
| Migrations on API start | **PASS** | `scripts/docker-entrypoint.sh` runs `prisma migrate deploy` |
| Worker skips migrations | **PASS** | Worker uses `entrypoint: []` — no duplicate migrate |
| Deploy order documented | **PASS** | `docs/vsp/deployment/02-ec2-deployment.md` — Git → DB → API → Worker → Web → Verify |
| `deploy-api.sh` waits for `/ready` | **PASS** | 30×2s loop |
| `deploy-v3-worker.sh` waits for API then `/ready/v3` | **PASS** | Checks `workers.activeCount > 0` |
| `deploy-api.sh` mentions V3 worker follow-up | **PASS** | Line 103 |
| `deploy-api.sh` does not auto-deploy worker | **WARNING** | Easy to omit worker after API-only deploy |
| `deploy-api.sh` does not check `/ready/v3` | **FAIL** | API can report ready while V3 worker absent |
| Hardcoded `REQUIRED_COMMIT` gate | **WARNING** | May block legitimate V3 releases if not updated |
| `validate:migrations` in CI | **PASS** | `.github/workflows/ci.yml` |
| `validate:v3-worker` script exists | **PASS** | `scripts/validate-v3-worker-production.js` |

**Correct deployment order (verified):**

```
1. prisma migrate deploy  (api entrypoint)
2. API container healthy  (/ready)
3. telephony-v3-worker    (heartbeat → /ready/v3)
4. Health verification    (/ready + /ready/v3 + /metrics/v3)
```

---

## 4. Health Endpoints

**Files:** `server.js`, `lib/health.js`, `lib/telephony-v3/Health/healthService.js`

### `GET /health`

| Check | Result |
|-------|--------|
| Liveness (uptime) | **PASS** |
| Dependency checks | **PASS** — intentionally minimal |
| Used by Dockerfile default HEALTHCHECK | **PASS** |

### `GET /ready`

| Dependency | Checked | Result |
|------------|---------|--------|
| PostgreSQL | Yes | **PASS** |
| Redis | Yes (optional if `REDIS_REQUIRED` false) | **PASS** |
| Telnyx API key | Yes | **PASS** |
| Stripe config | Yes | **PASS** |
| SMTP | Yes (optional skip) | **PASS** |
| `GIT_COMMIT` in response | Yes | **PASS** |
| V3 worker | **No** | **WARNING** — platform ready ≠ V3 ready |

### `GET /ready/v3`

| Dependency | Checked | Result |
|------------|---------|--------|
| PostgreSQL | Yes | **PASS** |
| Redis (when `TELEPHONY_V3_REDIS_REQUIRED`) | Yes | **PASS** |
| Active worker heartbeats | Yes (required in production) | **PASS** |
| Ingress queue depth / lag | Yes | **PASS** |
| DLQ depth | Yes | **PASS** |
| Outbox dead count | Yes | **PASS** |
| Global feature flags snapshot | Partial | **WARNING** — missing `callManagerEnabled` |
| Stale PROCESSING outbox rows | No | **WARNING** — `OUTBOX_PROCESSING_STALE_SEC` unused |
| Telnyx connectivity | No | **PASS** — intentional (V3 scope) |

### `GET /metrics/v3`

| Check | Result |
|-------|--------|
| Prometheus text format | **PASS** |
| Unauthenticated | **WARNING** — restrict via Nginx/firewall on staging/prod |
| No generic `/metrics` | **PASS** — V3-specific endpoint only |

---

## 5. Logging

**Files:** `lib/telephony-v3/Utils/v3Logger.js`, `lib/logger.js`, V3 module log call sites

| Check | Result | Detail |
|-------|--------|--------|
| Structured JSON logs | **PASS** | `v3.log.v1` schema via `lib/logger.js` |
| `traceId` on ingress | **PASS** | `gateway.js` |
| `correlationId` on ingress | **PASS** | `gateway.js`, HTTP response |
| `workerId` on worker/CallManager | **PASS** | `callManager.js`, `ingressWorker.js`, `telephony-v3-worker.js` |
| `sessionId` on FSM/command paths | **PASS** | `callPersistence.js`, `commandBus.js`, sidecars |
| `tenantId` on hot path logs | **WARNING** | Present in `domainEventBus.js`; **not consistently** on `callmanager.processed` |
| Full webhook body logged | **PASS** — not logged | Payload stored in Redis only |
| Secrets in V3 logs | **PASS** | No password/JWT/API key logging found in `lib/telephony-v3/` |
| Production log volume | **WARNING** | `v3Logger.info` on every ingress/FSM/event — set `LOG_LEVEL=warn` on workers in staging/prod |
| OpenTelemetry | **WARNING** | `OTEL_ENABLED=false` default; spans only when enabled |

---

## 6. Monitoring

**File:** `lib/telephony-v3/Utils/metrics.js`, `lib/telephony-v3/Health/healthService.js`

### Metrics present

| Area | Metrics | Result |
|------|---------|--------|
| **Redis** | `redis_unavailable_total` | **PASS** |
| **Ingress/Streams** | `ingress_*`, `ingress_queue_depth`, `ingress_dlq_depth` | **PASS** |
| **Workers** | `worker_processed_total`, `worker_failed_total`, `worker_process_duration_seconds` | **PASS** |
| **Outbox** | `outbox_*`, `outbox_pending`, `outbox_processing` gauges | **PASS** |
| **Executor** | `commands_*`, `command_*`, `executor_lease_renewal_total` | **PASS** |
| **Routing** | `desk_*`, `mobile_*`, `pstn_*` | **PASS** |
| **Sidecars** | hold, transfer, recording, voicemail, conference, queue, ivr | **PASS** |
| **Timers** | `timer_execution_total` | **PASS** |
| **Other** | FSM, policy, tenant bootstrap, replay, cleanup | **PASS** |

### Missing production metrics (gaps)

| Metric | Impact | Result |
|--------|--------|--------|
| Active worker count (Prometheus gauge) | Only in `/ready/v3` JSON | **WARNING** |
| Stream pending count (PEL size) gauge | In health JSON only | **WARNING** |
| Redis lock wait / timeout counter | Lock contention invisible | **WARNING** |
| Session/leg cache hit rate | Cache bypass undetected | **WARNING** |
| PG query latency / pool utilization | Connection pressure invisible | **WARNING** |
| Timer scheduled / expired counts | Only execution total | **WARNING** |
| `/metrics/v3` not in `13-monitoring.md` main table | Ops may miss scrape target | **WARNING** |

**Recommendation:** Scrape `GET /metrics/v3` from internal network; alert on gauges already updated by `/ready/v3` probes (`ingress_queue_depth`, `outbox_pending`, `ingress_dlq_depth`).

---

## 7. Feature Flags

**Files:** `lib/telephony-v3/FeatureFlags/featureFlagService.js`, `prisma/schema.prisma`

| Flag | DB default | Code default | Requires `engineEnabled` | Result |
|------|------------|--------------|--------------------------|--------|
| `engineEnabled` | `false` | `false` | — | **PASS** |
| `deskEnabled` | `false` | `false` | Yes | **PASS** |
| `mobileEnabled` | `false` | `false` | Yes | **PASS** |
| `pstnEnabled` | `false` | `false` | Yes | **PASS** |
| `holdEnabled` | `false` | `false` | Yes | **PASS** |
| `transferEnabled` | `false` | `false` | Yes | **PASS** |
| `recordingEnabled` | `false` | `false` | Yes | **PASS** |
| `voicemailEnabled` | `false` | `false` | Yes | **PASS** |
| `conferenceEnabled` | `false` | `false` | Yes | **PASS** |
| `queueEnabled` | `false` | `false` | Yes | **PASS** |
| `ivrEnabled` | `false` | `false` | Yes | **PASS** |

**Global env gates (all default safe-off):**

| Flag | Result |
|------|--------|
| `TELEPHONY_V3_GLOBAL` | **PASS** — must be `true` for any V3 processing |
| `TELEPHONY_V3_INGRESS_ENABLED` | **PASS** |
| `TELEPHONY_V3_CALLMANAGER_ENABLED` | **PASS** |
| `TELEPHONY_V3_EXECUTOR_ENABLED` | **PASS** |
| `TELEPHONY_V3_OUTBOX_PAUSED` | **PASS** — emergency stop |

**`isEnabled()` chain:** global → `engineEnabled` → specific flag — **PASS**.

---

## 8. Rollback

**Files:** `docs/vsp/deployment/08-rollback.md`, `docs/vsp/deployment/16-telephony-v3-worker.md`, `docs/vsp/phase3/13-v3-final-go-no-go-review.md`

| Scenario | Documented | Result |
|----------|------------|--------|
| Feature flag rollback (`engineEnabled=false`, env flags) | Yes — doc 16, doc 13 | **PASS** |
| Deployment rollback (git checkout + redeploy) | Yes — `08-rollback.md` | **PASS** |
| Worker-only rollback | Yes — doc 16 | **PASS** |
| API + worker combined rollback | Yes — `08-rollback.md` lines 56–63 | **PASS** |
| Migration rollback (restore backup) | Yes — `08-rollback.md` | **PASS** |
| `/ready/v3` in rollback verification | Partial | **WARNING** — doc 08 checklist omits `/ready/v3`; doc 16 includes it |
| Telnyx webhook URL revert | Yes — doc 08 | **PASS** |
| Stop worker without stopping ingress enqueue | Yes — doc 16 | **PASS** |

---

## 9. Security

**Files:** `server.js`, `lib/env.js`, `lib/telnyxVerify.js`, `docker-compose.yml`

| Check | Result | Detail |
|-------|--------|--------|
| JWT validation in production | **PASS** | Non-default secret required (`lib/env.js`) |
| Telnyx webhook signature | **PASS** | `verifyTelnyxWebhookMiddleware` on V3 route |
| V3 fail-closed without Redis | **PASS** | `TELEPHONY_V3_REDIS_REQUIRED` default true |
| CORS restricted origins | **WARNING** | LAN regex `192.168.*:3001` allowed (`server.js:77`) |
| Webhook rate limiting on V3 | **PASS** | No limiter on telephony webhooks (consistent with legacy `/webhook/call-control`) — Telnyx burst-friendly |
| Billing webhooks rate limited | **PASS** | `webhookLimiter` on Stripe/Razorpay |
| Postgres credentials in compose | **WARNING** | Default `vsp:vsp` — acceptable for local staging only |
| Redis no auth in compose | **WARNING** | No `requirepass` — OK on internal Docker network; **FAIL** if port 6379 public |
| `/metrics/v3` exposure | **WARNING** | No auth — restrict at Nginx |
| Secrets in `.env.example` | **PASS** | Placeholders only |
| `helmet` middleware | **PASS** | Enabled on API |

---

## 10. Documentation vs Codebase

| Document | Matches code | Result |
|----------|--------------|--------|
| `lib/telephony-v3/README.md` | Yes | **PASS** |
| `docs/vsp/deployment/16-telephony-v3-worker.md` | Yes — matches `docker-compose.yml` | **PASS** |
| `docs/vsp/deployment/02-ec2-deployment.md` | Yes — deploy order | **PASS** |
| `docs/vsp/deployment/03-docker.md` | Yes — warns on port exposure | **PASS** (code doesn't match best practice) |
| `docs/vsp/deployment/08-rollback.md` | Mostly | **WARNING** — missing `/ready/v3` in checklist |
| `docs/vsp/deployment/13-monitoring.md` | Partial | **WARNING** — `/ready/v3` and `/metrics/v3` underdocumented |
| `.env.example` | No | **FAIL** — missing all V3 and `REDIS_REQUIRED` vars |
| `docs/vsp/phase3/06-deployment-checklist.md` | Partial | **WARNING** — `ENCRYPTION_KEY` vs `SETTINGS_ENCRYPTION_KEY` |

---

## Staging Pre-Flight Checklist (Manual)

Before promoting staging to production-like validation:

```
☐ Copy V3 env block from lib/telephony-v3/README.md into staging .env
☐ Set all TELEPHONY_V3_* explicitly (true/false — worker requires presence)
☐ Set REDIS_REQUIRED=true and TELEPHONY_V3_REDIS_REQUIRED=true
☐ Remove public postgres/redis ports on EC2 (or don't map in override compose)
☐ export GIT_COMMIT=$(git rev-parse HEAD)
☐ bash deploy/deploy-api.sh
☐ bash deploy/deploy-v3-worker.sh
☐ curl -s http://127.0.0.1:3000/ready | jq .ready
☐ curl -s http://127.0.0.1:3000/ready/v3 | jq '.ready, .workers, .checks'
☐ curl -s http://127.0.0.1:3000/metrics/v3 | head -20
☐ npm run validate:v3-worker  (VALIDATE_V3_WORKER_RUNTIME=true when stack up)
☐ npm run test:v3
☐ Configure Telnyx canary app → POST /webhook/v3/call-control only
☐ Enable engineEnabled for one staging tenant only
```

---

## Summary by Section

| Section | PASS | WARNING | FAIL |
|---------|------|---------|------|
| 1. Docker Compose | 9 | 4 | 2 |
| 2. Environment Variables | 12 | 14 | 4 (V3 vars missing from `.env.example`) |
| 3. Deployment Scripts | 7 | 2 | 1 |
| 4. Health Endpoints | 14 | 4 | 0 |
| 5. Logging | 7 | 3 | 0 |
| 6. Monitoring | 8 | 7 | 0 |
| 7. Feature Flags | 17 | 0 | 0 |
| 8. Rollback | 7 | 1 | 0 |
| 9. Security | 7 | 5 | 0* |
| 10. Documentation | 4 | 3 | 1 |

\* Security FAIL for public Redis/Postgres ports counted under Docker Compose.

---

## Final Staging Readiness Verdict

**CONDITIONAL PASS**

Proceed with production-like staging after:

1. **FAIL:** Restrict Postgres/Redis port exposure on the staging host.
2. **FAIL:** Create staging `.env` with all V3 variables (until `.env.example` updated).
3. **FAIL:** Always run `deploy-v3-worker.sh` after `deploy-api.sh`; verify `/ready/v3`.
4. **WARNING:** Add `restart: unless-stopped` to API (ops or future compose change).
5. **WARNING:** Set `LOG_LEVEL=warn` on worker containers.
6. **WARNING:** Restrict `/metrics/v3` to internal scrape only.

No telephony business logic, architecture, or schema changes required for staging readiness — **infrastructure and documentation gaps only**.
