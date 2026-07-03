# V3.1 Executive Summary — Planning Recommendations

**Version:** Planning document  
**Date:** 2026-07-03  
**Audience:** Engineering leadership, product, operations  
**Status:** Planning only — RC1 frozen, no implementation

---

## Context

Tenant Portal V3 RC1 delivers **10 portal phases**, **Migration Wizard**, **Test Lab**, **96 API endpoints**, **43 UI pages**, and **130 passing unit tests**. The portal is **GA-ready for configuration-only deployment** after UAT. Runtime sync and live V3 telephony remain **explicitly deferred**.

V3.1 should focus on **production hardening**, **telephony bridge validation**, and **integrator readiness** — not new portal features for their own sake.

---

## Strengths of V3

| Strength | Evidence |
|----------|----------|
| **Complete feature surface** | Phases 1–10 shipped; 62 services |
| **Clean telephony boundary** | Protected files untouched; legacy CC stable |
| **Tenant isolation** | JWT scoping, TENANT_MISMATCH guards, audit trail |
| **Migration tooling** | Wizard + backup + auto-rollback |
| **Staging validation** | Test Lab with persisted runs |
| **Test coverage** | 130/130 V3 unit tests; 0 V3 ESLint issues |
| **Documentation** | ~59 pages (RC1 + GA package) |
| **Feature-flag safety** | Portal, runtime, test lab all opt-in |
| **Modular services** | Clear phase ownership in `lib/v3/` |
| **Runtime adapter pattern** | Extensible sync without Telnyx direct calls |

---

## Remaining Risks

| Risk | Severity | V3.1 Mitigation |
|------|----------|-----------------|
| Runtime sync untested in production | **Critical** | H1 canary + H2 smoke automation |
| Telephony regression on V3 path | **Critical** | Canary tenant + instant rollback |
| Dashboard/health scale limits | High | H4 performance sprint |
| Super-admin bottleneck (marketplace, wizard) | Medium | Delegated roles in V3.2 |
| No SSO for enterprise sales | Medium | M1 OIDC in V3.2 |
| Manual operational procedures | Medium | H5 deploy automation |
| JSON-in-form UX debt | Low | H9 visual editors |
| Legacy ESLint / CI flakes | Low | H6 debt sprint |

---

## Opportunities

| Opportunity | Value | Timing |
|-------------|-------|--------|
| **First-mover unified PBX admin** | Single pane for config + health + migration | V3.0 GA now |
| **Runtime sync as differentiator** | Config-to-live routing without manual Telnyx | V3.1.0 |
| **AI-assisted operations** | Reduce support burden, faster onboarding | V3.1–V3.3 |
| **Integrator ecosystem** | Webhooks + API keys → CRM, ITSM partners | V3.1.1 |
| **Enterprise SSO** | Unlock mid-market and enterprise deals | V3.2.0 |
| **Multi-tenant ops scale** | MSP model — manage 1000+ tenants | V3.2+ |
| **White-label portal** | Channel partner revenue | V3.2+ |

---

## Suggested Priorities for V3.1

### Must Have (V3.1.0)

1. Runtime sync production canary + telephony smoke sign-off
2. Migration Wizard hardening (notifications, post-validate API)
3. Deploy pipeline alignment and tag hygiene
4. Dashboard/health performance baseline
5. Commit pending test fix; CI stability

### Should Have (V3.1.1)

6. OpenAPI specification
7. Outbound webhooks (core events)
8. UX: eliminate JSON textarea forms for PBX objects
9. Setup onboarding wizard for new tenants
10. Prometheus metrics for V3

### Could Have (V3.2.0)

11. SSO (OIDC)
12. Scoped API keys
13. Audit SIEM export
14. AI repair suggestions + migration assistant
15. Mobile-responsive admin

### Won't Have in V3.1

- Multi-region HA
- Full CRM integrations
- Warm transfer on V3 path
- SCIM (depends on SSO)
- Schema breaking changes

---

## Enterprise Feature Recommendations (Planning)

| Feature | Priority | Release | Notes |
|---------|----------|---------|-------|
| SSO (Azure AD, Google, Okta) | High | V3.2 | OIDC first |
| SCIM provisioning | Medium | V3.2–V3.3 | After SSO |
| Webhooks | High | V3.1.1 | Core V3 events |
| REST API enhancements | High | V3.1.1 | OpenAPI, pagination, API keys |
| Multi-tenant analytics | Medium | V3.2 | Super-admin ops |
| Audit improvements | Medium | V3.1.1 | SIEM export |
| Compliance (SOC2, HIPAA, GDPR) | Medium | V3.2–V3.3 | Evidence packs |
| Advanced reporting | Low | V3.3 | Custom report builder |
| Tenant branding / white-label | Low | V3.2 | Channel partners |
| Microsoft Teams / Slack | Low | V3.3 | After webhooks |
| CRM integrations | Low | V3.3+ | Salesforce first |
| Multi-region / HA / DR | Low | V3.5+ | Infra program |
| AI assistant / troubleshooting | Medium | V3.1–V3.3 | Tiered rollout |

---

## Estimated Effort for V3.1

| Scope | Duration | Team |
|-------|----------|------|
| **V3.1.0** (must-have) | 8–10 weeks | 2 backend + 1 frontend + 1 ops |
| **V3.1.1** (should-have) | 6–8 weeks | 2 full-stack |
| **Total V3.1 program** | ~4–5 months | Parallel tracks |

| Workstream | Engineer-Weeks |
|------------|----------------|
| Runtime sync + telephony | 8–10 |
| Migration + ops hardening | 4–5 |
| Performance + UX | 5–6 |
| Integrator (API, webhooks) | 4–5 |
| AI (Tier 1 subset) | 5–7 |
| Technical debt | 3–4 |
| **Total (with overlap)** | **~25–30 engineer-weeks** |

---

## Decision Points for Leadership

| Decision | Options | Recommendation |
|----------|---------|----------------|
| V3.1 scope | Minimal (canary only) vs full program | Full program with clear slices |
| AI in V3.1 | Yes (Tier 1) vs defer to V3.2 | Tier 1 subset (repair + migration assist) |
| SSO timing | V3.1 vs V3.2 | V3.2 — don't block telephony canary |
| Legacy CC sunset | V3.5 vs V4.0 | V4.0 major version |
| Branch strategy | feature/v3.1 from main | ✅ After v3.0.0 GA tag |

---

## Success Criteria for V3.1

- [ ] Runtime sync enabled for 10+ tenants without P1 incidents
- [ ] Telephony smoke test automated and passing on staging
- [ ] Migration success rate >99% across rollout
- [ ] Dashboard p95 <2s for 100-extension tenant
- [ ] OpenAPI spec published
- [ ] Zero protected telephony file regressions
- [ ] UAT + production rollout complete for V3.0 GA

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `GAP_ANALYSIS.md` | Detailed gap inventory |
| `ROADMAP.md` | Prioritized feature list |
| `TECHNICAL_DEBT.md` | Remediation catalog |
| `ARCHITECTURE_VISION.md` | 2–3 year evolution |
| `AI_OPPORTUNITIES.md` | AI feature planning |
| `V3_FINAL_RELEASE_REPORT.md` | GA baseline |

---

## Recommendation

**Approve V3.1 program** with V3.1.0 focused exclusively on **runtime sync canary + production hardening**. Defer enterprise features (SSO, CRM, HA) to V3.2+. Begin work on **`feature/v3.1`** only after **v3.0.0 GA tag** and UAT sign-off.

**Do not add features to the RC1 branch.**
