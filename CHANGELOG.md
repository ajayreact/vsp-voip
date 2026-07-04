# Changelog

All notable changes to **Tenant Portal V3** are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.0.0-rc1] - 2026-07-03

### Release Candidate — Code Freeze

First Release Candidate for Tenant Portal V3. **No new features** after this tag; stabilization and documentation only.

### Added

#### Portal Phases 1–10

- **Phase 1** — Employee management, PBX health checks, provisioning, audit trail, repair tools
- **Phase 2** — Number inventory, Telnyx sync, marketplace, assignments, inventory health
- **Phase 3** — Desk phone management, device templates, auto-provisioning, device health/repair
- **Phase 4** — Call flow builder engine, node editor, validation, simulator (configuration only — no live routing)
- **Phase 5** — PBX objects: ring groups, queues, business hours, holidays, voicemail config
- **Phase 6** — Softphone UX layer: profiles, preferences, presence, contact directory, softphone health
- **Phase 7** — Operations center: dashboard, analytics, reports, system health, activity, notifications
- **Phase 8** — Billing, subscription, license, tenant lifecycle, backup/restore, import/export
- **Phase 9** — Runtime telephony integration bridge: runtime sync jobs, runtime health, validation, rollback
- **Phase 10** — Production readiness: deployment status, migration runs, monitoring, metrics, diagnostics

#### Test Lab

- Super-admin staging validation harness (`/v3/test-lab`)
- Automated checks for inventory, call flows, softphone UX, runtime links
- Safety gates: `V3_TEST_LAB_ENABLED`, production host blocking
- Persisted run history (`v3_test_lab_run` migration)

#### Migration Wizard

- Super-admin 6-step legacy-to-V3 orchestration (`/v3/migration-wizard`)
- Discovery → validate → preview → run → post-validation → rollback
- Exception auto-rollback on execute failure
- Batched runtime link validation

#### Final Stabilization Audit

- Read-only softphone profiles in health checks (`getProfileReadOnly`)
- TENANT_USER scope enforcement in softphone health
- Tenant mismatch rejection on import/restore (`TENANT_MISMATCH`)
- Subscription PUT restricted to super-admin
- Frontend super-admin guards on migration-wizard, test-lab, marketplace
- P2002 race handling in presence and softphone profile get-or-create

### Infrastructure

- V3 API mounted at `/api/v3`, gated by `V3_PORTAL_ENABLED`
- 11 Prisma migrations for V3 portal schema (through `20260703220000_v3_test_lab_run`)
- Staging deploy script: `deploy/staging-v3-portal.sh`
- 54 V3 unit test files (`tests/v3/`), 130 tests passing

### Documentation

- `docs/V3/` — RC1 operator and deployment documentation set

### Known Limitations (RC1)

- `V3_RUNTIME_SYNC_ENABLED` defaults to **false** — live telephony bridge requires explicit canary enablement
- Full ESLint suite reports pre-existing non-V3 issues in legacy web modules
- Two API integration tests may fail when no reachable API or rate-limited (`tests/api/authentication.test.ts`)

---

## Prior Development (pre-RC1)

Development occurred on branch `backup/pre-v3-staging` with commits from portal foundation through Phase 10, Test Lab, Migration Wizard, and final stabilization audit. See `git log --grep=v3` for full history.

[3.0.0-rc1]: https://github.com/vsp-phone/vsp-voip/releases/tag/v3.0.0-rc1
