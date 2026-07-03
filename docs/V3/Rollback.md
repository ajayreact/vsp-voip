# Tenant Portal V3 — Rollback

**Version:** v3.0.0-rc1

---

## Rollback Levels

| Level | Scope | Downtime | Data loss risk |
|-------|-------|----------|----------------|
| **1. Feature flag** | Disable portal UI/API | Minimal | None |
| **2. Runtime sync** | Stop V3 telephony bridge | Minimal | None |
| **3. Migration rollback** | Revert tenant migration | Low | Migration changes only |
| **4. Backup restore** | Restore tenant snapshot | Medium | Since backup |
| **5. Git/deploy rollback** | Previous app version | Medium | Depends on migrations |
| **6. Schema downgrade** | Reverse Prisma migration | High | **Not supported automated** |

RC1 recommends levels 1–4 only.

---

## Level 1 — Disable Portal

Fastest operational rollback:

```bash
# .env
V3_PORTAL_ENABLED=false

# Rebuild web without V3
unset NEXT_PUBLIC_V3_PORTAL
bash deploy/deploy-web.sh
docker compose restart api
```

Users revert to legacy portal paths. V3 data remains in database.

---

## Level 2 — Disable Runtime Sync

If runtime bridge causes issues:

```bash
V3_RUNTIME_SYNC_ENABLED=false
docker compose restart api

# Optional worker pause
TELEPHONY_V3_OUTBOX_PAUSED=true
docker compose restart telephony-v3-worker
```

Legacy Call Control continues on unchanged path.

---

## Level 3 — Migration Rollback

### Migration Wizard

- UI step 6 or `POST /api/v3/migration-wizard/rollback`
- Auto-triggered on execute failure (RC1 audit)

### Tenant migration

- `lib/v3/rollbackService.js`
- API: `/api/v3/rollback/*`

Always capture pre-migration backup first.

---

## Level 4 — Backup Restore

1. Identify backup in `/v3/backups`
2. `POST /api/v3/backups/:id/restore`
3. Validate tenant scope (no cross-tenant restore)
4. Run Test Lab post-restore

See [BackupRestore.md](./BackupRestore.md).

---

## Level 5 — Deploy Rollback

```bash
git checkout v3.0.0-rc1   # or previous stable tag
bash deploy/deploy-api.sh
bash deploy/deploy-web.sh
```

**Warning:** Do not deploy older code against newer migrations without DBA review.

Checklist: `docs/vsp/git/07-rollback-strategy.md`

---

## Level 6 — Schema Rollback

**Not recommended.** Prisma migrations are forward-only in production.

If required:

1. Restore PostgreSQL from pre-migration snapshot
2. Redeploy matching application tag
3. Document incident

---

## RC1 Tag Reference

Safe rollback target for V3 portal code:

```
v3.0.0-rc1
release/v3.0.0-rc1
```

---

## Related

- [Deployment.md](./Deployment.md)
- [Migration.md](./Migration.md)
- `docs/vsp/git/07-rollback-strategy.md`
