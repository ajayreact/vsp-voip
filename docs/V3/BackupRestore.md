# Tenant Portal V3 — Backup & Restore

**RC1:** v3.0.0-rc1

## Purpose

Phase 8 tenant backup, restore, export, and import with tenant isolation enforcement.

## Services

- `lib/v3/backupService.js`
- `lib/v3/restoreService.js`
- `lib/v3/exportImportService.js`
- `lib/v3/storageService.js`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v3/backup` | List backups |
| POST | `/api/v3/backup/create` | Create snapshot |
| POST | `/api/v3/backup/restore-preview` | Preview restore |
| POST | `/api/v3/backup/restore` | Execute restore |
| POST | `/api/v3/backup/rollback-preview` | Preview rollback |
| POST | `/api/v3/backup/rollback` | Execute rollback |
| POST | `/api/v3/export` | Export JSON bundle |
| POST | `/api/v3/import` | Import JSON bundle |

## UI

- `/v3/backups`
- `/v3/import-export`

## Model

`V3TenantBackup` — metadata + storage reference.

## Security (RC1)

Import/restore rejects mismatched tenant ID with `TENANT_MISMATCH`.

## Deployment

Ensure storage backend configured (local/S3 per `storageService`).

## Rollback

Use backup rollback endpoints or restore previous backup. Take pre-migration backup before wizard run.

## Operations

Schedule backup before Migration Wizard execute. Verify backup size and completeness on staging restore drill.
