# V3.1 Product Roadmap

**Version:** Planning document  
**Date:** 2026-07-03  
**Target release:** v3.1.0 (post-GA UAT)  
**Branch strategy:** `feature/v3.1` from `main` after v3.0.0 tag

---

## Roadmap Principles

1. **No RC1 branch changes** — all work on `feature/v3.1`
2. **Runtime sync canary first** — highest rollout risk item
3. **Protected telephony files** — coordinate with telephony team; no portal-only hacks
4. **Backward compatible** — V3.0 API consumers must not break
5. **Enterprise features phased** — SSO before SCIM; webhooks before CRM

---

## High Priority

| # | Feature | Complexity | Dependencies | Effort | Rollout Risk | Notes |
|---|---------|------------|--------------|--------|--------------|-------|
| H1 | **Runtime sync production canary** | High | Worker stable, Test Lab | 3–4 weeks | **High** | Single tenant → 5 → all; telephony smoke required |
| H2 | **Telephony smoke automation** | Medium | H1, staging Telnyx | 2 weeks | High | Automate `04_TELEPHONY_SMOKE_TEST.md` |
| H3 | **Migration Wizard hardening** | Medium | GA feedback | 2 weeks | Medium | Post-validate API, notifications, progress persistence |
| H4 | **Dashboard / health performance** | Medium | None | 2–3 weeks | Low | Cached snapshots, aggregated endpoint |
| H5 | **Deploy pipeline alignment** | Low | DevOps | 1 week | Low | Branch defaults, `/ready/v3` gate, tag hygiene |
| H6 | **Technical debt: test fix + ESLint** | Low | None | 1 week | Low | softphoneHealthService test, CI auth tests |
| H7 | **OpenAPI / API v3 spec** | Medium | None | 2 weeks | Low | Generated or maintained spec for integrators |
| H8 | **Outbound webhooks (core events)** | Medium | Audit, queue | 3 weeks | Medium | migration.complete, backup.done, health.critical |
| H9 | **UX: JSON form elimination (Phase 5)** | Medium | pbx-manager patterns | 3 weeks | Low | Business hours, ring groups visual editors |
| H10 | **Setup onboarding wizard** | Medium | Health API | 2 weeks | Low | First-run checklist for new tenants |

**High priority subtotal:** ~18–22 engineer-weeks (parallelizable to ~8–10 calendar weeks)

---

## Medium Priority

| # | Feature | Complexity | Dependencies | Effort | Rollout Risk |
|---|---------|------------|--------------|--------|--------------|
| M1 | **SSO (OIDC)** — Azure AD, Google | High | Auth refactor | 4–6 weeks | Medium |
| M2 | **Scoped API keys** | Medium | Auth | 2–3 weeks | Medium |
| M3 | **Audit export + SIEM format** | Medium | auditService | 2 weeks | Low |
| M4 | **Multi-tenant ops dashboard** | Medium | Super-admin UI | 3 weeks | Low |
| M5 | **Test Lab production smoke mode** | Medium | Read-only checks | 2 weeks | Medium |
| M6 | **Runtime sync UI drill-down** | Medium | H1 | 2 weeks | Low |
| M7 | **Call flow version history** | Medium | callFlowService | 2 weeks | Low |
| M8 | **Bulk desk phone import** | Medium | deviceService | 2 weeks | Low |
| M9 | **Pagination standardization** | Medium | All list APIs | 3 weeks | Low |
| M10 | **Prometheus V3 metrics** | Low | metricsService | 1–2 weeks | Low |
| M11 | **Tenant setup templates** | Medium | Migration | 2 weeks | Low |
| M12 | **Repair suggestion ranking + AI hints** | Medium | AI foundation | 3 weeks | Low |
| M13 | **Notification integrations (email/Slack)** | Medium | notificationCenter | 2 weeks | Low |
| M14 | **Mobile-responsive V3 admin** | Medium | Frontend | 4 weeks | Low |
| M15 | **Split routes/v3.js by domain** | Medium | None | 2 weeks | Low |

**Medium priority subtotal:** ~35–45 engineer-weeks

---

## Low Priority

| # | Feature | Complexity | Dependencies | Effort | Rollout Risk |
|---|---------|------------|--------------|--------|--------------|
| L1 | **SCIM provisioning** | High | M1 SSO | 4–6 weeks | Medium |
| L2 | **CRM integrations (Salesforce)** | High | Webhooks, API keys | 6+ weeks | Medium |
| L3 | **Microsoft Teams presence** | High | Graph API | 4 weeks | Medium |
| L4 | **Slack notifications** | Medium | M13 | 2 weeks | Low |
| L5 | **Tenant branding / white-label** | Medium | Web build | 3 weeks | Low |
| L6 | **Advanced RBAC** | High | Auth model | 6 weeks | High |
| L7 | **Multi-region / HA architecture** | Very High | Infra | 12+ weeks | High |
| L8 | **Disaster recovery automation** | High | Backup, infra | 4 weeks | Medium |
| L9 | **Compliance packs (SOC2/HIPAA)** | Medium | Audit export | 4 weeks | Low |
| L10 | **AI call insights dashboard** | High | Phase 5 AI, CDR | 6 weeks | Medium |
| L11 | **Separate repo split** | Medium | GA stable | 2 weeks | Low |
| L12 | **i18n framework** | Medium | Frontend | 4 weeks | Low |
| L13 | **Number porting workflow** | High | Telnyx port API | 6 weeks | Medium |
| L14 | **Custom report builder** | High | reportService | 6 weeks | Low |
| L15 | **Warm transfer V3 path** | High | telephony-v3 | 8+ weeks | **High** |

---

## Suggested Release Slices

### V3.1.0 — "Production Telephony Bridge" (Q3 2026)

- H1, H2, H3, H5, H6, H4 (partial)
- **Goal:** Runtime sync validated; migrations hardened

### V3.1.1 — "Integrator Ready" (Q4 2026)

- H7, H8, M2, M3, M10
- **Goal:** API spec, webhooks, API keys

### V3.2.0 — "Enterprise Auth" (Q1 2027)

- M1, L1, M4, L5
- **Goal:** SSO, SCIM, multi-tenant ops

### V3.3.0 — "Intelligence Layer" (Q2 2027)

- M12, L10, AI opportunities doc items
- **Goal:** AI-assisted ops

---

## Dependency Graph (Critical Path)

```
GA UAT sign-off
    → H5 deploy alignment
    → H1 runtime canary (1 tenant)
    → H2 telephony smoke pass
    → H1 rollout (5 → all tenants)
    → H3 migration hardening (parallel)
    → M1 SSO (parallel track)
```

---

## Effort Summary

| Priority | Items | Est. Engineer-Weeks |
|----------|-------|---------------------|
| High | 10 | 18–22 |
| Medium | 15 | 35–45 |
| Low | 15 | 60–80+ |
| **V3.1.0 scope (High only)** | 6–8 items | **~12–16 weeks** (2 engineers) |

---

## Related

- `GAP_ANALYSIS.md`
- `TECHNICAL_DEBT.md`
- `EXECUTIVE_SUMMARY.md`
