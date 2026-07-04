# V3 Deployment Guide (Developer)

## Branches

| Branch | Purpose |
|--------|---------|
| `release/v3.0.0-rc1` | RC1 / pre-GA |
| `main` | Production (after GA merge) |
| `feature/v3.1` | Post-GA enhancements |

## Deploy Order

1. Migrations (`deploy-api.sh` runs migrate deploy)
2. API container
3. Web (PM2) with `NEXT_PUBLIC_V3_PORTAL=true`

## Scripts

| Script | Purpose |
|--------|---------|
| `deploy/deploy-api.sh` | API Docker rebuild |
| `deploy/deploy-web.sh` | Next.js build + PM2 |
| `deploy/staging-v3-portal.sh` | Staging portal flags |
| `deploy/staging-v3-runtime-canary.sh` | Runtime canary |

## Verify

```bash
curl -sf .../ready | jq .build.gitCommit
```

## Environment

See `release/v3.0.0/ENVIRONMENT_VARIABLES.md`

## Full Checklists

- `docs/release/01_DEPLOYMENT_CHECKLIST.md`
- `release/v3.0.0/INSTALL.md`

## Do Not

- Deploy feature branches to production
- Enable runtime sync without ops approval
- Skip migration validation
