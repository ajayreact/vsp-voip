# Tenant Portal V3 — Migration Guide

**Version:** v3.0.0-rc1

---

## Database Migrations

Portal V3 requires **11 Prisma migrations** applied in order:

| Migration | Purpose |
|-----------|---------|
| `20260624180500_v3_telephony_phase1` | Core V3 schema foundation |
| `20260624181000_v3_telephony_phase1_5_hardening` | Hardening |
| `20260627120000_v3_phase395_hardening` | Platform hardening |
| `20260703120000_v3_desk_devices` | Desk phone entities |
| `20260703140000_v3_call_flows` | Call flow builder |
| `20260703160000_v3_pbx_objects` | Ring groups, queues, etc. |
| `20260703180000_v3_softphone_ux` | Profiles, presence |
| `20260703190000_v3_tenant_backup` | Backup/restore |
| `20260703200000_v3_runtime_sync` | Runtime job tracking |
| `20260703210000_v3_migration_run` | Tenant migration runs |
| `20260703220000_v3_test_lab_run` | Test Lab run history |

### Apply

```bash
npm run migrate:deploy
# or via Docker API entrypoint on deploy
```

### Validate

```bash
npm run validate:migrations
```

Expected: **Migration validation PASSED**

---

## Legacy Tenant → V3 Data Migration

Two paths exist:

### 1. Tenant Migration (Phase 10)

- UI: `/v3/migration`
- API: `/api/v3/migration/*`
- Service: `lib/v3/migrationService.js`
- For tenant-scoped migration runs with rollback support

### 2. Migration Wizard (Super Admin)

- UI: `/v3/migration-wizard`
- API: `/api/v3/migration-wizard/*`
- Service: `lib/v3/migrationWizardService.js`

**Six-step workflow:**

1. **Discovery** — inventory legacy vs V3 objects
2. **Validate** — pre-flight checks
3. **Preview** — dry-run diff
4. **Run** — execute migration
5. **Post-validation** — verify counts and links
6. **Rollback** — revert on failure (auto-rollback on execute exception)

Requires `SUPER_ADMIN` role.

---

## Recommended Cutover Sequence

1. Apply all Prisma migrations on staging
2. Enable portal flags; verify `/v3/dashboard`
3. Run Test Lab against staging tenant
4. Migration Wizard: discovery + validate + preview
5. Execute run during maintenance window
6. Post-validation; spot-check employees, numbers, devices
7. Enable runtime sync for tenant (optional, separate step)
8. Repeat on production after staging sign-off

---

## Import / Export

- UI: `/v3/import-export`
- Tenant export/import via `lib/v3/exportImportService.js`
- Restore via `lib/v3/restoreService.js`
- **RC1 hardening:** mismatched tenant ID returns `TENANT_MISMATCH`

---

## Rollback

- Migration Wizard step 6 or API rollback endpoints
- `lib/v3/rollbackService.js` for runtime rollback
- Database schema rollback is **not** automated — portal disable is the safe operational rollback

See [Rollback.md](./Rollback.md) and [BackupRestore.md](./BackupRestore.md).

---

## Related

- [Deployment.md](./Deployment.md)
- `prisma/migrations/`
