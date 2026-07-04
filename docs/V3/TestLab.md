# Tenant Portal V3 — Test Lab

**RC1:** v3.0.0-rc1

## Purpose

Staging validation harness for super-admins to run automated checks against a tenant before production cutover.

## Service

`lib/v3/testLabService.js`

## Feature Flags

```bash
V3_TEST_LAB_ENABLED=true              # required
V3_TEST_LAB_ALLOW_PRODUCTION=false    # keep false in prod
```

Blocks `vspphone.com` hosts unless allow-production is explicitly set (staging only).

## API (Super-admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v3/test-lab/status` | Lab enabled state |
| GET | `/api/v3/test-lab/runs` | Run history |
| GET | `/api/v3/test-lab/runs/:runId` | Run detail |
| POST | `/api/v3/test-lab/run` | Execute suite |
| POST | `/api/v3/test-lab/teardown` | Teardown test tenant |

## UI

`/v3/test-lab` — `runV3SuperAdminGuard`

## Model

`V3TestLabRun` — persisted results.

## Checks Include

Inventory health, call flow validation, softphone UX, runtime links (skipped if sync disabled), ring group fallback.

## Deployment

Enable only on staging API. Never leave `V3_TEST_LAB_ALLOW_PRODUCTION=true` on production long-term.

## Rollback

Teardown endpoint removes test artifacts. No impact on production tenants when scoped correctly.

## Operations

Run before Migration Wizard execute. Review run ID and failed checks. Runtime telephony checks require manual follow-up when sync disabled.

## Tests

`tests/v3/testLabService.test.ts`
