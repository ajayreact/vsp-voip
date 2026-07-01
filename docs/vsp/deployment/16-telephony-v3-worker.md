# Telephony V3 Worker (Production Service)

The **telephony-v3-worker** is a dedicated Docker Compose service that consumes Redis ingress jobs, runs the outbox tick, and publishes Redis heartbeats consumed by **`GET /ready/v3`**.

The API container remains webhook-only for V3 ingress (enqueue). **Do not** run the worker inside the API process in production.

Related: [03-docker.md](./03-docker.md), [02-ec2-deployment.md](./02-ec2-deployment.md), [08-rollback.md](./08-rollback.md), [13-monitoring.md](./13-monitoring.md)

---

## Architecture

| Service | Process | Port | Role |
|---------|---------|------|------|
| `api` | `tsx server.js` | 3000 | HTTP API, V3 webhook gateway (enqueue only) |
| `telephony-v3-worker` | `node scripts/telephony-v3-worker.js` | — | Ingress consumer, outbox executor tick, timers, maintenance |
| `postgres` | PostgreSQL 16 | 5432 (internal) | Durable sessions, outbox, dedup ledger |
| `redis` | Redis 7 | 6379 (internal) | Streams, heartbeats, locks, cache |

Readiness:

- **`GET /ready`** — platform API readiness (database, legacy checks)
- **`GET /ready/v3`** — V3 readiness including **active worker heartbeats**, Redis, queue lag, DLQ depth, outbox dead-letter count

In production (`NODE_ENV=production`), `/ready/v3` requires at least one fresh worker heartbeat.

---

## Required environment variables

The worker **fails fast at startup** if any of these are unset (value may be `true` or `false`):

| Variable | Purpose |
|----------|---------|
| `TELEPHONY_V3_GLOBAL` | Global V3 engine gate |
| `TELEPHONY_V3_INGRESS_ENABLED` | Ingress stream processing gate |
| `TELEPHONY_V3_CALLMANAGER_ENABLED` | CallManager orchestration gate |
| `TELEPHONY_V3_EXECUTOR_ENABLED` | Telnyx command executor gate |
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis connection |

Optional:

| Variable | Default | Purpose |
|----------|---------|---------|
| `V3_WORKER_ID` | `worker-<HOSTNAME>` | Stable identity for heartbeat + outbox claims |
| `V3_OUTBOX_POLL_MS` | `500` | Outbox loop interval |
| `V3_WORKER_SKIP_ENV_VALIDATE` | — | Test-only bypass (never use in production) |

Set all flags in `.env` on the host. Compose overrides `DATABASE_URL` / `REDIS_URL` to in-network service names.

---

## Docker Compose

From repo root:

```bash
export GIT_COMMIT="$(git rev-parse HEAD)"

# API first (runs prisma migrate deploy via entrypoint)
docker compose up -d --build api

# V3 worker (same image, separate service)
docker compose up -d --build telephony-v3-worker
```

Example service definition (see [docker-compose.yml](../../../docker-compose.yml)):

```yaml
telephony-v3-worker:
  build:
    context: .
    args:
      GIT_COMMIT: ${GIT_COMMIT:-unknown}
  env_file:
    - .env
  environment:
    DATABASE_URL: postgresql://vsp:vsp@postgres:5432/vsp_voip
    REDIS_URL: redis://redis:6379
    V3_WORKER_ID: ${V3_WORKER_ID:-worker-compose-1}
  depends_on:
    api:
      condition: service_healthy
  entrypoint: []
  command: ["node", "scripts/telephony-v3-worker.js"]
  healthcheck:
    test: ["CMD", "node", "scripts/v3-worker-healthcheck.js"]
    interval: 15s
    timeout: 5s
    retries: 3
    start_period: 45s
  restart: unless-stopped
```

Notes:

- Worker **skips** `prisma migrate deploy` (migrations run on `api` entrypoint only).
- `restart: unless-stopped` on both `api` and `telephony-v3-worker`.
- Worker healthcheck verifies a fresh Redis heartbeat for `V3_WORKER_ID`.

---

## EC2 deploy

Production order:

