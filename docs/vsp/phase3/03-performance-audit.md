# Performance Audit — Phase 3.1

**Scope:** Database indexes, slow queries, dashboard/portal loading, mobile startup, call history.  
**Mode:** Read-only findings.

---

## Findings

### PERF-001 — Extension analytics unbounded CDR scan

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Root cause** | `lib/extensions.js` `computeExtensionAnalytics()` queries `callLog` by `from`/`to` phone numbers without date bound; no index on `from`/`to`. |
| **Recommendation** | Add rolling window (90d); add composite indexes `[tenantId, to, createdAt]` and `[tenantId, from, createdAt]`. |
| **Proposed fix** | Phase 3.5 migration + query change. |

---

### PERF-002 — Admin voice quality loads all 24h CDR into memory

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Root cause** | `lib/adminModules.js` `getVoiceQualityReport()` — `callLog.findMany` last 24h with no `take`. |
| **Recommendation** | SQL aggregation (`groupBy`, `avg`) instead of loading rows into Node. |
| **Proposed fix** | Rewrite report query with aggregates + pagination. |

---

### PERF-003 — `/api/softphone/config` heavy on every request

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Root cause** | Route calls Telnyx setup APIs (2–3 HTTP) + extension diagnostics with N+1 patterns per DID. |
| **Recommendation** | Cache setup status (Redis 5–15 min); split minimal mobile config from admin diagnostics. |
| **Proposed fix** | Phase 3.5: cache layer; optional `/api/softphone/config/mobile` (requires approval — API addition). |

---

### PERF-004 — Recordings list syncs Telnyx by default

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Root cause** | `GET /api/tenant/recordings` runs `syncCallRecordingsFromTelnyx` unless `sync=0`. |
| **Recommendation** | Portal already uses list-only; verify all clients pass `sync=0`; background sync job for prod. |
| **Proposed fix** | Default `sync=0` server-side in production env flag. |

---

### PERF-005 — Dashboard full `callLog.count` per tenant

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `routes/portal.js` `/dashboard/stats` — unbounded count for tenant lifetime. |
| **Recommendation** | Use rolling window or materialized counter table. |
| **Proposed fix** | Replace with 30-day count or cached KPI in Redis. |

---

### PERF-006 — `CallRecording` lookup by `callSid` unindexed

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `CallRecording` has `@@index([tenantId, createdAt])` only; `GET /api/calls` joins by `callSid IN (...)`. |
| **Recommendation** | Add `@@index([tenantId, callSid])`. |
| **Proposed fix** | Prisma migration in 3.5. |

---

### PERF-007 — No cursor pagination on call history

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `GET /api/calls` — `take: limit` max 100, no cursor/offset. |
| **Recommendation** | Add `cursor` (createdAt, id) for portal and mobile infinite scroll. |
| **Proposed fix** | API extension in 3.5 (backward compatible query params). |

---

### PERF-008 — Admin dashboard 20+ parallel aggregates

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `lib/adminDashboard.js` loads many KPIs on every super-admin home request. |
| **Recommendation** | Cache snapshot 1–5 min in Redis. |
| **Proposed fix** | `admin:dashboard:snapshot` key with TTL. |

---

### PERF-009 — No connection pool tuning

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `db.js` Prisma singleton without explicit pool limits. |
| **Recommendation** | PgBouncer or connection limit per `docs/vsp/roadmap/06-performance-plan.md`. |
| **Proposed fix** | RDS + PgBouncer in production topology. |

---

### PERF-010 — Mobile cold start: triple parallel API on Telnyx register

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `mobile-rn` `TelnyxCallingProvider` fetches token + full config + push on auth. |
| **Recommendation** | Defer diagnostics; reuse cached config when valid. |
| **Proposed fix** | React Query cache for config; align with PERF-003. |

---

### PERF-011 — Rate limiter in-memory fallback

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Root cause** | `lib/rateLimit.js` falls back to per-process memory if Redis unavailable. |
| **Recommendation** | Enforce `REDIS_REQUIRED=true` in production. |
| **Proposed fix** | Ops config (see deployment checklist). |

---

## Positive controls

- `CallLog`: `@@index([tenantId, createdAt])`, `@@index([tenantId, status, createdAt])`, unique `callSid`
- Portal call list: indexed sort `orderBy: { createdAt: 'desc' }`
- Recording join: batch `callSid IN (...)` not N+1
- Mobile: React Query 30s staleTime, deferred tab preload
- Pagination caps on recordings/voicemail (100)

---

## Summary

| Severity | Count |
|----------|-------|
| High | 4 |
| Medium | 5 |
| Low | 1 |

**First fixes (3.5):** PERF-001, PERF-006, PERF-003 (cache), PERF-004 (sync default).
