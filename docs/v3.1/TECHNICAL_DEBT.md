# V3.1 Technical Debt Report

**Version:** Planning document  
**Date:** 2026-07-03  
**Baseline:** V3 RC1 frozen

---

## 1. Code Cleanup

| Item | Location | Severity | V3.1 Action |
|------|----------|----------|-------------|
| Monolithic routes file | `routes/v3.js` (~1750 lines) | Medium | Split into `routes/v3/*.js` by phase |
| Duplicate path casing in glob | `lib/v3/` backslash duplicates | Low | Normalize on case-sensitive CI |
| Structured console in employeeService | `[PBX REBUILD]` logs | Low | Migrate to structured logger |
| JSON string fields in UI | business-hours, ring-groups pages | Medium | Visual editors |
| Uncommitted test fix | `tests/v3/softphoneHealthService.test.ts` | Low | Commit on feature/v3.1 |
| `mountPbxCrud` generic pattern | routes/v3.js | Low | Document; consider code gen |
| Inconsistent error codes | Various services | Low | Standardize error code enum |

---

## 2. Duplicated Logic

| Pattern | Instances | Recommendation |
|---------|-----------|----------------|
| `requireTenant` + admin checks | Every route | Extract route factory helpers |
| List + validate + CRUD | 5 PBX entities | Already uses `mountPbxCrud` — extend pattern |
| Health aggregation fan-out | health, dashboard, analytics | Shared health snapshot service |
| Telnyx readiness checks | numbers, marketplace | Single readiness cache |
| Tenant scope in services | All services | Prisma middleware or base repository |
| Frontend role guards | Many pages | Shared `useV3Admin()` hook |
| Repair inspect/apply | tenant, number, device | Unified repair orchestrator |

---

## 3. Performance Debt

| Issue | Impact | Fix |
|-------|--------|-----|
| Dashboard parallel queries | Slow >50 employees | Cache + single aggregate |
| Health center cold compute | Every page load | Redis snapshot TTL 60s |
| Migration discovery full scan | Large tenants timeout | Paginated discovery |
| Export/import in-memory JSON | OOM on large tenants | Stream to S3 |
| Analytics live aggregation | DB CPU | Rollup tables |
| No query timeouts on V3 routes | Hung requests | Express timeout middleware |

---

## 4. Testing Debt

| Gap | Current | Target |
|-----|---------|--------|
| V3 E2E browser tests | None for /v3/* | Playwright smoke suite |
| API integration tests | 2 env failures | Fix auth test fixtures |
| Runtime adapter integration | Unit only | Staging integration job |
| Migration wizard E2E | 7 unit tests | Full wizard flow test |
| Load testing V3 API | None | k6 dashboard/health |
| Telephony smoke | Manual checklist | Automated in CI staging |
| Coverage reporting | Vitest JSON | CI coverage gate for lib/v3 |

---

## 5. Documentation Debt

| Gap | Priority |
|-----|----------|
| Screenshot placeholders in admin guides | Medium |
| OpenAPI machine-readable spec | High |
| API_REFERENCE hand-maintained | Medium — auto-gen |
| `.env.example` missing V3 vars | Medium |
| RC1 doc SHA drift (82aa5bf vs b724754) | Low |
| Postman collection | Low |
| Video walkthroughs | Low |
| i18n docs | Low |

---

## 6. Schema Improvements (Planning Only — No RC1 Changes)

| Proposal | Rationale | Risk |
|----------|-----------|------|
| `V3HealthSnapshot` table | Cached health aggregates | Low |
| `V3WebhookSubscription` | Outbound event delivery | Medium |
| `V3ApiKey` | Scoped integrator access | Medium |
| `V3AuditExport` | Compliance batch jobs | Low |
| Index on `V3RuntimeSyncJob(tenantId, status)` | Already indexed | Verify query plans |
| Soft delete consistency | Some models use `removedAt`, others don't | Medium refactor |
| `V3CallFlow.version` history table | Version diff | Medium |

**Note:** All schema changes require migration approval and are **out of scope for RC1**.

---

## 7. Deployment Improvements

| Item | Current | V3.1 Target |
|------|---------|-------------|
| `staging-v3-portal.sh` branch | `backup/pre-v3-staging` | `release/v3.0.0` / `main` |
| `deploy-web.sh` git pull | `main` only | Parameterized branch |
| Tag alignment | Stale `v3.0.0-rc1` | CI tag verification |
| `/ready/v3` in deploy | Manual | Automated gate |
| Docker API restart policy | Missing | `unless-stopped` |
| Postgres/Redis public ports | Exposed in compose | Internal network only |
| PM2 zero-downtime | stop/start | Graceful reload |
| Blue-green V3 deploy | None | Optional for GA |

---

## Debt Priority Matrix

| Category | P0 (V3.1.0) | P1 (V3.1.x) | P2 (V3.2+) |
|----------|---------------|-------------|--------------|
| Code cleanup | Test fix commit | Route split, JSON UI | Logger migration |
| Duplicated logic | Health snapshot | Route factories | Unified repair |
| Performance | Dashboard cache | Export streaming | Rollup tables |
| Testing | CI auth fix | Playwright V3 | k6 load |
| Documentation | OpenAPI spec | Screenshots | Video |
| Schema | — | Webhook table | SSO tables |
| Deployment | Branch defaults | /ready/v3 gate | HA |

---

## Estimated Remediation Effort

| Category | Engineer-Weeks |
|----------|----------------|
| Code cleanup | 3–4 |
| Duplicated logic refactors | 4–5 |
| Performance | 3–4 |
| Testing | 4–6 |
| Documentation | 2–3 |
| Schema (V3.1 proposals) | 2–3 |
| Deployment | 1–2 |
| **Total** | **19–27 weeks** (overlaps with roadmap features) |

---

## Related

- `ROADMAP.md`
- `GAP_ANALYSIS.md`
