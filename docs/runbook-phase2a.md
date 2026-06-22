# Phase 2A Operations Runbook

## Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — process up |
| `GET /ready` | Readiness — DB, Redis, Telnyx key, Stripe config |
| `GET /api/admin/monitoring/platform-health` | Super-admin readiness dashboard (auth required) |

## Required production environment

- `DATABASE_URL`, `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY`
- `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`
- `REDIS_URL`
- `STRIPE_WEBHOOK_SECRET` (when Stripe billing is enabled)

Startup fails fast if any required variable is missing (`lib/env.js`).

## Redis

See [redis-deployment.md](./redis-deployment.md) for production setup, key prefixes, and troubleshooting.

## Validation

Run automated Phase 2A.5 checks:

```bash
npm run validate:phase2a
```

Report: [validation-report-phase2a5.md](./validation-report-phase2a5.md)

## Deploy sequence

1. `npx prisma migrate deploy`
2. Start API with Redis reachable
3. Verify `GET /ready` returns `ready: true`
4. Confirm Telnyx webhooks reach `/webhook`, `/webhook/call-control`, `/webhook/sms`

## Billing grace job

On startup and hourly, `expireBillingGracePeriods()` suspends tenants whose grace period ended.

## Rollback

1. Revert application to previous image/commit
2. **Do not** roll back Phase 2A migration — all changes are additive
3. If Redis unavailable, rate limits fail closed in production; restore Redis or temporarily run single instance with `NODE_ENV=development` only in emergency (not recommended)

## Incident: suspended tenant still receiving calls

Check `Tenant.isActive`, `billingStatus`, `billingGraceUntil`. Inbound TeXML and Call Control both block non-operational tenants.
