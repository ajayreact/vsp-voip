# V3.0.0 — Upgrade Guide

## From Legacy Portal (No V3)

1. **Backup** PostgreSQL and tenant data
2. **Deploy** API + run migrations (11 new V3 migrations)
3. **Enable flags** — `V3_PORTAL_ENABLED`, `NEXT_PUBLIC_V3_PORTAL`
4. **Verify** `/ready` and `/v3/dashboard`
5. **Migrate tenants** via Migration Wizard (`docs/admin/MigrationGuide.md`)
6. **Do not** enable runtime sync until canary approved

## From RC1 (`v3.0.0-rc1`)

1. Pull latest on `release/v3.0.0-rc1` or checkout `v3.0.0` tag
2. Run `npm run migrate:deploy` (if new migrations since RC1)
3. Redeploy API + web
4. Verify git SHA in `/ready`
5. Re-run post-deploy validation (`docs/release/08_POST_DEPLOY_VALIDATION.md`)

## Schema Upgrade Order

Migrations apply automatically on API deploy. Manual:

```bash
npm run migrate:deploy
```

V3 migrations (in order):

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

## Breaking Changes (RC1 → GA)

- None for users when portal flag off
- Subscription PUT restricted to super-admin (RC1 audit)
- Import/restore enforces `TENANT_MISMATCH`

## Rollback

If upgrade fails, see `ROLLBACK.md`. Schema is forward-only — use backup restore for data rollback.

## Post-Upgrade

- Run Test Lab on staging clone
- Migration Wizard preview before tenant cutover
- Phased rollout per `docs/release/06_PRODUCTION_ROLLOUT.md`
