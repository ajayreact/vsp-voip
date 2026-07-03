# Tenant Portal V3 — Release Notes

## v3.0.0-rc1 (Release Candidate 1)

**Date:** 2026-07-03  
**Branch:** `release/v3.0.0-rc1`  
**Tag:** `v3.0.0-rc1`  
**Base commit:** `132a665` — final stabilization audit

---

## Overview

Tenant Portal V3 is a **tenant-scoped administration and operations layer** for VSP Phone. It provides configuration, health monitoring, billing, backup, and a controlled path to runtime telephony integration — without replacing the production Call Control / WebRTC stack in this RC.

This RC1 tag marks **code freeze**. No new portal features will be added before GA.

---

## What's Included

### Phases 1–10

| Phase | Scope | UI Route Prefix |
|-------|--------|-----------------|
| **1** | Employees, PBX health, provisioning, audit, repair | `/v3/employees`, `/v3/health` |
| **2** | Number inventory, marketplace, assignments | `/v3/numbers`, `/v3/marketplace`, `/v3/assignments` |
| **3** | Desk phones, templates, provisioning, device health | `/v3/devices`, `/v3/device-provision` |
| **4** | Call flow builder (engine + simulator) | `/v3/callflows` |
| **5** | Ring groups, queues, business hours, holidays, voicemail config | `/v3/ring-groups`, `/v3/queues`, etc. |
| **6** | Softphone UX: profiles, presence, directory | `/v3/profile`, `/v3/presence`, `/v3/directory` |
| **7** | Dashboard, analytics, reports, monitoring | `/v3/dashboard`, `/v3/analytics`, `/v3/monitoring` |
| **8** | Billing, subscription, lifecycle, backups | `/v3/billing`, `/v3/backups`, `/v3/lifecycle` |
| **9** | Runtime sync bridge to telephony-v3 worker | `/v3/runtime`, `/v3/runtime-validation` |
| **10** | Production health, migration, diagnostics | `/v3/production-health`, `/v3/migration` |

### Test Lab

Staging validation harness for super-admins:

- Endpoint: `/v3/test-lab`
- API: `/api/v3/test-lab/*`
- Requires `V3_TEST_LAB_ENABLED=true`
- Blocks production hosts unless `V3_TEST_LAB_ALLOW_PRODUCTION=true` (staging only)

### Migration Wizard

Super-admin orchestration for legacy tenant → V3:

- Endpoint: `/v3/migration-wizard`
- API: `/api/v3/migration-wizard/*`
- Six-step workflow with automatic rollback on failure

### Final Stabilization Audit

Security and consistency hardening applied in commit `132a665`:

- Read-only profile access in health endpoints
- Import/restore tenant ID enforcement
- Super-admin guards on sensitive UI and subscription mutations
- Race-condition fixes for presence and softphone profiles

---

## Feature Flags (Required)

| Variable | Default | Purpose |
|----------|---------|---------|
| `V3_PORTAL_ENABLED` | `false` | Backend API gate |
| `NEXT_PUBLIC_V3_PORTAL` | `false` | Frontend nav and routes |
| `V3_RUNTIME_SYNC_ENABLED` | `false` | Runtime telephony bridge |
| `V3_RUNTIME_SYNC_TENANT_ALLOWLIST` | empty | Canary tenant IDs |
| `V3_TEST_LAB_ENABLED` | `false` | Test Lab harness |
| `V3_TEST_LAB_ALLOW_PRODUCTION` | `false` | Staging-only override |

See `docs/V3/Environment.md` for the full list.

---

## Database

Apply migrations before enabling portal:

```bash
npm run migrate:deploy
```

11 V3-specific migrations from `20260624180500_v3_telephony_phase1` through `20260703220000_v3_test_lab_run`.

Validation: `npm run validate:migrations` — **PASSED** at RC1 cut.

---

## Testing

| Suite | Result (RC1) |
|-------|----------------|
| `npx vitest run tests/v3` | **130/130 passed** |
| `npm test` (full) | **967 passed**, 2 failed (API login — env/rate limit) |
| `npx tsc --noEmit` (web) | **Passed** |
| ESLint (web) | **66 issues** (29 errors — pre-existing legacy, not RC blockers) |

---

## Deployment

Quick staging path:

```bash
cd /opt/vsp-voip
bash deploy/staging-v3-portal.sh
```

See `docs/V3/Deployment.md` for production checklist.

---

## Known RC1 Gaps

1. **Runtime sync** — not enabled globally; requires canary tenant allowlist and worker validation
2. **Live telephony on V3 path** — manual staging matrix pending (see `docs/vsp/phase3/13-v3-final-go-no-go-review.md`)
3. **ESLint** — legacy web modules outside V3 scope carry pre-existing violations

---

## Upgrade Path

1. Deploy API + run migrations
2. Set `V3_PORTAL_ENABLED=true` and rebuild web with `NEXT_PUBLIC_V3_PORTAL=true`
3. Validate `/ready` and `/v3/dashboard`
4. Run Test Lab on staging tenant
5. Use Migration Wizard for legacy tenant cutover (super-admin)
6. Enable runtime sync per-tenant when ready

---

## Documentation

Full RC1 documentation: `docs/V3/`

## Support

Internal runbooks: `docs/vsp/deployment/18-v3-production-operations-runbook.md`
