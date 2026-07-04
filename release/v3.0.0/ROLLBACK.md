# V3.0.0 — Rollback Guide

## Level 1 — Disable Portal (Fastest)

```bash
V3_PORTAL_ENABLED=false
unset NEXT_PUBLIC_V3_PORTAL
bash deploy/deploy-web.sh
docker compose restart api
```

Legacy portal remains. V3 data preserved in database.

## Level 2 — Disable Runtime Sync

```bash
V3_RUNTIME_SYNC_ENABLED=false
V3_RUNTIME_SYNC_TENANT_ALLOWLIST=
bash deploy/deploy-api.sh
```

## Level 3 — Migration Rollback

```bash
POST /api/v3/migration-wizard/rollback
POST /api/v3/migration/rollback
```

## Level 4 — Backup Restore

```bash
POST /api/v3/backup/restore-preview
POST /api/v3/backup/restore
```

## Level 5 — Git Rollback

```bash
git checkout v3.0.0-rc1    # or last known-good SHA
bash deploy/deploy-api.sh
bash deploy/deploy-web.sh
```

**Warning:** Do not deploy old code against newer schema without DBA review.

## Level 6 — Database Restore

Restore PostgreSQL from pre-upgrade snapshot. Redeploy matching application version.

## Full Playbook

See `docs/release/07_ROLLBACK_PLAYBOOK.md`

## Verify After Rollback

- `/ready` true
- Legacy telephony smoke test
- `docs/release/08_POST_DEPLOY_VALIDATION.md`
