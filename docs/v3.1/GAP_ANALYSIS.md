# V3.1 Gap Analysis

**Version:** Planning document (post-RC1)  
**Date:** 2026-07-03  
**Status:** Planning only — no implementation  
**Baseline:** Tenant Portal V3 RC1 (`release/v3.0.0-rc1`)

---

## Scope Reviewed

| Area | Files / Surface | RC1 State |
|------|-----------------|-----------|
| V3 services | 62 modules + 12 runtime (`lib/v3/`) | Feature complete for Phases 1–10 |
| APIs | 96 handlers (`routes/v3.js`) | Complete, monolithic route file |
| Frontend | 43 pages, 3 shared components | Functional; JSON-in-form UX in places |
| Runtime adapters | 10 adapters | Shipped; disabled by default |
| Migration Wizard | 6-step orchestration | Complete; post-validate internal only |
| Repair services | tenant, number, device, runtime | Inspect/apply pattern |
| Health center | aggregated multi-service health | Read-heavy; no historical trends |
| Operations center | dashboard, analytics, monitoring | Basic charts from DB aggregates |
| Marketplace | Telnyx search/purchase/assign | Super-admin only |
| Call flow builder | visual builder + simulator | Config only until runtime sync |
| Desk phones | CRUD, provision, templates | No auto-discovery / ZTP at scale |
| Runtime sync | job enqueue + links | Not production-canary validated |

---

## 1. Missing Enterprise Features

| Gap | Current State | Enterprise Expectation |
|-----|---------------|------------------------|
| SSO / SAML / OIDC | JWT email/password only | Azure AD, Google, Okta |
| SCIM provisioning | Manual employee create | Automated user lifecycle |
| Multi-tenant analytics | Per-tenant only | Cross-tenant ops dashboards |
| Tenant branding / white-label | Single VSP theme | Custom logo, colors, domain |
| Advanced RBAC | 3 roles (USER, TENANT_ADMIN, SUPER_ADMIN) | Custom roles, granular permissions |
| Audit export / SIEM | Writes to `adminAuditLog` | Streaming to Splunk/Datadog |
| Compliance reporting | None in V3 | SOC2/HIPAA/GDPR evidence packs |
| SLA / uptime dashboard | Basic production-health | Per-tenant SLA tracking |
| API keys for integrations | JWT user tokens only | Scoped service accounts |
| Webhooks (outbound) | None for V3 events | tenant.config.changed, migration.complete |
| CRM integrations | None | Salesforce, HubSpot contact sync |
| Teams / Slack | None | Presence sync, click-to-call |
| Multi-region / HA | Single EC2 deployment | Active-passive or multi-AZ |
| Disaster recovery automation | Manual backup/restore | Scheduled DR drills, RPO/RTO metrics |
| Number porting workflow | Marketplace purchase only | LOA, port-in status tracking |
| Bulk operations | Single-entity CRUD | CSV import, bulk extension update |

---

## 2. Scalability Improvements

| Gap | Risk | V3.1 Direction |
|-----|------|----------------|
| Monolithic `routes/v3.js` (~1750 lines) | Maintainability at 100+ endpoints | Split by phase domain |
| Dashboard N+1 queries | Slow for large tenants | Materialized views / caching |
| Runtime job queue unbounded | Redis depth under bulk resync | Backpressure, batch limits |
| No pagination standard | Inconsistent limit/offset | Cursor-based pagination API |
| Single worker ID in compose | Cannot scale workers | Worker pool + lease model |
| Health center full recompute | Expensive on every load | Cached health snapshots |
| Test Lab single-tenant runs | No parallel batch validation | Queue-based test orchestration |
| Large tenant backup payload | Memory pressure on export | Streaming export to S3 |
| Analytics from live queries | DB load | Pre-aggregated metrics tables |

---

## 3. Security Improvements

| Gap | Current | V3.1 Target |
|-----|---------|-------------|
| Subscription PUT super-admin only | ✅ RC1 hardening | Maintain; add audit export |
| Import tenant mismatch guard | ✅ RC1 | Extend to all cross-tenant paths |
| Rate limits | Per-route limiters | Global tenant rate budgets |
| API scope tokens | Full JWT access | Scoped API keys per integration |
| Secrets in device config | Provision URLs | Short-lived signed tokens |
| Super-admin action MFA | None | Step-up auth for wizard/test lab |
| CSP / XSS hardening | Standard Next.js | V3-specific security review |
| Dependency scanning | Manual | CI SBOM + automated audit |
| Penetration test | Not V3-specific | Annual V3 portal pentest |
| Session fixation / rotation | Platform JWT | Document + harden V3 sessions |

