# V3.0.0 — Installation Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 16, Redis 7
- Docker Compose (EC2 production)
- PM2 (web portal)
- Valid Telnyx account and API key
- JWT secret configured

## Step 1 — Clone and Checkout

```bash
cd /opt/vsp-voip
git fetch origin
git checkout release/v3.0.0-rc1   # or v3.0.0 after GA tag
git pull
git rev-parse HEAD                # record SHA
```

## Step 2 — Environment

Copy and configure `.env`:

```bash
V3_PORTAL_ENABLED=true
NEXT_PUBLIC_V3_PORTAL=true
V3_RUNTIME_SYNC_ENABLED=false
V3_TEST_LAB_ENABLED=false
V3_TEST_LAB_ALLOW_PRODUCTION=false
DATABASE_URL=...
REDIS_URL=...
JWT_SECRET=...
TELNYX_API_KEY=...
API_PUBLIC_URL=https://api.vspphone.com
WEB_ORIGIN=https://app.vspphone.com
```

See `ENVIRONMENT_VARIABLES.md` for full list.

## Step 3 — Database

```bash
npm run migrate:deploy
npm run validate:migrations
npx prisma validate
```

## Step 4 — API

```bash
export DEPLOY_BRANCH=release/v3.0.0-rc1
bash deploy/deploy-api.sh
curl -sf http://127.0.0.1:3000/ready | jq .
```

## Step 5 — Web

```bash
export NEXT_PUBLIC_V3_PORTAL=true
bash deploy/deploy-web.sh
pm2 status vsp-web
```

## Step 6 — Verify

- `https://api.vspphone.com/ready` — all checks true
- `https://app.vspphone.com/v3/dashboard` — loads after login
- `npx vitest run tests/v3` — 130/130 pass

## Step 7 — UAT

Complete `docs/release/02_UAT_CHECKLIST.md` before production rollout.

## Optional — Staging Script

```bash
export DEPLOY_BRANCH=release/v3.0.0-rc1
bash deploy/staging-v3-portal.sh
```
