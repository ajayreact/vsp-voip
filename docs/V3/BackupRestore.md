# Tenant Portal V3 — Backup & Restore

**Version:** v3.0.0-rc1

---

## Overview

Phase 8 provides tenant-scoped backup, restore, and import/export. All operations are tenant-isolated and require appropriate admin roles.

**Services:**

- `lib/v3/backupService.js` — create and list backups
- `lib/v3/restoreService.js` — restore from backup
- `lib/v3/exportImportService.js` — JSON export/import
- `lib/v3/storageService.js` — artifact storage

**UI:** `/v3/backups`, `/v3/import-export`

---

## Backup

### Create backup

- API: `POST /api/v3/backups`
- Captures tenant configuration snapshot (employees, numbers, devices, PBX objects, etc.)
- Stored with metadata for restore validation

### List backups

- API: `GET /api/v3/backups`
- UI shows timestamp, size, status

---

## Restore

### From backup

- API: `POST /api/v3/backups/:id/restore`
- Validates tenant scope before apply
- **RC1:** rejects restore when backup tenant ≠ current tenant (`TENANT_MISMATCH`)

### Pre-restore checklist

1. Notify tenant of maintenance window
2. Export current state as safety copy
3. Disable runtime sync during restore
4. Run restore
5. Post-validate via Test Lab or migration post-validation

---

## Import / Export

### Export

- API: `GET /api/v3/export`
- Downloads tenant JSON bundle

### Import

- API: `POST /api/v3/import`
- **RC1 hardening:** tenant ID in bundle must match authenticated tenant

Use for DR, staging clone (with caution), or migration assistance — not a substitute for Prisma schema migrations.

---

## Schema vs Data

| Type | Tool |
|------|------|
| Schema | `prisma migrate deploy` |
| Tenant data | Backup/restore, import/export |
| Full DB | PostgreSQL pg_dump (ops-level) |

Portal backups do **not** include call recordings, CDR, or Redis session state.

---

## Disaster Recovery

1. Restore PostgreSQL from infra backup (if total loss)
2. Run `npm run migrate:deploy`
3. Redeploy API + web with V3 flags
4. Restore tenant data from portal backup or import
5. Re-run runtime validation before enabling sync

---

## Related

- [Migration.md](./Migration.md)
- [Rollback.md](./Rollback.md)
- [AdminGuide.md](./AdminGuide.md)
