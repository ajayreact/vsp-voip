# Tenant Portal V3 — Migration

**RC1:** v3.0.0-rc1

## Schema Migration

Apply 11 V3 Prisma migrations via `npm run migrate:deploy`. Validate with `npm run validate:migrations`.

## Tenant Data Migration

### Tenant-scoped (Phase 10)

- UI: `/v3/migration`
- API: `/api/v3/migration/preview`, `/run`, `/rollback`, `/report`
- Service: `lib/v3/migrationService.js`

### Super-admin Wizard

- UI: `/v3/migration-wizard`
- API: `/api/v3/migration-wizard/*`
- Service: `lib/v3/migrationWizardService.js`

Steps: discovery → validate → preview → run → rollback (auto on failure).

## Cutover Procedure

1. Backup tenant (`/v3/backups`)
2. Run Test Lab on staging clone
3. Migration Wizard preview on production tenant
4. Execute during maintenance window
5. Post-validate counts and health
6. Enable runtime sync only after validation (optional)

## API Endpoints

| Method | Path | Role |
|--------|------|------|
| POST | `/api/v3/migration/preview` | Admin |
| POST | `/api/v3/migration/run` | Admin |
| POST | `/api/v3/migration/rollback` | Admin |
| GET | `/api/v3/migration/report` | Admin |
| GET | `/api/v3/migration-wizard/discovery` | Super-admin |
| POST | `/api/v3/migration-wizard/validate` | Super-admin |
| POST | `/api/v3/migration-wizard/preview` | Super-admin |
| POST | `/api/v3/migration-wizard/run` | Super-admin |
| POST | `/api/v3/migration-wizard/rollback` | Super-admin |

## Rollback

Use wizard rollback or `/api/v3/migration/rollback`. Restore from backup if needed.

## Deployment Notes

Run migrations before enabling portal. Never deploy old code against new schema without DBA review.
