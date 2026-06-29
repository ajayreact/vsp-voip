# VSP Phone — Internal Documentation

Search here **first** (Step 1) before `docs/telnyx/` or source code.

## Architecture

| Topic | Location |
|-------|----------|
| **Phase 2 — Complete (backend frozen)** | [phase2/README.md](./phase2/README.md) · tag `phase2-production-ready` |
| **Phase 4 — Mobile (active)** | [phase4/README.md](./phase4/README.md) |
| **Phase 3 — Production readiness (audit)** | [phase3/README.md](./phase3/README.md) |
| **Multi-tenant extension isolation audit** | [phase2/05-multi-tenant-extension-isolation-audit.md](./phase2/05-multi-tenant-extension-isolation-audit.md) |
| **PBX architecture KB** | [pbx/README.md](./pbx/README.md) |
| Feature status matrix | [features.md](./features.md) |
| Architecture decisions (ADRs) | [architecture-decisions/README.md](./architecture-decisions/README.md) |
| Platform architecture audit | [../architecture-audit-report.html](../architecture-audit-report.html) |
| Telnyx + VSP mapping | [../telnyx/architecture.md](../telnyx/architecture.md) |
| Telephony health dashboard | [../TELEPHONY-HEALTH-DASHBOARD.md](../TELEPHONY-HEALTH-DASHBOARD.md) |
| Complete application audit | [../COMPLETE-APPLICATION-AUDIT.md](../COMPLETE-APPLICATION-AUDIT.md) |

## Call flows & telephony

| Topic | Location |
|-------|----------|
| Call transfer implementation plan | [../call-transfer-implementation-plan.html](../call-transfer-implementation-plan.html) |
| Telnyx compatibility | [../telnyx-compatibility.html](../telnyx-compatibility.html) |
| Office WebRTC capture checklist | [../../scripts/office-webrtc-capture-checklist.md](../../scripts/office-webrtc-capture-checklist.md) |

## Git & release

| Topic | Location |
|-------|----------|
| **Git workflow & branching** | [git/README.md](./git/README.md) |
| Branch strategy | [git/01-branch-strategy.md](./git/01-branch-strategy.md) |
| Release workflow & tagging | [git/03-release-workflow.md](./git/03-release-workflow.md), [git/04-tagging.md](./git/04-tagging.md) |
| Merge & release checklists | [git/05-merge-checklist.md](./git/05-merge-checklist.md), [git/06-release-checklist.md](./git/06-release-checklist.md) |
| Git rollback | [git/07-rollback-strategy.md](./git/07-rollback-strategy.md) |
| Git KB validation | [git/VALIDATION.md](./git/VALIDATION.md) |

## Product roadmap

| Topic | Location |
|-------|----------|
| **Roadmap hub** | [roadmap/README.md](./roadmap/README.md) |
| Current state | [roadmap/01-current-state.md](./roadmap/01-current-state.md) |
| Priority roadmap (P0–P4) | [roadmap/02-priority-roadmap.md](./roadmap/02-priority-roadmap.md) |
| Feature dependencies | [roadmap/03-feature-dependencies.md](./roadmap/03-feature-dependencies.md) |
| Release plan | [roadmap/04-release-plan.md](./roadmap/04-release-plan.md) |
| Testing / performance / security | [roadmap/05-testing-strategy.md](./roadmap/05-testing-strategy.md), [06-performance-plan.md](./roadmap/06-performance-plan.md), [07-security-plan.md](./roadmap/07-security-plan.md) |
| Mobile / AI / enterprise | [roadmap/08-mobile-roadmap.md](./roadmap/08-mobile-roadmap.md), [09-ai-roadmap.md](./roadmap/09-ai-roadmap.md), [10-enterprise-roadmap.md](./roadmap/10-enterprise-roadmap.md) |
| Feature status matrix | [features.md](./features.md) |
| Roadmap validation | [roadmap/VALIDATION.md](./roadmap/VALIDATION.md) |

## Deployment

