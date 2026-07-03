# Tenant Portal V3 — Rollback

**RC1:** v3.0.0-rc1

## Level 1 — Disable Portal (fastest)

```bash
V3_PORTAL_ENABLED=false
# rebuild web without NEXT_PUBLIC_V3_PORTAL
bash deploy/deploy-web.sh && docker compose restart api
```

Legacy portal remains; V3 data stays in DB.

## Level 2 — Stop Runtime Sync

```bash
V3_RUNTIME_SYNC_ENABLED=false
docker compose restart api
TELEPHONY_V3_OUTBOX_PAUSED=true  # optional worker pause
```

## Level 3 — Migration Rollback

- `POST /api/v3/migration-wizard/rollback` (super-admin)
- `POST /api/v3/migration/rollback` (tenant admin)
- Auto-rollback on wizard execute failure

## Level 4 — Backup Restore

`POST /api/v3/backup/restore` — requires matching tenant ID.

## Level 5 — Git Rollback

```bash
git checkout release/v3.0.0-rc1  # or prior stable tag
bash deploy/deploy-api.sh && bash deploy/deploy-web.sh
```

## Level 6 — Schema Downgrade

Not supported. Restore PostgreSQL snapshot if required.

## Operations

Document rollback reason in audit trail. Notify tenant before data rollback.
