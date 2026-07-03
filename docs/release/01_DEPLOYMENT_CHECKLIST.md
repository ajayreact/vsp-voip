# RC1 Deployment Checklist

**Release:** v3.0.0-rc1  
**Branch:** `release/v3.0.0-rc1`  
**Target commit:** `b724754` (or latest on release branch)  
**Host:** EC2 `/opt/vsp-voip`

---

## Pre-Deploy

| # | Step | Command / Action | ✓ |
|---|------|------------------|---|
| 1 | Confirm maintenance window communicated | Ops + tenant admins notified | ☐ |
| 2 | Backup PostgreSQL | `pg_dump` or infra snapshot | ☐ |
| 3 | Record current git SHA | `git rev-parse HEAD` | ☐ |
| 4 | Record current tag | `git describe --tags` | ☐ |
| 5 | Confirm rollback point documented | See `07_ROLLBACK_PLAYBOOK.md` | ☐ |

---

## Git Checkout

```bash
cd /opt/vsp-voip
git fetch origin
git checkout release/v3.0.0-rc1
git pull origin release/v3.0.0-rc1
```

| # | Verification | Expected | ✓ |
|---|--------------|----------|---|
| 6 | Branch | `release/v3.0.0-rc1` | ☐ |
| 7 | Commit SHA | Matches release notes / tag target | ☐ |
| 8 | Working tree | Clean on server (no local edits) | ☐ |

---

## Tag Verification

```bash
git rev-parse HEAD
git rev-parse v3.0.0-rc1   # should match HEAD after retag
git log -1 --oneline
```

| # | Check | ✓ |
|---|-------|---|
| 9 | Tag `v3.0.0-rc1` points to deployed commit | ☐ |
| 10 | `/ready` → `build.gitCommit` matches deployed SHA | ☐ |

**Note:** If local tag is stale (`cd07ef4`), retag before production deploy:

```bash
git tag -d v3.0.0-rc1
git tag -a v3.0.0-rc1 -m "Tenant Portal V3 RC1"
```

---

## Environment Variables

Set in `/opt/vsp-voip/.env` before deploy:

| Variable | RC1 Production | Staging |
|----------|----------------|---------|
| `V3_PORTAL_ENABLED` | `true` | `true` |
| `NEXT_PUBLIC_V3_PORTAL` | `true` (web build) | `true` |
| `V3_RUNTIME_SYNC_ENABLED` | **`false`** | `false` (until canary) |
| `V3_RUNTIME_SYNC_TENANT_ALLOWLIST` | empty | canary UUID only |
| `V3_TEST_LAB_ENABLED` | **`false`** | `true` |
| `V3_TEST_LAB_ALLOW_PRODUCTION` | **`false`** | `true` (staging only) |
| `TELEPHONY_V3_*` | **`false`** | per canary plan |

| # | Check | ✓ |
|---|-------|---|
| 11 | `.env` reviewed — no accidental JWT/Telnyx changes | ☐ |
| 12 | `DATABASE_URL`, `REDIS_URL` unchanged | ☐ |
| 13 | `WEB_ORIGIN`, `API_PUBLIC_URL` correct | ☐ |

---

## Prisma Migrate Deploy

Migrations run automatically via API Docker entrypoint. Manual verify:

```bash
docker compose exec api npx prisma migrate status
npm run validate:migrations   # from repo root if running locally
```

| # | Check | ✓ |
|---|-------|---|
| 14 | No pending migrations | ☐ |
| 15 | Latest V3 migration present: `20260703220000_v3_test_lab_run` | ☐ |
| 16 | `validate:migrations` PASSED | ☐ |

---

## Build API

```bash
export DEPLOY_BRANCH=release/v3.0.0-rc1
export DEPLOY_COMMIT=b724754   # optional pin
export GIT_COMMIT=$(git rev-parse HEAD)
bash deploy/deploy-api.sh
```

| # | Check | ✓ |
|---|-------|---|
| 17 | Docker build completed without error | ☐ |
| 18 | `docker compose ps api` → healthy | ☐ |
| 19 | `/ready` returns `true` | ☐ |
| 20 | `/ready/v3` checked (if worker deployed) | ☐ |

---

## Build Web

```bash
export NEXT_PUBLIC_V3_PORTAL=true
export DEPLOY_COMMIT=b724754   # optional pin
bash deploy/deploy-web.sh
```

| # | Check | ✓ |
|---|-------|---|
| 21 | `npm ci` + build succeeded | ☐ |
| 22 | PM2 `vsp-web` online | ☐ |
| 23 | Hard refresh / incognito shows V3 nav | ☐ |

---

## PM2 Restart

Web deploy script restarts PM2. Manual if needed:

```bash
pm2 restart vsp-web
pm2 status vsp-web
pm2 logs vsp-web --lines 30
```

| # | Check | ✓ |
|---|-------|---|
| 24 | PM2 status `online` | ☐ |
| 25 | No crash loop in logs | ☐ |

---

## Docker Restart

API deploy handles container restart. Full stack if needed:

```bash
docker compose restart api
docker compose ps
```

| # | Check | ✓ |
|---|-------|---|
| 26 | API container running | ☐ |
| 27 | Postgres + Redis healthy | ☐ |
| 28 | Worker **not** enabled unless canary approved | ☐ |

---

## Health Checks

```bash
curl -sf https://api.vspphone.com/health
curl -sf https://api.vspphone.com/ready | jq .
curl -sI https://app.vspphone.com/v3/dashboard | head -5
curl -s -o /dev/null -w "%{http_code}\n" https://api.vspphone.com/api/v3/health
# Expect 401 without JWT — confirms route exists, not 404
```

| # | Endpoint | Expected | ✓ |
|---|----------|----------|---|
| 29 | `/health` | 200 | ☐ |
| 30 | `/ready` | 200, all deps true | ☐ |
| 31 | `/v3/dashboard` | 200 or 302 to login | ☐ |
| 32 | `/api/v3/*` without auth | 401 (not 404) | ☐ |
| 33 | Git SHA in `/ready` matches deploy | ☐ |

---

## Rollback Points

Record before deploy:

| Rollback point | Value |
|----------------|-------|
| Git commit (pre-deploy) | ________________ |
| Git tag | ________________ |
| DB snapshot ID | ________________ |
| `.env` backup path | ________________ |
| PM2 / Docker image ID | ________________ |

---

## Post-Deploy

| # | Action | ✓ |
|---|--------|---|
| 34 | Run `08_POST_DEPLOY_VALIDATION.md` | ☐ |
| 35 | Begin UAT per `02_UAT_CHECKLIST.md` | ☐ |
| 36 | Do **not** enable runtime sync until canary approved | ☐ |

---

## Quick Staging Path

```bash
export DEPLOY_BRANCH=release/v3.0.0-rc1
bash deploy/staging-v3-portal.sh
```

---

## Related

- `06_PRODUCTION_ROLLOUT.md`
- `07_ROLLBACK_PLAYBOOK.md`
- `docs/V3/Deployment.md`
