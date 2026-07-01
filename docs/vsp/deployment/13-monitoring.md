# Monitoring

Where to look when production misbehaves. **Check deployment health before diving into application code.**

---

## Docker logs (API)

```bash
cd /opt/vsp-voip
docker compose logs api -f
docker compose logs api --tail=200
docker compose logs api --since 30m
```

## Docker logs (V3 worker)

```bash
docker compose logs telephony-v3-worker -f
docker compose logs telephony-v3-worker --tail=200
curl -s http://127.0.0.1:3000/ready/v3 | jq '.workers'
```

Look for:

- `telephony_v3_worker.boot` / `telephony_v3_worker.exit`
- `worker.started` / heartbeat metadata
- Redis reconnect after `docker compose restart redis`
- Outbox tick errors

See [16-telephony-v3-worker.md](./16-telephony-v3-worker.md).

Look for:

- Startup webhook URL lines (Telnyx)
- Prisma migration success/failure
- Unhandled errors during calls
- Redis connection errors
- `401` / `403` auth patterns

Filter:

```bash
docker compose logs api 2>&1 | grep -i webhook
docker compose logs api 2>&1 | grep -i error
```

---

## PM2 logs (frontend)

```bash
pm2 logs vsp-web
pm2 logs vsp-web --err --lines 100
pm2 monit
```

Look for:

- Next.js startup on port 3001
- Build/runtime errors
- Crash restart loops

---

