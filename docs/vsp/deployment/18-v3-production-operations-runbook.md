# VSP Phone V3 — Production Operations Runbook

**Version:** Phase 3.9.5 (frozen architecture)  
**Audience:** Platform / telephony operators on EC2  
**Host path:** `/opt/vsp-voip`  
**Mode:** Documentation only — no architecture or code changes

V3 runs **in parallel** with legacy Call Control. Canary tenants use a **separate Telnyx application** and webhook URL (`/webhook/v3/call-control`). Legacy tenants remain on `/webhook/call-control`.

---

## Quick reference

| Item | Value |
|------|-------|
| V3 webhook | `POST https://api.<domain>/webhook/v3/call-control` |
| Legacy webhook | `POST https://api.<domain>/webhook/call-control` |
| Platform readiness | `GET /ready` |
| V3 readiness | `GET /ready/v3` |
| V3 metrics | `GET /metrics/v3` (internal scrape only) |
| Worker service | `telephony-v3-worker` |
| Worker heartbeat TTL | 30 seconds |
| Deploy API | `bash deploy/deploy-api.sh` |
| Deploy worker | `bash deploy/deploy-v3-worker.sh` |

**Related docs:** [16-telephony-v3-worker.md](./16-telephony-v3-worker.md), [08-rollback.md](./08-rollback.md), [13-monitoring.md](./13-monitoring.md), [02-ec2-deployment.md](./02-ec2-deployment.md), [13-v3-final-go-no-go-review.md](../phase3/13-v3-final-go-no-go-review.md)

---

## 1. Deployment

### 1.1 Pre-deploy checklist

```bash
cd /opt/vsp-voip
git fetch origin main
git log -1 --oneline
cp .env .env.backup-$(date +%Y%m%d-%H%M)
docker compose exec postgres pg_dump -U vsp vsp_voip > ~/backups/vsp-pre-v3-$(date +%Y%m%d).sql
```

Verify `.env` includes all V3 variables (see `.env.example`). Minimum for worker startup:

```env
TELEPHONY_V3_GLOBAL=true|false          # must be set
TELEPHONY_V3_INGRESS_ENABLED=true|false
TELEPHONY_V3_CALLMANAGER_ENABLED=true|false
TELEPHONY_V3_EXECUTOR_ENABLED=true|false
TELEPHONY_V3_REDIS_REQUIRED=true
REDIS_REQUIRED=true
DATABASE_URL=...
REDIS_URL=...
```

Optional validation before deploy (workstation or CI):

```bash
npm run validate:migrations
npm run test:v3
```

---

### 1.2 Prisma migrations

Migrations run **only on the API container** at startup (`scripts/docker-entrypoint.sh` → `prisma migrate deploy`).

**Order rule:** API must start (and migrate) **before** the worker.

```bash
# Manual check after API start
docker compose exec api npx prisma migrate status
```

| Step | Action |
|------|--------|
| 1 | Take `pg_dump` backup (above) |
| 2 | Deploy API — migrations apply automatically |
| 3 | Confirm `migrate status` shows no pending migrations |
| 4 | Deploy worker |

**Never** run `prisma migrate deploy` on the worker container.

