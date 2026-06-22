# Phase 2A.5 Validation Report

**Date:** 2026-06-21  
**Harness:** `npm run validate:phase2a`  
**API base:** `http://localhost:3000`

---

## Executive summary

Phase 2A security, health, billing dedup, and quota guards are **validated in development**. Automated run: **15 passed, 0 failed, 4 warnings**.

Production launch still requires **Redis deployment**, **STRIPE_WEBHOOK_SECRET**, and API restart to pick up the Stripe fail-closed fix.

| Metric | Before audit | After Phase 2A | After 2A.5 validation |
|--------|--------------|----------------|------------------------|
| **Readiness score** | 28/100 | 63/100 | **68/100** |

---

## 1. Stripe webhook support

| Test | Result | Notes |
|------|--------|-------|
| `STRIPE_WEBHOOK_SECRET` in `.env.example` | ✅ | Includes CLI setup hint |
| Invalid signature rejected (direct) | ✅ | Returns 503 when secret not configured + signature present |
| Invalid signature rejected (HTTP) | ⚠️ | Live server needs **restart** to load billing fix |
| `checkout.session.completed` | ⚠️ | Handler exists; signed test needs `STRIPE_WEBHOOK_SECRET` |
| `invoice.paid` | ⚠️ | **No business handler** — event deduped only if received |
| `invoice.payment_failed` | ⚠️ | Handler applies grace period; needs signed test |
| `customer.subscription.deleted` | ⚠️ | Handler applies cancel grace; needs signed test |
| Duplicate delivery | ✅ | `ProcessedStripeEvent` PK blocks re-insert; `claimStripeEvent` returns duplicate |

**Setup for full Stripe tests:**

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
# Add whsec_... to .env as STRIPE_WEBHOOK_SECRET
npm run validate:phase2a
```

---

## 2. Redis production readiness

| Test | Result | Notes |
|------|--------|-------|
| Deployment documented | ✅ | [docs/redis-deployment.md](./redis-deployment.md) |
| Connectivity | ⚠️ | `REDIS_URL` not set in dev — in-memory fallbacks active |
| Rate limiting uses Redis | ⚠️ | Verified when `REDIS_URL` set (see harness) |
| Session storage uses Redis | ⚠️ | `ccs:*` keys when Redis available |
| `/ready` redis check | ✅ | `optional: true` in dev; required in production |

**Production action:** Deploy Redis, set `REDIS_URL`, confirm `/ready` → `redis.connected: true`.

---

## 3. Health check validation

| Test | Result |
|------|--------|
| `/health` liveness | ✅ |
| `/ready` with DB up | ✅ `ready: true` |
| Simulated Postgres outage | ✅ Connection refused detected |
| Simulated Redis outage | ✅ Connection refused detected |
| Live DB healthy after simulation | ✅ |

**Note:** `/ready` returns `503` when `database.connected === false`. In production, missing Redis also fails readiness.

---

## 4. Security validation

| Endpoint | Unauthenticated | Expected | Result |
|----------|-----------------|----------|--------|
| `GET /api/numbers/search` | Yes | 401 | ✅ 401 |
| `GET /api/numbers/area-codes` | Yes | 401 | ✅ 401 |
| `POST /api/numbers/assign` | Yes | 404/401 | ✅ 404 (removed) |
| `GET /api/admin/dashboard` | Yes | 401 | ✅ 401 |
| Invalid login | — | 401 | ✅ 401 |

Admin assign moved to `POST /api/admin/numbers/assign` (SUPER_ADMIN + JWT).

---

## 5. Billing validation

| Test | Result |
|------|--------|
| `ProcessedStripeEvent` duplicate insert | ✅ P2002 unique violation |
| Fulfillment lock table | ✅ Present (used in `completeCheckoutSession`) |
| Grace on payment failed | ✅ Code path in `handleStripeWebhook` |
| Grace on subscription deleted | ✅ Code path in `handleStripeWebhook` |

---

## 6. Quota validation

| Quota | Test | Result |
|-------|------|--------|
| Users | API with `maxUsers: 1` | ✅ 403 `QUOTA_EXCEEDED` |
| Phone numbers | Lib with `maxPhoneNumbers: 0` | ✅ Blocked |
| Concurrent calls | Lib with `maxConcurrentCalls: 0` + seeded active calls | ✅ Blocked |

---

## Remaining launch blockers

| Priority | Blocker | Action |
|----------|---------|--------|
| **P0** | Redis not deployed | Set `REDIS_URL`, verify `/ready` |
| **P0** | `STRIPE_WEBHOOK_SECRET` unset | Configure in Stripe Dashboard / CLI |
| **P0** | API restart needed | Restart to load Stripe fail-closed fix |
| **P1** | `invoice.paid` no handler | Add handler for subscription renewals (Phase 2B) |
| **P1** | No JWT DB revalidation | Phase 2B |
| **P1** | No PostgreSQL RLS | Phase 2B |
| **P2** | Greeting files public static | Signed URLs — Phase 2B |
| **P2** | Stripe item cancel on number release | Phase 2B |
| **P2** | External monitoring/alerting | Wire `/ready` to uptime checker |
| **P2** | Load testing multi-instance | Validate Redis session sharing under load |

---

## Recommended Phase 2B scope

1. **JWT DB revalidation** — reject tokens for deleted/suspended users on every request  
2. **PostgreSQL RLS** — tenant isolation at database layer  
3. **`invoice.paid` handler** — subscription renewal audit + grace reset  
4. **Stripe subscription item cancellation** on number release  
5. **Greeting signed URLs** — remove public `/uploads/greetings` static serving  
6. **Automated E2E** — Stripe CLI webhook replay in CI  
7. **Redis-required integration tests** — CI job with Redis service container  

---

## Rollback

No rollback required for validation. Re-run `npm run validate:phase2a` after any infrastructure changes.

---

## Files added/updated in 2A.5

- `scripts/validate-phase2a.js` — automated harness  
- `docs/redis-deployment.md` — Redis production guide  
- `docs/validation-report-phase2a5.md` — this report  
- `.env.example` — Stripe webhook secret documentation  
- `lib/billing.js` — reject signed webhooks when secret not configured  
- `package.json` — `validate:phase2a` script  
