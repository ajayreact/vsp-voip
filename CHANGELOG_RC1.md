# Changelog — Tenant Portal V3 RC1

## [3.0.0-rc1] — 2026-07-03

Release Candidate 1 — code freeze. No new features after this release.

---

## New Features

### Portal Phases 1–10

- **Phase 1** — Employee provisioning, PBX health, repair inspect/apply, audit logging
- **Phase 2** — Number inventory, Telnyx sync, marketplace search/purchase/release, assignments
- **Phase 3** — Desk phone CRUD, templates, provisioning, device health/repair
- **Phase 4** — Call flow builder with node types, validation, simulator
- **Phase 5** — Ring groups, queues, business hours, holidays, voicemail boxes
- **Phase 6** — Softphone profiles, preferences, presence, contact directory, UX health
- **Phase 7** — Dashboard, analytics, reports, activity, notifications, system health
- **Phase 8** — Billing, subscription, license, lifecycle, backup/restore, import/export
- **Phase 9** — Runtime sync bridge with 10 adapters (disabled by default)
- **Phase 10** — Production health, deployment status, tenant migration, diagnostics, metrics

### Migration Wizard

- Super-admin 6-step orchestration (`/v3/migration-wizard`)
- Discovery, validate, preview, run, rollback
- Exception auto-rollback on execute failure

### Test Lab

- Staging validation harness (`/v3/test-lab`)
- Automated checks + persisted run history
- Production host safety gates

---

## Breaking Changes

- None for legacy portal users when `V3_PORTAL_ENABLED=false`
- Enabling V3 adds new `/v3/*` routes; legacy routes unchanged
- Subscription PUT restricted to `SUPER_ADMIN` (RC1 audit)

---

## Database Changes

11 new migrations (apply in order):

1. `20260624180500_v3_telephony_phase1`
2. `20260624181000_v3_telephony_phase1_5_hardening`
3. `20260627120000_v3_phase395_hardening`
4. `20260703120000_v3_desk_devices`
5. `20260703140000_v3_call_flows`
6. `20260703160000_v3_pbx_objects`
7. `20260703180000_v3_softphone_ux`
8. `20260703190000_v3_tenant_backup`
9. `20260703200000_v3_runtime_sync`
10. `20260703210000_v3_migration_run`
11. `20260703220000_v3_test_lab_run`

22 Prisma models prefixed `V3*`.

---

## Migration Order

```bash
npm run migrate:deploy
npm run validate:migrations
```

Deploy API before enabling portal flags.

---

## API Additions

- **96 route handlers** on `/api/v3/*`
- Gated by `V3_PORTAL_ENABLED` (404 when off)
- JWT auth on all routes; tenant scoping via `req.user.tenantId`
- Rate limits on repair, billing, heavy mutations

See `docs/v3/Architecture.md` and `docs/V3/API.md`.

---

## Frontend Pages

**43 routes** under `/v3/*` including:

- Dashboard, employees, health, numbers, assignments, marketplace
- Devices, device-provision, device-health
- Call flows (list, builder, simulator)
- Ring groups, queues, business hours, holidays, voicemail
- Profile, preferences, presence, directory
- Analytics, reports, monitoring, activity, notifications
- Billing, subscription, license, lifecycle, backups, import-export
- Runtime, runtime/health, runtime/jobs, runtime-validation
- Migration, migration-wizard, production-health, diagnostics, metrics, system-health
- Test Lab

---

## Runtime Sync

- Adapters for all major PBX object types
- `V3_RUNTIME_SYNC_ENABLED=false` by default
- Optional tenant allowlist for canary
- No impact on legacy Call Control when disabled

---

## Migration Wizard

- API: `/api/v3/migration-wizard/*` (super-admin)
- UI: `/v3/migration-wizard`
- Complements `/api/v3/migration/*` tenant migration

---

## Test Lab

- API: `/api/v3/test-lab/*` (super-admin)
- Requires `V3_TEST_LAB_ENABLED=true`
- Blocks production hosts unless explicitly allowed (staging only)

---

## Bug Fixes (RC1 stabilization)

- P2002 race handling in presence and softphone profile get-or-create
- Read-only softphone profiles in health checks (`getProfileReadOnly`)
- TENANT_USER scope in softphone health
- `TENANT_MISMATCH` rejection on import/restore
- Super-admin guards on migration-wizard, test-lab, marketplace UI
- Migration auto-rollback on execute failure
- Batched runtime link validation in Migration Wizard
- Dashboard optional chaining hardening

---

## Known Issues

1. Git tag `v3.0.0-rc1` may point to pre-portal commit (`cd07ef4`) — retag required
2. Uncommitted test fix: `tests/v3/softphoneHealthService.test.ts`
3. Full `npm test`: 2 API auth failures (environment/rate limit)
4. Legacy ESLint: 66 issues (0 in V3 paths)
5. Runtime sync not production-canary validated
6. Structured `console.log` in `employeeService.js` (PBX REBUILD audit trail — intentional)

---

## Future Roadmap

- Runtime sync production canary
- V3 telephony live call validation matrix
- Legacy ESLint cleanup
- Warm transfer, conference (telephony-v3 Phase 4+)
- Optional split repository `vsp-phone-tenant-portal-v3`
- GA release `v3.0.0` after RC1 soak period
