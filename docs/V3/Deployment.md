# Tenant Portal V3 — Deployment

**Version:** v3.0.0-rc1

---

## Prerequisites

- Node.js 20+, Docker Compose (EC2 production pattern)
- PostgreSQL 16, Redis 7
- Prisma migrations applied: `npm run migrate:deploy`
- Valid `.env` with Telnyx, JWT, database URLs

---

## Feature Flag Checklist

Before deploy, confirm:

```bash
V3_PORTAL_ENABLED=true          # API
NEXT_PUBLIC_V3_PORTAL=true      # Web build-time
V3_RUNTIME_SYNC_ENABLED=false   # Keep off until canary ready
V3_TEST_LAB_ENABLED=false       # Staging only
V3_TEST_LAB_ALLOW_PRODUCTION=false
```

---

## Staging Deploy (Recommended First)

On EC2 host at `/opt/vsp-voip`:

```bash
git fetch origin
git checkout release/v3.0.0-rc1
bash deploy/staging-v3-portal.sh
```

This script:

1. Sets V3 staging flags in `.env`
2. Runs `deploy/deploy-api.sh` (includes migrate deploy)
3. Builds web with `NEXT_PUBLIC_V3_PORTAL=true` via `deploy/deploy-web.sh`
4. Curl-checks `/health`, `/ready`, test-lab status

Default branch pin: `DEPLOY_BRANCH=release/v3.0.0-rc1` (override via env).

---

## Production Deploy (Manual)

Follow standard VSP deploy order:

```bash
# 1. API + migrations
bash deploy/deploy-api.sh

# 2. Web with V3 enabled
export NEXT_PUBLIC_V3_PORTAL=true
bash deploy/deploy-web.sh
```

### Post-deploy verification

```bash
curl -sf https://api.vspphone.com/ready | jq .
curl -sI https://app.vspphone.com/v3/dashboard | head -5
```

Confirm `build.gitCommit` matches deployed tag.

---

## Docker Services

| Service | V3 relevance |
|---------|--------------|
| `api` | Serves `/api/v3/*` |
| `postgres` | V3 schema migrations |
| `redis` | Runtime job enqueue (Phase 9) |
| `telephony-v3-worker` | Optional; required only when runtime sync enabled |

Worker deploy: see `docs/vsp/deployment/16-telephony-v3-worker.md`

---

## Migration Order

1. Deploy API container (runs `prisma migrate deploy` on start)
2. Verify `_prisma_migrations` includes latest V3 migration
3. Deploy web
4. Enable portal flag
5. Run Test Lab on staging tenant
6. (Optional) Enable runtime sync for allowlisted tenant

---

## Rollback

See [Rollback.md](./Rollback.md).

Quick portal disable without schema rollback:

```bash
# .env
V3_PORTAL_ENABLED=false
# Rebuild web without NEXT_PUBLIC_V3_PORTAL
bash deploy/deploy-web.sh
docker compose restart api
```

---

## Validation Scripts

```bash
npm run validate:migrations
npx vitest run tests/v3
npm run validate:v3-worker    # when worker enabled
```

---

## Related

- [Environment.md](./Environment.md)
- [Troubleshooting.md](./Troubleshooting.md)
- `docs/vsp/deployment/02-ec2-deployment.md`
