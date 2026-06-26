# Docker

VSP Phone uses Docker Compose for the **API**, **PostgreSQL**, and **Redis** on EC2 and for local development.

Config: [docker-compose.yml](../../../docker-compose.yml)  
Image build: [Dockerfile](../../../Dockerfile)  
Entrypoint: [scripts/docker-entrypoint.sh](../../../scripts/docker-entrypoint.sh)

---

## Services

| Service | Image | Host port | Purpose |
|---------|-------|-----------|---------|
| `api` | Built from repo | 3000 | Express API (`tsx server.js`) |
| `postgres` | `postgres:16-alpine` | 5432 | Primary database |
| `redis` | `redis:7-alpine` | 6379 | Cache, Call Control sessions |

Volumes: `pgdata`, `redisdata` (persist across restarts).

---

## API container lifecycle

1. **Build** — multi-stage Node 22 Alpine; `prisma generate` at build time
2. **Entrypoint** — runs `npx prisma migrate deploy` when `DATABASE_URL` is set
3. **Start** — `npx tsx server.js`
4. **Healthcheck** — `GET /health` every 30s

Build arg `GIT_COMMIT` is baked into the image for `/ready`:

```bash
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose up -d --build api
```

---

## Common commands

From repo root (`/opt/vsp-voip` on EC2):

```bash
# Start all services
docker compose up -d

# Rebuild API only (production deploy)
docker compose up -d --build api

# Logs
docker compose logs api -f
docker compose logs api --tail=100

# Status
docker compose ps

# Stop
docker compose down

# Stop without removing volumes
docker compose stop api
```

---

## Environment overrides

Compose overrides host `.env` for in-network URLs:

```yaml
DATABASE_URL: postgresql://vsp:vsp@postgres:5432/vsp_voip
REDIS_URL: redis://redis:6379
```

The host `.env` may still use `localhost` for tools run outside Docker.

---

## Exec into containers

```bash
# Prisma migrate status
docker compose exec api npx prisma migrate status

# Postgres shell
docker compose exec postgres psql -U vsp -d vsp_voip

# Redis CLI
docker compose exec redis redis-cli ping
```

---

## Database backup / restore

Backup:

```bash
docker compose exec postgres pg_dump -U vsp vsp_voip > backup.sql
```

Restore (destructive — use with care):

```bash
docker compose exec -T postgres psql -U vsp -d vsp_voip < backup.sql
```

---

## Docker cache issues

Symptoms: old routes after `git pull`, missing files in container, stale `GIT_COMMIT`.

Fix:

```bash
docker compose build --no-cache api
docker compose up -d api
```

Verify image was rebuilt:

```bash
docker compose images api
curl -s http://127.0.0.1:3000/ready | jq .build
```

---

## Security (production)

- Bind API to `127.0.0.1:3000` behind Nginx (do not expose 3000 publicly once Nginx is live)
- Do not expose Postgres (5432) or Redis (6379) in the EC2 security group
- Secrets live in `.env` on the host — never commit

---

## Related docs

- [02-ec2-deployment.md](./02-ec2-deployment.md)
- [06-database-migrations.md](./06-database-migrations.md)
- [08-rollback.md](./08-rollback.md)
- [11-known-issues.md](./11-known-issues.md)
