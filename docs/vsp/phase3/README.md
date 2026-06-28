# Phase 3 — Production Readiness

**Status:** Phase 2 feature-complete. Feature development **frozen**.  
**Current increment:** 3.2 — Production hardening (3.2.1 webhook deduplication shipped)

---

## Scope

Prepare VSP PBX for production deployment: stability, reliability, scalability, security, and operational readiness.

| Increment | Focus | Status |
|-----------|-------|--------|
| 3.1 | Production audit | **Complete** |
| 3.2.1 | Webhook idempotency / event deduplication | **Complete** |
| 3.2.1b | Inbound caller ID validation (Softphone V2) | **Complete** — [09-inbound-caller-id-validation.md](./09-inbound-caller-id-validation.md) |
| 3.2 | Remaining production hardening | In progress |
| 3.3 | Multi-tenant validation | Pending |
| 3.4 | Security audit (remediation) | Pending |
| 3.5 | Performance | Pending |
| 3.6 | Production deployment | Pending |
| 3.7 | End-to-end production validation | Pending |

### Phase 3.2.1 — Webhook deduplication

Telnyx delivers Call Control webhooks **at-least-once**. Duplicate deliveries are dropped at ingress using `data.id` as a global idempotency key (shared across `/webhook/call-control` and `/webhook/voice`).

| Item | Detail |
|------|--------|
| Module | `lib/telnyxWebhookDedup.js` |
| Storage | Redis `SET key NX EX ttl` when `REDIS_URL` is set; in-process TTL map fallback |
| Key | `telnyx:webhook:event:{data.id}` |
| TTL | `TELNYX_WEBHOOK_DEDUP_TTL_SEC` (default **86400**, min 60, max 604800) |
| Migration | None — Redis keys expire automatically |
| API change | Webhook 200 responses may include `{ duplicate: true }` for ignored retries (Telnyx-facing only) |

Ignored duplicates log `telnyx_webhook_duplicate_ignored` with `eventId`, `eventType`, `source`, and Telnyx `meta.attempt` when present.

---

## Deliverables (Phase 3.1)

| Document | Description |
|----------|-------------|
| [01-production-readiness-report.md](./01-production-readiness-report.md) | Executive summary, severity rollup, go/no-go criteria |
| [02-security-audit.md](./02-security-audit.md) | Auth, JWT, provisioning, API permissions, tenant isolation |
| [03-performance-audit.md](./03-performance-audit.md) | Database, portal, mobile, call history hot paths |
| [04-telephony-audit.md](./04-telephony-audit.md) | Call Control, webhooks, idempotency, cleanup, Telnyx integration |
| [05-multi-tenant-audit.md](./05-multi-tenant-audit.md) | Extension 101 × N tenants, lookup audit, isolation gaps |
| [06-deployment-checklist.md](./06-deployment-checklist.md) | PM2, Nginx, SSL, backups, migrations, env, health |
| [07-telnyx-compliance.md](./07-telnyx-compliance.md) | Deviations from official Telnyx documentation |
| [08-production-testing-plan.md](./08-production-testing-plan.md) | Phase 3.7 validation matrix |

---

## Rules

1. **No feature development** — UI, telephony features, and new APIs are frozen.
2. **No fixes during 3.1** — findings only; remediation in 3.2+ after approval.
3. **Backend telephony frozen** — Call Control, PSTN routing, SIP/QR provisioning unchanged unless approved production bug fix.
4. Each finding includes: **Severity**, **Root cause**, **Recommendation**, **Proposed fix**.

---

## Related prior audits

- [Phase 2 multi-tenant isolation audit](../phase2/05-multi-tenant-extension-isolation-audit.md) (2026-06-24)
- [Backend telephony freeze](../phase2/06-backend-telephony-freeze.md)
- [Production checklist](../../deploy/PRODUCTION-CHECKLIST.md)
