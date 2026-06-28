# Deployment Checklist — Phase 3.1 / 3.6

**Purpose:** Operational readiness for production. Items marked **Audit finding** link to Phase 3.1 reports.  
**Use:** Check off before go-live; re-verify after each production deploy.

---

## Pre-flight (environment)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | `NODE_ENV=production` | ☐ | |
| 2 | `JWT_SECRET` — strong, non-default | ☐ | `lib/env.js` validates |
| 3 | `ENCRYPTION_KEY` set | ☐ | |
| 4 | `TELNYX_API_KEY` + `TELNYX_PUBLIC_KEY` | ☐ | Webhook signature verify |
| 5 | `API_PUBLIC_URL` — public HTTPS, reachable by Telnyx | ☐ | Required for webhooks |
| 6 | `WEB_ORIGIN`, `ADMIN_ORIGIN` — production URLs | ☐ | CORS |
| 7 | `DATABASE_URL` — production Postgres | ☐ | Not default `vsp:vsp` |
| 8 | `REDIS_URL` + **`REDIS_REQUIRED=true`** | ☐ | **Audit:** TEL-004, PERF-011 |
| 9 | SMTP configured (or accept `/ready` SMTP skip strategy) | ☐ | **Audit:** PERF-ready |
| 10 | `GIT_COMMIT` injected at build/deploy | ☐ | `/ready` traceability |
| 11 | `NEXT_PUBLIC_BROWSER_CALLING_ENABLED=false` | ☐ | Admin portal only |
| 12 | Stripe/Razorpay webhook secrets (if billing enabled) | ☐ | |

---

## Docker / network

| # | Item | Status | Notes |
|---|------|--------|-------|
| 13 | API bound to `127.0.0.1:3000` behind Nginx | ☐ | **Audit:** Docker port exposure |
| 14 | Postgres **not** publicly exposed (or `127.0.0.1:5432` only) | ☐ | Critical |
| 15 | Redis **not** publicly exposed | ☐ | Critical |
| 16 | Docker healthcheck uses `/ready` | ☐ | compose.yml |

---

## Nginx / SSL

| # | Item | Status | Notes |
|---|------|--------|-------|
| 17 | HTTP → HTTPS redirect | ☐ | `deploy/nginx/vspphone.conf` |
| 18 | Valid cert for API, app, admin domains | ☐ | `deploy/ssl-setup.sh` |
| 19 | Certbot auto-renew enabled (systemd timer) | ☐ | **Audit finding** |
| 20 | Webhook `/webhook` exempt from aggressive rate limit | ☐ | Telnyx IPs |
| 21 | HSTS + security headers on HTTPS blocks | ☐ | **Audit finding** |
| 22 | WebSocket upgrade for admin/monitoring if used | ☐ | |

---

## PM2 (web portal)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 23 | `pm2 startup` + `pm2 save` on EC2 | ☐ | Boot persistence |
| 24 | `max_memory_restart` configured | ☐ | **Audit finding** |
| 25 | Log rotation / log paths | ☐ | |
| 26 | `deploy-web.sh` verifies BUILD_ID | ☐ | |
| 27 | `NEXT_PUBLIC_API_URL` matches production API | ☐ | |

---

## API deploy

| # | Item | Status | Notes |
|---|------|--------|-------|
| 28 | `deploy-api.sh` completes; `/ready` returns 200 | ☐ | |
| 29 | `prisma migrate deploy` success | ☐ | On container start |
| 30 | **Backup taken before migration** | ☐ | **Audit: Critical gap** |
| 31 | `scripts/smoke-deploy.js` pass | ☐ | |
| 32 | Remove or update hardcoded `REQUIRED_COMMIT` gate | ☐ | **Audit finding** |

---

## Telnyx Mission Control

| # | Item | Status | Notes |
|---|------|--------|-------|
| 33 | Call Control app webhook → **single** URL | ☐ | **Audit: TEL-001** |
| 34 | Voice/recording webhook URL documented | ☐ | Avoid duplicate `call.*` |
| 35 | Credential Connection webhook URL | ☐ | SIP registration |
| 36 | Outbound voice profile + recording enabled | ☐ | |
| 37 | Messaging webhook (if SMS enabled) | ☐ | |

---

## Backups & recovery

| # | Item | Status | Notes |
|---|------|--------|-------|
| 38 | Daily automated `pg_dump` → off-site (S3) | ☐ | **Audit: Critical** |
| 39 | Monthly restore drill documented | ☐ | `12-disaster-recovery.md` |
| 40 | Rollback procedure tested | ☐ | `08-rollback.md` |
| 41 | RTO/RPO documented | ☐ | |

---

## Health & monitoring

| # | Item | Status | Notes |
|---|------|--------|-------|
| 42 | Load balancer probes `/ready` (not `/health` only) | ☐ | |
| 43 | Alert on `/ready` != 200 | ☐ | |
| 44 | Telnyx webhook failure log monitoring | ☐ | **Audit: TEL-005** |
| 45 | Redis memory fallback alert | ☐ | |
| 46 | Disk space on upload volumes | ☐ | Greetings, proofs |

---

## Post-deploy smoke (Phase 3.7 subset)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 47 | Login tenant admin + employee | ☐ | |
| 48 | Dashboard loads < 5s | ☐ | |
| 49 | Inbound PSTN test call | ☐ | |
| 50 | Outbound mobile test call | ☐ | |
| 51 | QR provision new device | ☐ | |
| 52 | Voicemail + recording playback | ☐ | |

Full matrix: [08-production-testing-plan.md](./08-production-testing-plan.md)

---

## Sign-off

| Check | Name | Date |
|-------|------|------|
| Environment | | |
| Network / SSL | | |
| Telnyx config | | |
| Backups | | |
| Smoke tests | | |
