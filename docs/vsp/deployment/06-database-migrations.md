# Database Migrations

Schema changes are managed with **Prisma Migrate**. Migration SQL lives in [prisma/migrations/](../../../prisma/migrations/).

---

## When migrations run

| Environment | Mechanism |
|-------------|-----------|
| Docker API (EC2 / local) | [scripts/docker-entrypoint.sh](../../../scripts/docker-entrypoint.sh) runs `prisma migrate deploy` on container start |
| CI | `.github/workflows/ci.yml` runs `npx prisma migrate deploy` |
| Manual | `npx prisma migrate deploy` from host or `docker compose exec api` |

---

## Production deploy workflow

1. **Review** new migration folders in the release commit
2. **Backup** database before applying (see below)
3. **Deploy API** — migrations apply on container start
4. **Verify** with `migrate status` and `/ready`

```bash
cd /opt/vsp-voip
docker compose exec postgres pg_dump -U vsp vsp_voip > backup-pre-migrate.sql
docker compose up -d --build api
docker compose exec api npx prisma migrate status
curl -s http://127.0.0.1:3000/ready | jq .database
```

---

## Manual migration commands

```bash
# Apply pending migrations
npx prisma migrate deploy

# Check status
npx prisma migrate status

# Inside API container
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma migrate status
```

**Do not** run `prisma migrate dev` against production — it is for local development only.

---

## Verify migrations applied

1. `prisma migrate status` — no pending migrations
2. `/ready` → `database.connected: true`
3. Application features that depend on new columns/tables work

Example failure: API routes return 500 with Prisma errors about missing columns → migration not applied or wrong database URL.

---

## Backup before migrate

```bash
docker compose exec postgres pg_dump -U vsp vsp_voip > backup-$(date +%Y%m%d).sql
```

Store backups off-instance (S3, workstation).

---

## Rollback considerations

Prisma does not auto-rollback migrations. Options:

1. **Restore from backup** (safest for failed migration)
2. **Forward-fix** — new migration that reverses change
3. **Git revert + redeploy** — only if migration was not yet applied

See [08-rollback.md](./08-rollback.md).

---

## Missing migration symptoms

| Symptom | Likely cause |
|---------|--------------|
| 500 errors on new features | Migration not deployed |
| `migrate status` shows pending | Container entrypoint failed; run manually |
| Works locally, fails in prod | Different `DATABASE_URL` or skipped deploy |

See [11-known-issues.md](./11-known-issues.md).

---

## Related docs

- [07-prisma.md](./07-prisma.md)
- [03-docker.md](./03-docker.md)
- [12-disaster-recovery.md](./12-disaster-recovery.md)