## Nginx logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
sudo grep 'api.vspphone.com/webhook' /var/log/nginx/access.log | tail -20
```

502/504 → upstream (Docker/PM2) down or slow.

---

## API health endpoints

```bash
curl -s https://api.vspphone.com/health | jq .
curl -s https://api.vspphone.com/ready | jq .
curl -s https://api.vspphone.com/ready/v3 | jq .
curl -s https://api.vspphone.com/metrics/v3 | head -40
```

### `/health` — liveness

Minimal uptime probe. Docker `Dockerfile` HEALTHCHECK uses this endpoint.

### `/ready` — platform readiness

[`lib/health.js`](../../../lib/health.js)

| Field | Meaning |
|-------|---------|
| `ready` | Overall pass/fail |
| `database` | Postgres connectivity |
| `redis` | Redis ping |
| `telnyx.apiKeyConfigured` | API key present |
| `stripe` | Billing config |
| `smtp` | Email config |
| `build.gitCommit` | Deployed API commit |

**Note:** `/ready` does **not** verify V3 workers. Use `/ready/v3` when telephony V3 is enabled.

### `/ready/v3` — V3 telephony readiness

[`lib/telephony-v3/Health/healthService.js`](../../../lib/telephony-v3/Health/healthService.js)

```bash
curl -s http://127.0.0.1:3000/ready/v3 | jq '{ ready, checks, workers, queue, dlq, outbox, featureFlags }'
```

| Field | Meaning | Alert if |
|-------|---------|----------|
| `ready` | All V3 checks pass | `false` |
| `checks.database` | Postgres | `false` |
| `checks.redis` | Redis (when `TELEPHONY_V3_REDIS_REQUIRED`) | `false` |
| `checks.workers` | Active heartbeat (required in production) | `false` |
| `checks.queueLag` | Ingress stream lag | `false` (> `V3_QUEUE_LAG_MAX_MS`) |
| `checks.queueDepth` | Ingress stream depth | `false` |
| `checks.dlq` | DLQ depth | `false` (> `V3_DLQ_DEPTH_MAX`) |
| `checks.outboxDead` | Dead outbox rows | `false` (> `V3_OUTBOX_DEAD_MAX`) |
| `workers.activeCount` | Live worker heartbeats | `0` in production |
| `workers.workers[]` | `workerId`, `at`, `role` | stale entries |
| `queue.depth` / `queue.lagMs` | Ingress backlog | sustained high |
| `outbox.pending` / `outbox.dead` | Command pipeline | growing dead count |
| `featureFlags` | Global env gates | unexpected flip |

`featureFlags` snapshot:

| Flag | Env variable |
|------|----------------|
| `globalEnabled` | `TELEPHONY_V3_GLOBAL` |
| `ingressEnabled` | `TELEPHONY_V3_INGRESS_ENABLED` |
| `callManagerEnabled` | `TELEPHONY_V3_CALLMANAGER_ENABLED` |
| `executorEnabled` | `TELEPHONY_V3_EXECUTOR_ENABLED` |
| `outboxPaused` | `TELEPHONY_V3_OUTBOX_PAUSED` |

Deploy scripts (`deploy-api.sh`, `deploy-v3-worker.sh`) verify `/ready` then `/ready/v3`. If V3 flags are enabled but `workers.activeCount` is 0, deploy fails.

### `/metrics/v3` — Prometheus metrics

Text format (`Content-Type: text/plain`). Scrape from internal network only (restrict at Nginx/firewall).

Key series (prefix `vsp_telephony_v3_`):

| Area | Examples |
|------|----------|
| Ingress / Redis | `ingress_received_total`, `ingress_duplicate_total`, `ingress_queue_depth`, `ingress_dlq_depth`, `redis_unavailable_total` |
| Workers | `worker_processed_total`, `worker_failed_total`, `worker_process_duration_seconds` |
| Outbox / Executor | `outbox_pending`, `outbox_processing`, `commands_completed_total`, `commands_failed_total`, `command_retry_total` |
| Routing | `desk_route_total`, `mobile_route_total`, `pstn_route_total` |
| Sidecars | `hold_total`, `transfer_total`, `recording_total`, `voicemail_total`, `conference_total`, `queue_total`, `ivr_total` |
| Timers | `timer_execution_total` |

Worker metrics mirror to Redis when `V3_METRICS_REDIS_MIRROR=true` (default); API `/metrics/v3` merges in-process and mirrored counters.

See [16-telephony-v3-worker.md](./16-telephony-v3-worker.md) health checks.

Remote report:

```bash
API_URL=https://api.vspphone.com node scripts/production-deployment-report.js
```

Validation suite:

```bash
API_BASE=https://api.vspphone.com npm run validate:p0
```

---

## WebRTC diagnostics (browser)

During an active call:

- https://app.vspphone.com/softphone-v2/diagnostics
- Softphone V2 → **More** → **WebRTC Diagnostics**

Export JSON for tickets. Checklist: [scripts/office-webrtc-capture-checklist.md](../../../scripts/office-webrtc-capture-checklist.md)

Key metrics:

- ICE connection / gathering state
- Candidate types (host, srflx, relay)
- RTP packets sent / received
- Smart alerts

---

## Browser console

DevTools → Console on `app.vspphone.com`:

- Telnyx SDK registration errors
- `media.peer-timeout` — peer connection not wired
- Microphone permission denied
- CORS / 401 on API fetch

Filter: `telnyx`, `webrtc`, `softphone`

---

## Network tab

DevTools → Network:

- API calls to `api.vspphone.com` — status codes, JWT header
- WebRTC — STUN/TURN to `stun.telnyx.com`, `turn.telnyx.com`
- WSS to Telnyx (`rtc.telnyx.com`)

During calls, confirm:

- Signaling WebSocket connected
- ICE candidates exchanged
- No blocked mixed content

---

## Telnyx webhooks & debugger

**Mission Control → Debugger** — trace `call.initiated`, `call.answered`, `call.hangup`, transfers.

Webhook delivery:

- Nginx access log for `POST /webhook/...`
- API logs for webhook handler errors
- Signature verification failures → `TELNYX_PUBLIC_KEY` mismatch

Webhook URL must be:

```
https://api.vspphone.com/webhook/call-control
```

---

## Redis & Postgres (quick)

```bash
docker compose exec redis redis-cli ping
docker compose exec postgres pg_isready -U vsp
```

---

## DID / admin diagnostics

```bash
API_URL=https://api.vspphone.com node scripts/diagnose-did-sync.js
API_URL=https://api.vspphone.com EMAIL=... PASSWORD=... node scripts/diagnose-did-sync.js
```

---

## Alerting (current state)

No centralized APM in repo. Manual checks:

- Cron or UptimeRobot on `GET https://api.vspphone.com/ready`
- When V3 enabled: also probe `GET https://api.vspphone.com/ready/v3` (alert on `ready: false` or `workers.activeCount: 0`)
- Scrape `GET https://api.vspphone.com/metrics/v3` from internal Prometheus (do not expose publicly)
- PM2 `pm2 startup` for process resurrection
- Docker healthcheck on `api` and `telephony-v3-worker` services

---

## Related docs

- [11-known-issues.md](./11-known-issues.md)
- [14-telephony-validation.md](./14-telephony-validation.md)
- [16-telephony-v3-worker.md](./16-telephony-v3-worker.md)
