# Remaining Risks Report

Post-P0 implementation risk assessment for first 10 paying customers.

**Overall launch risk:** **Medium** (acceptable with concierge onboarding and P0 checklist complete)

---

## 1. Remaining launch risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Production not yet deployed | **Critical** | High if checklist skipped | Complete [production-deployment-guide.md](./production-deployment-guide.md) |
| Redis unavailable in prod | **High** | Medium | ElastiCache + `/ready` monitoring; rate limits fail closed |
| Stripe webhook misconfiguration | **High** | Medium | [stripe-go-live-guide.md](./stripe-go-live-guide.md) + live smoke test |
| Telnyx webhook unreachable | **High** | Medium | `API_PUBLIC_URL` HTTPS + signature key verified |
| SMTP deliverability issues | **Medium** | Medium | SPF/DKIM; test all 4 email types |
| No self-serve signup | **Low** | Certain | Concierge SOP — intentional for first 10 |
| Single API instance (no HA) | **Medium** | Low at 10 customers | Accept for pilot; add 2nd task at customer 20+ |
| JWT not revalidated against DB | **Medium** | Low | Phase 2B; revoke access by suspending tenant |
| No PostgreSQL RLS | **Medium** | Low | App-layer isolation + RBAC; Phase 2B |
| Greeting files publicly served | **Low** | Low | `/uploads/greetings` static; Phase 2B signed URLs |

---

## 2. Operational risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Manual tenant provisioning errors | Wrong quotas, typos in email | Follow [customer-onboarding-sop.md](./customer-onboarding-sop.md) checklist |
| Telnyx balance exhaustion | Calls/numbers fail | Set low-balance alert in Telnyx portal |
| RDS storage full | API down | Enable autoscaling; CloudWatch alarm at 80% |
| Secret rotation without plan | Outage | Document rotation in deployment guide; test in staging |
| No automated backups tested | Data loss | Monthly restore drill from RDS snapshot |
| Grace period job fails | Unpaid tenants stay active | Hourly job logs errors; monitor `billing_grace_expired` |
| On-call undefined | Slow incident response | Assign on-call rotation before customer #1 |

---

## 3. Customer support risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| No ticketing system | Lost requests | Shared support inbox + spreadsheet tracker for first 10 |
| No knowledge base | Repeat questions | 1-page FAQ + onboarding email |
| Password issues | Login friction | `/forgot-password` live + CS can trigger reset |
| Billing disputes | Trust loss | Stripe dashboard + order audit trail |
| Call quality complaints | Churn | Admin voice quality monitoring; Telnyx MOS telemetry |
| Customer expects self-serve | Expectation mismatch | Set expectations in contract: white-glove onboarding |
| SMS compliance (10DLC) | Carrier filtering | Register 10DLC brand/campaign before SMS-heavy customers |

---

## 4. Risk matrix summary

```text
                    IMPACT
                 Low    Med    High
           ┌─────────────────────────┐
    High   │        │ SMS    │ No   │
LIKELIHOOD │        │ 10DLC  │ prod │
           ├─────────────────────────┤
    Med    │ Public │ JWT    │ Redis│
           │ greet  │ no RLS │ Stripe│
           ├─────────────────────────┤
    Low    │        │ Single │      │
           │        │ instance│     │
           └─────────────────────────┘
```

---

## 5. Acceptable residual risk (first 10)

These risks are **accepted** for pilot launch with concierge onboarding:

- No public self-signup
- No PostgreSQL RLS
- No JWT DB revalidation every request
- No formal ticketing/KB platform
- Single-region AWS deployment
- Manual plan/quota assignment

All must be addressed before **100 customers** (Phase 2B + GTM scale).

---

## 6. Go / no-go criteria

| Criteria | Required |
|----------|----------|
| P0 launch checklist 100% complete | Yes |
| `validate:p0` passes in production | Yes |
| 1 successful pilot customer end-to-end | Yes |
| On-call contact assigned | Yes |
| CEO sign-off on [launch-checklist.md](./launch-checklist.md) | Yes |

**Recommendation:** **GO** for concierge onboarding of first 10 customers after P0 checklist sign-off. **NO-GO** for public marketing or self-serve until readiness ≥ 80/100.

---

## 7. Review schedule

| When | Action |
|------|--------|
| After customer #1 | Retrospective; update SOP |
| After customer #5 | Re-run risk assessment |
| Before customer #10 | Decide Phase 2B start date |
| Before customer #20 | HA deployment + monitoring upgrade |