---

## 4. UX Improvements

| Gap | Example | V3.1 Target |
|-----|---------|-------------|
| JSON-in-textarea forms | Business hours, ring group members | Visual editors (reuse pbx-manager patterns) |
| No guided onboarding | Blank dashboard after enable | Setup wizard / checklist |
| Migration Wizard UX | Technical step labels | Progress persistence, email notifications |
| Call flow builder | Functional but dense | Templates library, drag-drop polish |
| Mobile-responsive admin | Desktop-first | Tablet/mobile layouts for key pages |
| Empty states | Generic | Contextual CTAs ("Add first employee") |
| Error messages | API error strings | User-friendly codes + help links |
| Bulk desk phone onboarding | One-at-a-time | CSV MAC import + batch provision |
| Real-time dashboard | Poll on load | WebSocket or SSE updates |
| Search / filter | Per-page inconsistent | Global tenant search |
| Accessibility (a11y) | Not audited | WCAG 2.1 AA target for V3 nav |
| i18n | English only | Locale framework (en first) |

---

## 5. Performance Improvements

| Area | Observation | V3.1 Target |
|------|-------------|-------------|
| Dashboard load | Multiple parallel service calls | Single aggregated endpoint + cache |
| Health center | 5+ service fan-out | Snapshot model with TTL |
| Analytics charts | In-memory aggregation | Timescale/rollup tables |
| Call flow simulation | Synchronous | Background job for large flows |
| Migration wizard discovery | Full table scan | Incremental discovery with checkpoints |
| Runtime validation | Batched in RC1 audit | Streaming validation progress |
| Frontend bundle | All V3 pages in app | Route-level code splitting audit |
| Prisma queries | Some unbounded lists | Mandatory pagination defaults |

---

## 6. Operational Improvements

| Gap | Current | V3.1 Target |
|-----|---------|-------------|
| Runtime sync canary | Manual script | Automated canary pipeline |
| Deploy branch defaults | Staging script stale branch | CI/CD aligned to release branch |
| `/ready/v3` not in deploy | Manual check | Automated deploy gate |
| Test Lab production | Blocked by design | Read-only production smoke mode |
| Migration run notifications | None | Slack/email on complete/fail |
| OpenAPI spec | Hand-written markdown | Generated from routes |
| Runbook screenshots | Placeholders | Actual screenshot assets |
| Observability | Basic metrics endpoint | Prometheus dashboards for V3 |
| Feature flag UI | Env vars only | Super-admin flag console |
| On-call runbooks | Markdown | PagerDuty integration |

---

## 7. Area-Specific Improvement Notes

### Migration Wizard
- Missing dedicated post-validate HTTP step
- No email/Slack notification on completion
- No dry-run scheduling (run at maintenance window)
- Limited rollback granularity (all-or-nothing)

### Repair Services
- No repair suggestion ranking (all issues equal weight)
- No automated repair scheduling
- Runtime repair depends on sync enabled

### Health Center
- No historical health trends
- No alerting thresholds configurable by tenant
- Softphone health read-only (by design) — needs clearer UX copy

### Operations Center
- Monitoring page read-only snapshots
- No custom report builder
- Notifications not push-enabled

### Marketplace
- Super-admin bottleneck for all purchases
- No delegated purchasing role
- No spend limits / approval workflow

### Call Flow Builder
- No version history / diff
- No A/B routing tests
- Simulator doesn't model full telephony latency

### Desk Phones
- Limited vendor template library
- No zero-touch provisioning (RPS) integration
- No firmware bulk upgrade tracking

### Runtime Sync
- No sync status per entity in UI drill-down
- No automatic retry policy configuration
- Canary not integrated with Test Lab telephony checks

---

## Summary Matrix

| Category | Critical Gaps | RC1 Adequate |
|----------|---------------|--------------|
| Enterprise | SSO, webhooks, compliance, branding | Core PBX config |
| Scalability | Dashboard cache, pagination, worker scale | <100 extension tenants |
| Security | API keys, MFA, SIEM export | Tenant isolation, audit |
| UX | JSON forms, onboarding, mobile | Core workflows functional |
| Performance | Health/dashboard aggregation | Small-medium tenants |
| Operations | Canary automation, OpenAPI, observability | Manual runbooks exist |

---

## Related

- `ROADMAP.md`
- `TECHNICAL_DEBT.md`
- `docs/release/09_KNOWN_LIMITATIONS.md`