| Topic | Location |
|-------|----------|
| **Deployment & operations KB** | [deployment/README.md](./deployment/README.md) |
| Local development | [deployment/01-local-development.md](./deployment/01-local-development.md) |
| EC2 deployment | [deployment/02-ec2-deployment.md](./deployment/02-ec2-deployment.md) |
| Docker / PM2 / Nginx | [deployment/03-docker.md](./deployment/03-docker.md), [04-pm2.md](./deployment/04-pm2.md), [05-nginx.md](./deployment/05-nginx.md) |
| Migrations & Prisma | [deployment/06-database-migrations.md](./deployment/06-database-migrations.md), [07-prisma.md](./deployment/07-prisma.md) |
| Rollback & release | [deployment/08-rollback.md](./deployment/08-rollback.md), [09-release-process.md](./deployment/09-release-process.md) |
| Production checklist | [deployment/10-production-checklist.md](./deployment/10-production-checklist.md) |
| Known issues & DR | [deployment/11-known-issues.md](./deployment/11-known-issues.md), [deployment/12-disaster-recovery.md](./deployment/12-disaster-recovery.md) |
| Monitoring & telephony validation | [deployment/13-monitoring.md](./deployment/13-monitoring.md), [deployment/14-telephony-validation.md](./deployment/14-telephony-validation.md) |
| QA & regression gate | [deployment/15-qa-regression.md](./deployment/15-qa-regression.md), [../../tests/README.md](../../tests/README.md) |
| KB validation | [deployment/VALIDATION.md](./deployment/VALIDATION.md) |
| Production deployment guide (AWS roadmap) | [../launch/production-deployment-guide.md](../launch/production-deployment-guide.md) |
| Legacy production checklist | [../../deploy/PRODUCTION-CHECKLIST.md](../../deploy/PRODUCTION-CHECKLIST.md) |
| Launch checklist | [../launch/launch-checklist.md](../launch/launch-checklist.md) |
| Telnyx go-live | [../launch/telnyx-go-live-guide.md](../launch/telnyx-go-live-guide.md) |
| SMTP setup | [../launch/smtp-setup-guide.md](../launch/smtp-setup-guide.md) |
| Stripe go-live | [../launch/stripe-go-live-guide.md](../launch/stripe-go-live-guide.md) |

## Database

| Topic | Location |
|-------|----------|
| Prisma schema | [../../prisma/schema.prisma](../../prisma/schema.prisma) |
| Migrations | [../../prisma/migrations/](../../prisma/migrations/) |

## Release notes & validation

| Topic | Location |
|-------|----------|
| Phase 2A.5 validation | [../validation-report-phase2a5.md](../validation-report-phase2a5.md) |
| Remaining launch risks | [../launch/remaining-risks-report.md](../launch/remaining-risks-report.md) |
| Customer onboarding SOP | [../launch/customer-onboarding-sop.md](../launch/customer-onboarding-sop.md) |

## Troubleshooting

| Topic | Location |
|-------|----------|
| **WebRTC one-way audio investigation (authoritative runbook)** | [investigations/webrtc-one-way-audio-root-cause.md](./investigations/webrtc-one-way-audio-root-cause.md) |
| Telnyx KB (Step 2) | [../telnyx/index.md](../telnyx/index.md) |
| DID sync diagnosis | [../../scripts/diagnose-did-sync.js](../../scripts/diagnose-did-sync.js) |

## Portals & UI reference

| Topic | Location |
|-------|----------|
| Tenant portal | [../tenant-portal.html](../tenant-portal.html) |
| Super admin portal | [../super-admin-portal.html](../super-admin-portal.html) |
| Mobile app | [../mobile-app.html](../mobile-app.html) |

## Coding standards

Follow existing patterns in the codebase. Cursor rules:

- `.cursor/rules/vsp-phone-development.mdc` — mandatory search order and development workflow
- `.cursor/rules/protected-telephony-components.mdc` — extra guardrails for WebRTC / Call Control files
- `.cursor/rules/deployment-safety.mdc` — verify deployment before production code changes
- `.cursor/rules/pbx-architecture.mdc` — reuse PBX architecture; no duplicate call flows
- `.cursor/rules/git-workflow.mdc` — branch from development; deploy from main only
- `.cursor/rules/qa-first.mdc` — run regression tests before telephony deploys

**Protected telephony files** (require regression analysis before media/signaling changes):

- `web/src/lib/webrtc-audio.ts`
- `web/src/lib/telnyx-softphone-session.ts`
- `web/src/app/(app)/softphone-v2/page.tsx`
- `lib/inboundCallControl.js`
- `lib/telnyxCallControl.js`
- `lib/callControlSessionStore.js`

Validation scripts: `npm run validate:*` in root [package.json](../../package.json).
