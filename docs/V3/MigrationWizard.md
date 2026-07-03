# Tenant Portal V3 — Migration Wizard

**RC1:** v3.0.0-rc1

## Purpose

Super-admin orchestration for migrating legacy tenant data to V3 with validation, preview, execute, and rollback.

## Service

`lib/v3/migrationWizardService.js`

## Workflow

1. **Discovery** — inventory legacy vs V3 objects
2. **Validate** — pre-flight checks
3. **Preview** — dry-run diff
4. **Run** — execute migration (auto-rollback on exception)
5. **Post-validation** — internal service step after run
6. **Rollback** — manual or automatic revert

## API (Super-admin only)

| Method | Path |
|--------|------|
| GET | `/api/v3/migration-wizard/discovery?tenantId=` |
| POST | `/api/v3/migration-wizard/validate` |
| POST | `/api/v3/migration-wizard/preview` |
| POST | `/api/v3/migration-wizard/run` |
| POST | `/api/v3/migration-wizard/rollback` |

## UI

`/v3/migration-wizard` — guarded by `runV3SuperAdminGuard`

## Model

`V3MigrationRun` — persisted run metadata.

## Deployment

No extra flags beyond portal enablement. Requires super-admin JWT.

## Rollback

Call rollback endpoint or rely on auto-rollback on run failure. Restore backup for catastrophic failure.

## Operations

1. Run Test Lab on tenant clone first
2. Preview and review diff
3. Execute in maintenance window
4. Verify health center post-migration
5. Do not enable runtime sync until validation passes

## Tests

`tests/v3/migrationWizardService.test.ts` — 7 tests
