# Multi-Tenant Audit — Phase 3.1

**Requirement:** Tenant A Extension 101, Tenant B Extension 101, Tenant C Extension 101 must **never conflict**.  
**Correct lookup:** `tenantId + extensionNumber` — never `extensionNumber` alone.  
**Mode:** Read-only verification against codebase (extends [Phase 2 audit](../phase2/05-multi-tenant-extension-isolation-audit.md)).

---

## Executive verdict

| Area | Verdict |
|------|---------|
| Database schema | **Pass** |
| Inbound PSTN (Call Control) | **Pass** |
| Internal extension dialing | **Pass** (P0 remediated) |
| REST APIs / portal | **Pass** |
| Ring groups | **Pass** |
| SIP registration identity | **Amber** (global username lookup by design) |
| Dev/ops scripts | **Amber** (some scripts tenant-agnostic) |

---

## Schema isolation

```prisma
// Extension
@@unique([tenantId, extensionNumber])

// RingGroup  
@@unique([tenantId, extensionNumber])
@@unique([tenantId, name])
```

| Model | Isolation | Notes |
|-------|-----------|-------|
| `Extension` | Composite unique | Same ext number allowed per tenant |
| `RingGroup` | Composite unique | Same virtual ext per tenant |
| `PhoneNumber` | Global E.164 unique | Correct — DID resolves tenant first |
| `User.telnyxSipUsername` | Indexed, not unique in schema | Telnyx usernames globally unique in practice |

---

## Extension lookup audit

### Pass — tenant-scoped queries

| Path | Pattern | File |
|------|---------|------|
| Load extension by ID | `where: { id, tenantId }` | `lib/extensions.js` |
| Internal dial target | `loadTargetExtension(prisma, tenantId, extensionNumber)` | `lib/internalExtensionDial.js` |
| Inbound routing | DID → tenant → extension | `lib/inboundCallControl.js` `resolveInboundContext()` |
| Ring group by ext | `loadRingGroupByExtensionNumber(prisma, tenantId, ...)` | `lib/ringGroupRouter.js` |
| Portal APIs | `req.user.tenantId` filter | `routes/portal.js`, `routes/extensions.js` |
| Call history | `where: { tenantId }` | `GET /api/calls` |

### Remediated — P0 global `ext:NNN` lookup

| Field | Detail |
|-------|--------|
| **Severity** | Was Critical — **now Pass** |
| **Root cause** | Previously `resolveCallerFromPayload` could query `extensionNumber` without `tenantId`. |
| **Current state** | Comment + code at `lib/internalExtensionDial.js:108–109` explicitly blocks bare `ext:NNN`; test enforces (`tenant-extension-isolation.test.ts`). |
| **Recommendation** | Keep regression test in CI. |
| **Proposed fix** | None required. |

---

## Findings (residual)

### MT-001 — Global SIP username resolution

| Field | Detail |
|-------|--------|
| **Severity** | Low (accepted design) |
| **Root cause** | `resolveCallerFromAddress()` queries `user.findFirst({ telnyxSipUsername })` without `tenantId`. |
| **Mitigation** | Telnyx assigns globally unique SIP usernames; legacy desk path resolves via extension.tenantId. |
| **Recommendation** | Complete legacy desk credential migration; add `@@unique` on `telnyxSipUsername` at platform level when safe. |
| **Proposed fix** | Migration script + schema constraint in 3.3 validation phase. |

---

### MT-002 — Tenant cache 24h TTL

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `lib/tenantCache.js` Redis `EX 86400`; stale routing if DID reassigned without invalidation. |
| **Recommendation** | Audit all DID assign/release paths call `invalidateCachedTenant()`. |
| **Proposed fix** | Shorter TTL (1h) or mandatory invalidation hooks in admin DID management. |

---

### MT-003 — Messaging tenant resolution fallback

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `WebhookService.handleInboundReceived()` may try `from` number if `to` fails. |
| **Recommendation** | Inbound SMS tenant should resolve from called number (`to`) only. |
| **Proposed fix** | Remove `from` fallback for tenant resolution. |

---

### MT-004 — Dev scripts without tenant context

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Root cause** | Some validation/audit scripts query by extension number alone (ops-only, not production paths). |
| **Recommendation** | Require `--tenant-id` flag on scripts; never run against prod without tenant. |
| **Proposed fix** | Script hardening in 3.3. |

---

## Phase 3.3 validation matrix (planned execution)

| Scenario | Tenant A | Tenant B | Tenant C | Expected |
|----------|----------|----------|----------|----------|
| Extension 101 exists | ✓ | ✓ | ✓ | No DB conflict |
| Inbound to DID-A → ext 101 | rings A-101 only | — | — | Tenant from DID |
| Inbound to DID-B → ext 101 | — | rings B-101 only | — | Tenant from DID |
| Mobile user A dials 101 | reaches A-101 | not B/C | not B/C | Caller tenant context |
| Ring group ext 200 | unique per tenant | unique per tenant | unique per tenant | Composite unique |
| Portal lists extensions | A only | B only | C only | JWT tenantId |
| QR provision tenant A ext | credentials A | cannot redeem B token | — | Token bound to ext |

**Automated coverage today:** `tests/telephony/tenant-extension-isolation.test.ts`, `tenant-routing.test.ts`  
**Gap:** No live three-tenant integration test in CI.

---

## Summary

Multi-tenant isolation is **production-acceptable for pilot** with schema and API enforcement in place. Residual risks are cache staleness, messaging fallback, and operational scripts — not core Call Control routing.

**Phase 3.3 action:** Execute manual matrix above on staging with three test tenants; add optional CI fixture with seeded tenants A/B/C.
