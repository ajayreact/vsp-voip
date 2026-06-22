# P0 Launch Documentation Index

Complete these guides **in order** before onboarding the first paying customer.

| # | Document | Purpose |
|---|----------|---------|
| 1 | [Production Deployment Guide](./production-deployment-guide.md) | AWS architecture, API, Postgres, Redis, HTTPS, secrets |
| 2 | [Stripe Go-Live Guide](./stripe-go-live-guide.md) | Live mode, webhooks, event validation |
| 3 | [Telnyx Go-Live Guide](./telnyx-go-live-guide.md) | Voice, SMS, Call Control, number purchasing |
| 4 | [SMTP Setup Guide](./smtp-setup-guide.md) | Transactional email configuration |
| 5 | [Customer Onboarding SOP](./customer-onboarding-sop.md) | Concierge onboarding procedure |
| 6 | [Launch Checklist](./launch-checklist.md) | Technical, billing, telephony, support |
| 7 | [Remaining Risks Report](./remaining-risks-report.md) | Launch, operational, support risks |

## Validation

```bash
npm run validate:phase2a    # Phase 2A security/billing/health
npm run validate:p0         # P0 launch readiness (SMTP, env, endpoints)
```

## CEO verdict gate

**Do not start Phase 2B** until all items in [Launch Checklist](./launch-checklist.md) are checked off and `npm run validate:p0` passes in the **production** environment.
