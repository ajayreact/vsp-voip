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
```

`/ready` fields ([lib/health.js](../../../lib/health.js)):

| Field | Meaning |
|-------|---------|
| `ready` | Overall pass/fail |
| `database` | Postgres connectivity |
| `redis` | Redis ping |
| `telnyx.apiKeyConfigured` | API key present |
| `stripe` | Billing config |
| `smtp` | Email config |
| `build.gitCommit` | Deployed API commit |

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
- PM2 `pm2 startup` for process resurrection
- Docker healthcheck on `api` service

---

## Related docs

- [11-known-issues.md](./11-known-issues.md)
- [14-telephony-validation.md](./14-telephony-validation.md)
- [02-ec2-deployment.md](./02-ec2-deployment.md)