If migration fails: stop API, restore backup, see [§7 Migration rollback](#7-rollback) and [12-disaster-recovery.md](./12-disaster-recovery.md).

---

### 1.3 API deployment

```bash
cd /opt/vsp-voip
export GIT_COMMIT="$(git rev-parse HEAD)"
bash deploy/deploy-api.sh
```

Script actions:

1. Git pull / checkout
2. `docker compose up -d --build api`
3. Wait for `/ready` (HTTP 200)
4. Check `/ready/v3` — **fails deploy** if V3 env flags are enabled but `workers.activeCount === 0`
5. Route smoke probes (`call-accepted`, admin sync)

Manual equivalent:

```bash
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose up -d --build api
curl -sf http://127.0.0.1:3000/ready | jq .
```

---

### 1.4 Worker deployment

Run **after** API is healthy and migrations applied:

```bash
cd /opt/vsp-voip
bash deploy/deploy-v3-worker.sh
```

Script actions:

1. Ensures API `/ready` OK
2. `docker compose up -d --build telephony-v3-worker`
3. Waits for `/ready/v3` with `workers.activeCount >= 1`

Manual equivalent:

```bash
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose up -d --build telephony-v3-worker
curl -s http://127.0.0.1:3000/ready/v3 | jq '.workers, .checks'
docker compose ps telephony-v3-worker
```

Post-deploy validation:

```bash
VALIDATE_V3_WORKER_RUNTIME=true npm run validate:v3-worker
docker compose logs telephony-v3-worker --tail=50 | grep telephony_v3_worker.boot
```

---

### 1.5 Rollback order (deployments)

When reverting a bad release, roll back in **reverse dependency order**:

```
1. Stop accepting new V3 traffic (optional, immediate)
      TELEPHONY_V3_INGRESS_ENABLED=false  OR  tenant engineEnabled=false
2. Worker          → git checkout <good-sha> → deploy-v3-worker.sh
3. API             → git checkout <good-sha> → deploy-api.sh
4. Database        → restore pg_dump ONLY if migration corrupted data
5. Telnyx          → revert pilot DID to legacy Call Control app
6. Frontend        → only if portal changed (deploy-web.sh)
```

**Rule:** If schema migration was bad, restore DB **before** redeploying API at matching commit.

See [§7 Rollback](#7-rollback) for detailed procedures.

---

## 2. Canary rollout

### 2.1 Phases overview

| Phase | Global env | Tenant flags | Telnyx | Duration |
|-------|------------|--------------|--------|----------|
| **P0 Shadow** | All `TELEPHONY_V3_*=true` | None (`engineEnabled=false`) | No DID on V3 app | 24–48h |
| **P1 Internal** | Same | `engineEnabled` + `pstnEnabled` | 1 internal DID | 3–5 days |
| **P2 Pilot** | Same | + desk/mobile as needed | 2–5 pilot DIDs | 2 weeks |
| **P3 Expand** | Same | Sidecars per tenant | Gradual | Ongoing |

**Scale guidance:** ≤500 concurrent calls with ≥2–3 workers. Do not enable conference, queue, or IVR until PSTN/desk/mobile are stable.

---

### 2.2 Global environment (once per environment)

Set in `/opt/vsp-voip/.env`, then restart **both** API and worker:

```env
TELEPHONY_V3_GLOBAL=true
TELEPHONY_V3_INGRESS_ENABLED=true
TELEPHONY_V3_CALLMANAGER_ENABLED=true
TELEPHONY_V3_EXECUTOR_ENABLED=true
TELEPHONY_V3_REDIS_REQUIRED=true
TELEPHONY_V3_OUTBOX_PAUSED=false
REDIS_REQUIRED=true
LOG_LEVEL=warn
```

```bash
docker compose up -d api telephony-v3-worker
curl -s http://127.0.0.1:3000/ready/v3 | jq '.featureFlags'
```

---

### 2.3 Per-tenant enablement (step-by-step)

Tenant flags live in PostgreSQL table `V3FeatureFlag`. All default **false**. Each sidecar flag requires `engineEnabled=true` and `TELEPHONY_V3_GLOBAL=true`.

**Enable one flag at a time.** Wait **72 hours** stable before the next flag (or next tenant).

Replace `<tenant-id>` with the tenant UUID.

#### Step 1 — `engineEnabled`

Master switch for V3 processing for this tenant.

```sql
INSERT INTO "V3FeatureFlag" ("tenantId", "engineEnabled", "updatedAt")
VALUES ('<tenant-id>', true, NOW())
ON CONFLICT ("tenantId") DO UPDATE
SET "engineEnabled" = true, "updatedAt" = NOW();
```

**Validate:** Inbound call on pilot DID creates rows in `V3CallSession` / `V3CallLeg`. No legacy session bleed.

#### Step 2 — `pstnEnabled`

Inbound/outbound PSTN routing via V3 PSTN router.

```sql
UPDATE "V3FeatureFlag"
SET "pstnEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** Inbound PSTN → ring → answer → hangup. Outbound PSTN from mobile.

#### Step 3 — `deskEnabled`

Desk / SIP extension routing.

```sql
UPDATE "V3FeatureFlag"
SET "deskEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** Inbound to desk extension; desk outbound internal + external.

#### Step 4 — `mobileEnabled`

Mobile app routing (WebRTC / Credential Connection).

```sql
UPDATE "V3FeatureFlag"
SET "mobileEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** Mobile inbound/outbound; mobile → desk, mobile → PSTN.

#### Step 5 — `holdEnabled`

```sql
UPDATE "V3FeatureFlag"
SET "holdEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** Active call → hold → resume; audio path correct.

#### Step 6 — `transferEnabled`

```sql
UPDATE "V3FeatureFlag"
SET "transferEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** Blind transfer completes; no stuck `TRANSFER_PENDING` sessions.

#### Step 7 — `recordingEnabled`

```sql
UPDATE "V3FeatureFlag"
SET "recordingEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** Recording starts on answered call; appears in portal within sync window.

#### Step 8 — `voicemailEnabled`

```sql
UPDATE "V3FeatureFlag"
SET "voicemailEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** No-answer → voicemail deposit; playback in portal.

#### Step 9 — `conferenceEnabled`

```sql
UPDATE "V3FeatureFlag"
SET "conferenceEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** Create conference, add/remove participant, mute/unmute, hangup destroys conference.

#### Step 10 — `queueEnabled`

```sql
UPDATE "V3FeatureFlag"
SET "queueEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** Inbound → queue → agent answer; timeout/retry/overflow per config.

#### Step 11 — `ivrEnabled`

```sql
UPDATE "V3FeatureFlag"
SET "ivrEnabled" = true, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Validate:** IVR greeting, digit collection, routing to extension/queue/voicemail/disconnect.

---

### 2.4 Disable tenant (instant rollback)

```sql
UPDATE "V3FeatureFlag"
SET "engineEnabled" = false, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

Feature flag cache TTL is 300 seconds; for immediate effect restart worker or wait 5 minutes.

---

### 2.5 Emergency global stops

| Action | Env variable | Effect |
|--------|--------------|--------|
| Stop command execution | `TELEPHONY_V3_OUTBOX_PAUSED=true` | Outbox tick skips executor |
| Stop V3 webhook accept | `TELEPHONY_V3_INGRESS_ENABLED=false` | V3 route returns 503 |
| Stop all V3 | `TELEPHONY_V3_GLOBAL=false` | All tenant flags ineffective |

Restart after change: `docker compose up -d api telephony-v3-worker`

---

## 3. Telnyx setup

### 3.1 Create V3 Call Control application

In **Telnyx Mission Control → Call Control → Applications**:

| Field | Value |
|-------|-------|
| Name | `VSP-V3-Canary` (or `VSP-V3-Production`) |
| Webhook URL | `https://api.vspphone.com/webhook/v3/call-control` |
| Webhook API version | Same as legacy app (Call Control v2) |
| Failover URL | Optional; use only if tested |

**Do not** point the V3 app at `/webhook/call-control` (legacy path).

---

### 3.2 Configure webhook

Requirements:

- **HTTPS** public URL (`API_PUBLIC_URL` must match)
- Telnyx **Ed25519 public key** in `TELNYX_PUBLIC_KEY` (signature verification)
- Nginx must forward `POST /webhook/v3/call-control` without aggressive rate limiting

Verify endpoint responds:

```bash
curl -s https://api.vspphone.com/webhook/v3/call-control
# Expect: {"ok":true,"endpoint":"/webhook/v3/call-control","method":"POST",...}
```

With `TELEPHONY_V3_INGRESS_ENABLED=false`, POST returns 503 — expected during maintenance.

---

### 3.3 Assign pilot DID

1. Select **one** pilot phone number in Mission Control.
2. Assign it to the **V3 Call Control application** (`VSP-V3-Canary`).
3. Confirm the number is **removed** from the legacy Call Control application.

**Rule:** One DID → one application → one webhook URL. Never dual-assign.

---

### 3.4 Prevent legacy / V3 dual webhook conflicts

| Risk | Prevention |
|------|------------|
| Same DID on legacy + V3 apps | Audit Mission Control assignments before each pilot |
| Same event delivered to two URLs | Use separate apps; never subscribe both URLs to one app |
| Legacy `/webhook/voice` also receives `call.*` | Configure Telnyx so lifecycle events hit **one** URL per app |
| V3 tenant flag on but DID still on legacy app | DID routing takes precedence — align Telnyx before enabling `engineEnabled` |

**Audit command (manual):** Telnyx Mission Control → Numbers → each pilot DID → Connection/Application = V3 app only.

**Symptom of dual handling:** Duplicate sessions, duplicate answers, or `ingress.duplicate` spikes in logs without functional errors.

---

## 4. Health verification

All commands from EC2 host unless noted. Replace domain for external checks.

### 4.1 Platform readiness — `/ready`

```bash
curl -s http://127.0.0.1:3000/ready | jq .
curl -s https://api.vspphone.com/ready | jq '{ ready, database, redis, build }'
```

| Pass | `ready: true`, `database.connected: true`, `redis.connected: true` |

---

### 4.2 V3 readiness — `/ready/v3`

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq .
curl -s http://127.0.0.1:3000/ready/v3 | jq '{ ready, checks, workers, queue, dlq, outbox, featureFlags }'
```

| Check | Pass criteria |
|-------|---------------|
| `ready` | `true` |
| `checks.database` | `true` |
| `checks.redis` | `true` |
| `checks.workers` | `true` (production requires heartbeat) |
| `checks.queueLag` | `true` (`lagMs` ≤ `V3_QUEUE_LAG_MAX_MS`, default 60000) |
| `checks.dlq` | `true` (`depth` ≤ `V3_DLQ_DEPTH_MAX`, default 1000) |
| `checks.outboxDead` | `true` (`dead` ≤ `V3_OUTBOX_DEAD_MAX`, default 100) |
| `workers.activeCount` | ≥ 1 |

HTTP 503 with body is valid when not ready — parse JSON, do not treat as unreachable.

---

### 4.3 Metrics — `/metrics/v3`

```bash
curl -s http://127.0.0.1:3000/metrics/v3 | head -60
curl -s http://127.0.0.1:3000/metrics/v3 | grep -E 'ingress_queue_depth|outbox_pending|worker_processed'
```

Scrape from **internal network only** (Nginx/firewall). Do not expose publicly.

---

### 4.4 Worker heartbeat

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '.workers'
docker compose ps telephony-v3-worker
docker compose logs telephony-v3-worker --tail=30 | grep -E 'telephony_v3_worker.boot|worker.started'
```

| Pass | Container `healthy`; `activeCount >= 1`; heartbeat age < 30s |

Per-worker Docker healthcheck: `node scripts/v3-worker-healthcheck.js`

---

### 4.5 Redis

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '.redis'
docker compose exec redis redis-cli ping
docker compose exec redis redis-cli INFO memory | grep used_memory_human
docker compose exec redis redis-cli XLEN v3:stream:telephony-ingress
docker compose exec redis redis-cli XLEN v3:stream:telephony-dlq
```

| Pass | `PONG`; `/ready/v3` → `redis.connected: true` |

---

### 4.6 PostgreSQL

```bash
curl -s http://127.0.0.1:3000/ready | jq '.database'
docker compose exec postgres pg_isready -U vsp -d vsp_voip
docker compose exec api npx prisma migrate status
docker compose exec postgres psql -U vsp -d vsp_voip -c "SELECT count(*) FROM \"V3CommandOutbox\" WHERE status = 'PENDING';"
docker compose exec postgres psql -U vsp -d vsp_voip -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'vsp_voip';"
```

| Pass | `pg_isready` accepting; no pending migrations; connections within PG limit |

---

## 5. Operational monitoring

### 5.1 Thresholds (defaults)

| Signal | Source | Warning | Critical |
|--------|--------|---------|----------|
| Queue lag | `/ready/v3` → `queue.lagMs` | > 30s | > `V3_QUEUE_LAG_MAX_MS` (60s) |
| Queue depth | `/ready/v3` → `queue.depth` | > 1000 | > `V3_QUEUE_DEPTH_MAX` (10000) |
| DLQ depth | `/ready/v3` → `dlq.depth` | > 100 | > `V3_DLQ_DEPTH_MAX` (1000) |
| Outbox pending | `/ready/v3` → `outbox.pending` | sustained growth | + `/metrics/v3` `outbox_pending` |
| Outbox dead | `/ready/v3` → `outbox.dead` | > 10 | > `V3_OUTBOX_DEAD_MAX` (100) |
| Worker count | `/ready/v3` → `workers.activeCount` | < expected replicas | **0** in production |
| Executor failures | `/metrics/v3` `commands_failed_total` | sustained increase | + `outbox.dead` rising |
| Routing failures | `/metrics/v3` `*_route_failed` | any sustained spike | tenant reports broken routing |
| Redis memory | `redis-cli INFO memory` | > 70% maxmemory | > 85% |
| Postgres connections | `pg_stat_activity` count | > 70% max_connections | > 85% |

### 5.2 Key Prometheus metrics

Prefix: `vsp_telephony_v3_`

| Area | Metrics to watch |
|------|------------------|
| Ingress | `ingress_received_total`, `ingress_duplicate_total`, `ingress_queue_depth`, `ingress_dlq_depth` |
| Workers | `worker_processed_total`, `worker_failed_total` |
| Outbox | `outbox_pending`, `outbox_processing`, `commands_failed_total`, `command_retry_total` |
| Routing | `desk_route_total`, `desk_route_failed`, `mobile_route_failed`, `pstn_route_failed` |
| Sidecars | `hold_failed`, `transfer_failed_total`, `recording_failed_total`, `voicemail_failed_total`, `conference_failed_total`, `queue_overflow_total`, `ivr_invalid_total` |
| Redis | `redis_unavailable_total` |
| Timers | `timer_execution_total` |

### 5.3 Recommended alerts

1. `GET /ready/v3` → `ready == false` for > 2 minutes
2. `workers.activeCount == 0` for > 1 minute (production)
3. `dlq.depth` increasing over 15 minutes
4. `outbox.dead` > threshold
5. `commands_failed_total` rate > baseline × 3
6. Redis memory > 80%
7. Postgres connections > 80% of `max_connections`

---

## 6. Incident response

### 6.1 Worker down

**Symptoms:** `/ready/v3` → `checks.workers: false`, `activeCount: 0`; V3 calls not processing; ingress queue growing.

```bash
docker compose ps telephony-v3-worker
docker compose logs telephony-v3-worker --tail=100
docker compose up -d telephony-v3-worker
curl -s http://127.0.0.1:3000/ready/v3 | jq '.workers'
```

If crash loop: check env vars (`validateWorkerEnv` errors in logs), Redis/Postgres connectivity.

**Temporary mitigation:** `TELEPHONY_V3_INGRESS_ENABLED=false` stops new enqueue (503 to Telnyx). Re-enable after worker restored.

**Multi-worker:** Restart one replica at a time if scaled.

---

### 6.2 Redis restart

**Symptoms:** `/ready/v3` → `redis.connected: false`; `redis_unavailable_total` increasing.

```bash
docker compose restart redis
sleep 10
docker compose exec redis redis-cli ping
curl -s http://127.0.0.1:3000/ready/v3 | jq '.redis, .checks'
docker compose logs telephony-v3-worker --tail=50
```

Worker should reconnect within ~30s. Heartbeats resume automatically.

**Note:** In-flight locks expire (`TTL.LOCK_SEC` = 30s). Stale stream messages reclaimed after `STALE_CLAIM_MS` (60s).

---

### 6.3 Postgres restart

**Symptoms:** `/ready` and `/ready/v3` → `database.connected: false`.

```bash
docker compose restart postgres
# Wait for pg_isready
docker compose exec postgres pg_isready -U vsp -d vsp_voip
docker compose restart api telephony-v3-worker
curl -s http://127.0.0.1:3000/ready/v3 | jq '.database, .checks'
```

Verify no corrupted transactions: check `V3CommandOutbox` for stuck `PROCESSING` rows older than lease.

---

### 6.4 Webhook backlog (ingress queue growth)

**Symptoms:** `queue.depth` and `queue.lagMs` rising; Telnyx timeouts if API sync path slow.

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '.queue'
docker compose logs telephony-v3-worker --tail=100
docker compose exec redis redis-cli XPENDING v3:stream:telephony-ingress v3-workers
```

Actions:

1. Confirm workers running (`activeCount >= 1`)
2. Scale workers if CPU-bound: `docker compose up -d --scale telephony-v3-worker=2` (unique `V3_WORKER_ID` per replica)
3. Check Postgres latency and connection count
4. Review `worker_failed_total` for poison messages → DLQ

---

### 6.5 Outbox growth

**Symptoms:** `outbox.pending` or `outbox.processing` rising; calls stuck without Telnyx commands.

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '.outbox'
docker compose exec postgres psql -U vsp -d vsp_voip -c \
  "SELECT status, count(*) FROM \"V3CommandOutbox\" GROUP BY status;"
docker compose logs telephony-v3-worker | grep -E 'outbox|command|executor'
```

Actions:

1. Check `TELEPHONY_V3_EXECUTOR_ENABLED=true` and `TELEPHONY_V3_OUTBOX_PAUSED=false`
2. Check Telnyx API errors in logs (`commands_failed_total`)
3. If executor storm: `TELEPHONY_V3_OUTBOX_PAUSED=true` → restart worker → investigate → unpause

---

### 6.6 DLQ growth

**Symptoms:** `dlq.depth` rising; `ingress_dlq_total` increasing.

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '.dlq'
docker compose exec redis redis-cli XLEN v3:stream:telephony-dlq
docker compose logs telephony-v3-worker | grep ingress.dlq
```

Actions:

1. Identify poison reason in logs (`ingress.dlq` — missing payload, max delivery attempts)
2. Fix root cause before replay
3. Replay via application code path `replayDlqMessages()` (ops script — contact engineering) or manual inspection of DLQ entries
4. Monitor `replay_total` metric after replay

---

### 6.7 Duplicate webhook storm

**Symptoms:** `ingress_duplicate_total` spike; logs show `ingress.duplicate`; usually harmless if dedup working.

```bash
curl -s http://127.0.0.1:3000/metrics/v3 | grep ingress_duplicate
docker compose logs api | grep -E 'ingress.duplicate|v3_webhook'
```

Actions:

1. Confirm **one webhook URL** per DID in Telnyx (see §3.4)
2. Verify not hitting both `/webhook/call-control` and `/webhook/v3/call-control` for same call
3. Dedup is durable (`ProcessedTelnyxEvent`) — duplicates should not double-process
4. If duplicates create sessions: **stop traffic**, disable tenant `engineEnabled`, audit Telnyx config

---

## 7. Rollback

### 7.1 Feature flag rollback (fastest)

**Tenant-level:**

```sql
UPDATE "V3FeatureFlag" SET "engineEnabled" = false, "updatedAt" = NOW()
WHERE "tenantId" = '<tenant-id>';
```

**Global env** (edit `.env`):

```env
TELEPHONY_V3_OUTBOX_PAUSED=true
TELEPHONY_V3_INGRESS_ENABLED=false
TELEPHONY_V3_GLOBAL=false
```

```bash
docker compose up -d api telephony-v3-worker
curl -s http://127.0.0.1:3000/ready/v3 | jq '.featureFlags'
```

Legacy Call Control continues for DIDs still on legacy Telnyx app.

---

### 7.2 Worker rollback

```bash
cd /opt/vsp-voip
cp .env .env.backup-$(date +%Y%m%d)
git checkout <good-commit>
bash deploy/deploy-v3-worker.sh
curl -s http://127.0.0.1:3000/ready/v3 | jq '.workers, .checks'
```

**Stop without redeploy:** `docker compose stop telephony-v3-worker` (ingress still enqueues — backlog until restored).

---

### 7.3 API rollback

```bash
cd /opt/vsp-voip
git checkout <good-commit>
bash deploy/deploy-api.sh
bash deploy/deploy-v3-worker.sh   # when V3 enabled
curl -s http://127.0.0.1:3000/ready | jq '.ready, .build'
curl -s http://127.0.0.1:3000/ready/v3 | jq '.ready, .workers'
```

See [08-rollback.md](./08-rollback.md).

---

### 7.4 Migration rollback

**Do not** manually edit `_prisma_migrations` unless instructed by engineering.

```bash
docker compose stop api telephony-v3-worker
docker compose exec -T postgres psql -U vsp -d vsp_voip < ~/backups/vsp-pre-v3-YYYYMMDD.sql
docker compose up -d api
docker compose exec api npx prisma migrate status
bash deploy/deploy-v3-worker.sh
```

Pair with API rollback to commit **before** the bad migration.

---

### 7.5 Telnyx rollback

1. Mission Control → reassign pilot DID(s) from V3 app back to **legacy Call Control application**
2. Confirm legacy webhook: `https://api.vspphone.com/webhook/call-control`
3. Disable tenant `engineEnabled` in PostgreSQL
4. Place test inbound call; verify Telnyx Debugger shows events on legacy URL only

Document previous and current webhook URLs in incident ticket.

---

## 8. Post-deployment validation

Run after every V3 deploy and after each tenant flag change. Checklist per feature enabled.

### 8.1 Core (always)

| # | Test | Pass |
|---|------|------|
| 1 | `/ready` → `ready: true` | ☐ |
| 2 | `/ready/v3` → `ready: true`, `workers.activeCount >= 1` | ☐ |
| 3 | `/metrics/v3` scrape succeeds (internal) | ☐ |
| 4 | Duplicate webhook → no double session | ☐ |
| 5 | Worker restart → recovery within 5 min | ☐ |
| 6 | Legacy tenants unaffected (non-pilot DID) | ☐ |

### 8.2 Inbound PSTN (`pstnEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | External mobile → pilot DID → rings target | ☐ |
| 2 | Answer → two-way audio | ☐ |
| 3 | Hangup → session `ENDED` in `V3CallSession` | ☐ |
| 4 | Caller ID correct on callee device | ☐ |

### 8.3 Outbound PSTN (`pstnEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Mobile app dials external number | ☐ |
| 2 | Two-way audio | ☐ |
| 3 | Caller ID matches tenant DID policy | ☐ |

### 8.4 Desk (`deskEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Inbound to desk extension rings SIP phone | ☐ |
| 2 | Desk dials internal extension | ☐ |
| 3 | Desk dials external PSTN | ☐ |

### 8.5 Mobile (`mobileEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Mobile inbound answer | ☐ |
| 2 | Mobile outbound | ☐ |
| 3 | Mobile → desk / mobile → PSTN | ☐ |

### 8.6 Hold (`holdEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Hold → music/on-hold treatment | ☐ |
| 2 | Resume → two-way audio restored | ☐ |

### 8.7 Transfer (`transferEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Blind transfer completes | ☐ |
| 2 | Original leg released per policy | ☐ |

### 8.8 Recording (`recordingEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Recording starts on answer | ☐ |
| 2 | Recording visible in portal | ☐ |
| 3 | Stop on hangup | ☐ |

### 8.9 Voicemail (`voicemailEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | No-answer → voicemail greeting | ☐ |
| 2 | Message deposited | ☐ |
| 3 | Playback in portal | ☐ |

### 8.10 Conference (`conferenceEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Create conference | ☐ |
| 2 | Add second participant | ☐ |
| 3 | Mute / unmute | ☐ |
| 4 | All hang up → conference destroyed | ☐ |

### 8.11 Queue (`queueEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Inbound enters queue | ☐ |
| 2 | Agent receives call | ☐ |
| 3 | Timeout / overflow per config | ☐ |

### 8.12 IVR (`ivrEnabled`)

| # | Test | Pass |
|---|------|------|
| 1 | Greeting plays | ☐ |
| 2 | Valid digit routes correctly | ☐ |
| 3 | Invalid digit / timeout handling | ☐ |
| 4 | Business hours routing (if configured) | ☐ |

Full platform matrix: [14-telephony-validation.md](./14-telephony-validation.md)

---

## 9. Weekly maintenance

### 9.1 Retention jobs (automatic)

The worker runs maintenance on a periodic loop (`ingressWorker.js`):

| Job | Function | Default retention |
|-----|----------|-------------------|
| Processed Telnyx events | `purgeProcessedTelnyxEvents` | `V3_PROCESSED_EVENT_RETENTION_DAYS` = 30 |
| Outbox ACKED/DEAD rows | `purgeOutboxRows` | ACKED 7d, DEAD 30d |
| Timer poll | `pollExpiredTimers` | — |

**Weekly review:**

```bash
docker compose logs telephony-v3-worker --since 7d | grep -E 'maintenance.purge|outbox.retention'
docker compose exec postgres psql -U vsp -d vsp_voip -c \
  "SELECT count(*) FROM \"ProcessedTelnyxEvent\";"
docker compose exec postgres psql -U vsp -d vsp_voip -c \
  "SELECT status, count(*) FROM \"V3CommandOutbox\" GROUP BY status;"
```

---

### 9.2 Replay / DLQ review

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '.dlq'
docker compose exec redis redis-cli XLEN v3:stream:telephony-dlq
docker compose logs telephony-v3-worker --since 7d | grep -E 'ingress.dlq|replay.dlq'
```

If DLQ depth > 0: triage before replay. Coordinate with engineering for `replayDlqMessages()`.

---

### 9.3 Outbox cleanup review

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '.outbox'
docker compose exec postgres psql -U vsp -d vsp_voip -c \
  "SELECT status, count(*), min(\"createdAt\"), max(\"createdAt\")
   FROM \"V3CommandOutbox\" GROUP BY status;"
```

Investigate sustained `PROCESSING` or growing `DEAD` counts.

---

### 9.4 Metrics review

```bash
curl -s http://127.0.0.1:3000/metrics/v3 | grep -E \
  'ingress_received_total|ingress_duplicate_total|worker_failed_total|commands_failed_total|outbox_pending|ingress_dlq_depth'
```

Compare week-over-week. Document baseline after canary stabilizes.

---

### 9.5 Health review

```bash
curl -s http://127.0.0.1:3000/ready | jq '{ ready, build, database, redis }'
curl -s http://127.0.0.1:3000/ready/v3 | jq '{ ready, checks, workers, queue, dlq, outbox }'
docker compose ps
VALIDATE_V3_WORKER_RUNTIME=true npm run validate:v3-worker
```

---

## 10. Disaster recovery

See also [12-disaster-recovery.md](./12-disaster-recovery.md).

### 10.1 Capture state (first action)

```bash
cd /opt/vsp-voip
git rev-parse HEAD | tee /tmp/v3-incident-sha.txt
docker compose ps | tee /tmp/docker-ps.txt
curl -s http://127.0.0.1:3000/ready | jq . | tee /tmp/ready.json
curl -s http://127.0.0.1:3000/ready/v3 | jq . | tee /tmp/ready-v3.json
docker compose logs api --tail=300 > /tmp/api-log.txt
docker compose logs telephony-v3-worker --tail=300 > /tmp/v3-worker-log.txt
cp .env /tmp/env-backup-incident.txt
```

---

### 10.2 Redis failure / data loss

**Impact:** Ingress streams, heartbeats, locks, timers, payload cache lost. PostgreSQL sessions/outbox survive.

```bash
docker compose up -d redis
docker compose exec redis redis-cli ping
docker compose restart telephony-v3-worker api
curl -s http://127.0.0.1:3000/ready/v3 | jq .
```

**Recovery notes:**

- Consumer group recreated on worker start (`MKSTREAM` / `BUSYGROUP`)
- In-flight ingress payloads may be lost if Redis data wiped — check DLQ and `ProcessedTelnyxEvent` for replay gaps
- Telnyx may retry webhooks for unprocessed events

---

### 10.3 Database restore

When data integrity is uncertain or migration failed:

```bash
docker compose stop api telephony-v3-worker
docker compose exec -T postgres psql -U vsp -d vsp_voip < ~/backups/vsp-pre-v3-YYYYMMDD.sql
docker compose up -d api
docker compose exec api npx prisma migrate status
bash deploy/deploy-v3-worker.sh
```

Verify V3 tables: `V3CallSession`, `V3CallLeg`, `V3CommandOutbox`, `V3FeatureFlag`, `ProcessedTelnyxEvent`.

---

### 10.4 Worker rebuild

```bash
cd /opt/vsp-voip
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose build --no-cache telephony-v3-worker
docker compose up -d telephony-v3-worker
curl -s http://127.0.0.1:3000/ready/v3 | jq '.workers'
```

---

### 10.5 API rebuild

```bash
cd /opt/vsp-voip
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose build --no-cache api
docker compose up -d api
bash deploy/deploy-v3-worker.sh
curl -s http://127.0.0.1:3000/ready | jq .
curl -s http://127.0.0.1:3000/ready/v3 | jq .
```

---

### 10.6 Full stack recovery order

```
1. Restore PostgreSQL (if needed)
2. Start Redis
3. Deploy / rebuild API (migrations)
4. Deploy / rebuild telephony-v3-worker
5. Verify /ready + /ready/v3
6. Verify Telnyx webhook URLs
7. PM2 restart web (if needed)
8. Post-deployment validation (§8)
```

**RTO target:** Document per org policy. **RPO target:** Last successful `pg_dump` (daily minimum recommended).

---

## Appendix A — Environment variable reference

See `.env.example` and [lib/telephony-v3/README.md](../../../lib/telephony-v3/README.md).

## Appendix B — Useful SQL

```sql
-- Active V3 sessions (not ended)
SELECT id, "tenantId", state, "createdAt"
FROM "V3CallSession"
WHERE state NOT IN ('ENDED', 'FAILED')
ORDER BY "createdAt" DESC LIMIT 20;

-- Tenant flags
SELECT * FROM "V3FeatureFlag" WHERE "tenantId" = '<tenant-id>';

-- Recent outbox failures
SELECT id, "commandType", status, "attemptCount", "lastError", "updatedAt"
FROM "V3CommandOutbox"
WHERE status IN ('FAILED', 'DEAD')
ORDER BY "updatedAt" DESC LIMIT 20;
```

## Appendix C — Document index

| Doc | Purpose |
|-----|---------|
| [16-telephony-v3-worker.md](./16-telephony-v3-worker.md) | Worker service detail |
| [08-rollback.md](./08-rollback.md) | Rollback procedures |
| [13-monitoring.md](./13-monitoring.md) | Monitoring endpoints |
| [14-v3-staging-readiness-review.md](../phase3/14-v3-staging-readiness-review.md) | Staging checklist |
| [13-v3-final-go-no-go-review.md](../phase3/13-v3-final-go-no-go-review.md) | Go/no-go and canary plan |
| [17-v3-integration-validation.md](./17-v3-integration-validation.md) | B3 integration tests |

---

**Last updated:** 2026-07-01 · Phase 3.9.5
