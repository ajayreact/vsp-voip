# Production Readiness Report — Phase 3.1

**Date:** 2026-06-24  
**Scope:** Full-system read-only audit (backend, web portal, mobile-rn, deployment)  
**Verdict:** **Conditional go** — pilot/production possible with documented mitigations; **not** enterprise-scale ready without Phase 3.2–3.6 remediation.

---

## Executive summary

VSP PBX has a **mature Call Control implementation** with bridge grace, atomic winner claims, tenant-scoped extension routing, and comprehensive portal administration (Phase 2 complete). Production deployment infrastructure (Nginx, SSL, Docker, PM2, health endpoints, Prisma migrations) is documented and partially automated.

**Primary risks before broad production:**

1. **Webhook idempotency** — Telnyx Call Control events are not deduplicated; dual webhook paths (`/webhook/call-control` and `/webhook/voice`) can process the same lifecycle event twice.
2. **Operational resilience** — No automated database backups in codebase; Docker may expose Postgres/Redis ports publicly.
3. **Session security** — 7-day JWT access tokens with no server-side revocation on logout.
4. **Performance at scale** — Extension analytics and admin dashboards perform unbounded or heavy CDR scans; `/api/softphone/config` calls Telnyx on every mobile registration.

**Strengths:**

- Tenant isolation enforced at schema (`@@unique([tenantId, extensionNumber])`) and API layer.
- Redis-backed Call Control session store with atomic `SET NX` winner claims.
- Stripe/Razorpay webhook idempotency (pattern exists; not applied to telephony webhooks).
- Production env validation (`lib/env.js`), Telnyx signature verification, rate limiting.
- 135+ telephony tests, 15 mobile tests, deployment smoke scripts.

---

## Severity rollup

| Severity | Count | Examples |
|----------|-------|----------|
| **Critical** | 1 | No automated DB backups |
| **High** | 9 | Webhook dedup, dual webhook paths, JWT lifetime, Docker port exposure, CDR scan hot paths, softphone config latency |
| **Medium** | 22 | Redis memory fallback, provisioning redeem race, tenant cache TTL, SMTP in `/ready`, pagination gaps |
| **Low** | 14 | Logging consistency, CORS LAN bypass, session TTL, deploy script drift |

Full detail in topic-specific audits linked from [README](./README.md).

---

## Component readiness matrix

| Component | Readiness | Notes |
|-----------|-----------|-------|
| Call Control / inbound PSTN | **Amber** | Strong FSM; webhook replay risk |
| Extension routing | **Green** | Tenant-scoped lookups; prior P0 `ext:NNN` fixed |
| Ring groups | **Green** | Entity model + Call Control integration tested |
| SIP / QR provisioning | **Amber** | Secure token model; redeem race; 7-day JWT on redeem |
| Mobile app (mobile-rn) | **Amber** | Functional; heavy config on startup |
| Tenant portal (web) | **Green** | Phase 2 admin pages complete; no browser telephony |
| Billing (Stripe/manual) | **Green** | Idempotent webhooks |
| Database | **Amber** | Migrations solid; backup automation missing |
| Deployment stack | **Amber** | Nginx/SSL good; hardening gaps |
| Monitoring | **Amber** | Health endpoints exist; in-memory telephony telemetry only |

**Legend:** Green = production acceptable at pilot scale · Amber = mitigations required · Red = blocker

---

## Go / no-go criteria (recommended)

| Criterion | Met? |
|-----------|------|
| Automated daily DB backup + tested restore | **No** |
| Redis required in production (`REDIS_REQUIRED=true`) | Documented; must be enforced |
| Telnyx webhooks → single canonical URL per event type | **Verify in Mission Control** |
| JWT access token ≤ 1 hour OR revocation on logout | **No** |
| Docker Postgres/Redis not public | **Verify on host** |
| Phase 3.7 telephony matrix executed on staging | Pending |
| All Critical/High findings have owner + target increment | Pending |

---

## Recommended remediation order (Phase 3.2+)

1. **3.2 Hardening:** Webhook event dedup, `call.initiated` guard, atomic provisioning redeem, dead-letter for failed async handlers.
2. **3.3 Multi-tenant:** Formal test matrix Tenant A/B/C × Extension 101; audit scripts.
3. **3.4 Security:** JWT lifecycle, SIP credential reveal audit logging, static upload review.
4. **3.5 Performance:** CDR indexes, analytics date windows, slim mobile config API (read-only cache first).
5. **3.6 Deployment:** Backup cron, port binding, PM2 hardening, `/ready` SMTP cache.
6. **3.7 Testing:** Execute [08-production-testing-plan.md](./08-production-testing-plan.md).

---

## Audit methodology

- Static code review: `lib/`, `routes/`, `server.js`, `prisma/schema.prisma`, `deploy/`, `mobile-rn/`
- Cross-reference: existing docs (`docs/vsp/phase2/05-multi-tenant-extension-isolation-audit.md`, deployment runbooks)
- Test inventory: `tests/telephony/` (31 files), `tests/mobile/` (7 files), validation scripts
- **No runtime changes** — no load tests or live Telnyx calls during 3.1

---

## Sign-off (pending)

| Role | Status | Date |
|------|--------|------|
| Engineering | Audit complete | 2026-06-24 |
| Security review | Pending | |
| Operations | Pending | |
| Product / go-live | Pending | |
