# Tenant Portal V3 — Deployment

**RC1:** v3.0.0-rc1

## Prerequisites

- PostgreSQL 16, Redis 7, Docker Compose (EC2)
- Prisma migrations applied
- `.env` with JWT, Telnyx, DATABASE_URL, REDIS_URL

## Environment

```bash
V3_PORTAL_ENABLED=true
NEXT_PUBLIC_V3_PORTAL=true          # web build-time
V3_RUNTIME_SYNC_ENABLED=false       # RC1 default
V3_TEST_LAB_ENABLED=false           # production
V3_TEST_LAB_ALLOW_PRODUCTION=false
```

## Staging

```bash
git checkout release/v3.0.0-rc1
bash deploy/staging-v3-portal.sh
```

## Production

```bash
bash deploy/deploy-api.sh
export NEXT_PUBLIC_V3_PORTAL=true
bash deploy/deploy-web.sh
```

## Verification

```bash
curl -sf https://api.vspphone.com/ready | jq .
curl -sI https://app.vspphone.com/v3/dashboard | head -5
npm run validate:migrations
npx vitest run tests/v3
```

## Order

1. Migrations → 2. API → 3. Web → 4. Flags → 5. Test Lab (staging) → 6. Migration cutover

## Rollback

Set `V3_PORTAL_ENABLED=false`, redeploy web without V3 flag, restart API. No schema rollback required for portal disable.

## Operations

Confirm `build.gitCommit` matches deployed tag. Check `docker compose logs api --tail=50` after deploy.