1. **API** — `bash deploy/deploy-api.sh` (migrations + `/ready`)
2. **V3 worker** — `bash deploy/deploy-v3-worker.sh` (starts worker, verifies `/ready/v3` heartbeats)

Or combined manual flow:

```bash
cd /opt/vsp-voip
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose up -d --build api telephony-v3-worker
curl -s http://127.0.0.1:3000/ready/v3 | jq .
```

---

## Scaling workers

Horizontal scale uses Redis consumer groups (ingress) and PostgreSQL `FOR UPDATE SKIP LOCKED` (outbox). Each worker must have a **unique consumer name**.

```bash
# Scale to two workers — omit fixed V3_WORKER_ID so each container uses HOSTNAME
docker compose up -d --scale telephony-v3-worker=2
```

Verify:

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '.workers'
docker compose ps telephony-v3-worker
```

Guidelines:

- Start with **one worker** until queue lag is sustained under threshold.
- Add workers when `/ready/v3` shows high queue depth or lag.
- Do not run more workers than Redis/Postgres can sustain; monitor `GET /metrics/v3`.

---

## Health checks

| Check | Command | Pass criteria |
|-------|---------|---------------|
| Worker container | `docker compose ps telephony-v3-worker` | `healthy` |
| Heartbeat | `curl -s http://127.0.0.1:3000/ready/v3 \| jq .workers` | `activeCount >= 1` |
| Redis | `curl -s http://127.0.0.1:3000/ready/v3 \| jq .redis` | `connected: true` |
| Logs | `docker compose logs telephony-v3-worker --tail=50` | `telephony_v3_worker.boot`, periodic heartbeat |

Worker heartbeat TTL: **30 seconds** (`TTL.HEARTBEAT_SEC`).

---

## Rolling restart

Restart worker without API downtime:

```bash
docker compose up -d --build telephony-v3-worker
# Or graceful stop/start:
docker compose stop telephony-v3-worker
docker compose start telephony-v3-worker
```

During `SIGTERM`, the worker:

1. Stops accepting new ingress reads
2. Drains in-flight ingress jobs (up to `WORKER.SHUTDOWN_DRAIN_MS`, default 30s)
3. Exits with code 0

For zero-downtime with multiple workers, restart one replica at a time:

```bash
docker compose up -d --scale telephony-v3-worker=2
# restart individual container by ID from docker ps
```

---

## Rollback

| Scenario | Action |
|----------|--------|
| Bad worker image only | `git checkout <good-commit>` → `bash deploy/deploy-v3-worker.sh` |
| Bad API + worker | Roll back API first ([08-rollback.md](./08-rollback.md)), then worker |
| Worker stuck / runaway | `docker compose stop telephony-v3-worker` — API webhooks still enqueue; replay after fix |
| Disable V3 quickly | Set `TELEPHONY_V3_GLOBAL=false` in `.env`, restart worker + API |

Verification after rollback:

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq .
docker compose logs telephony-v3-worker --tail=80
```

---

## Validation

Automated:

```bash
npm run validate:v3-worker
VALIDATE_V3_WORKER_RUNTIME=true npm run validate:v3-worker   # after stack is up
npm run test:v3 -- tests/telephony-v3/workerProduction.test.ts
```

Manual checklist:

- [ ] Worker starts: `docker compose logs telephony-v3-worker | grep telephony_v3_worker.boot`
- [ ] Heartbeat visible: `/ready/v3` → `workers.activeCount >= 1`
- [ ] API detects worker: `/ready/v3` → `checks.workers: true` (production)
- [ ] Redis restart recovery: `docker compose restart redis` → worker resumes within ~30s
- [ ] Graceful shutdown: `docker compose stop telephony-v3-worker` → `telephony_v3_worker.exit` in logs
- [ ] No duplicate ingress processing: scale to 2 workers, confirm single ack per stream message
- [ ] No duplicate outbox claims: see `tests/telephony-v3/outboxConcurrency.test.ts`

---

## Related docs

- [lib/telephony-v3/README.md](../../../lib/telephony-v3/README.md) — V3 module map
- [14-telephony-validation.md](./14-telephony-validation.md) — call-level validation
- [deploy/deploy-v3-worker.sh](../../../deploy/deploy-v3-worker.sh) — EC2 worker deploy script
