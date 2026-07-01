# EC2 Deployment

Production runs on a single EC2 instance at **`/opt/vsp-voip`**. Nginx terminates TLS; the API runs in Docker; the Next.js portal runs under PM2.

## Architecture (production)

| Host | Service | Port | Process |
|------|---------|------|---------|
| `vspphone.com` | Landing (static) | 443 → files | Nginx |
| `app.vspphone.com` | Tenant portal | 443 → 3001 | PM2 `vsp-web` |
| `admin.vspphone.com` | Super admin | 443 → 3001 | PM2 `vsp-web` |
| `api.vspphone.com` | Express API | 443 → 3000 | Docker `api` |

Data: PostgreSQL and Redis run in Docker Compose alongside the API and **telephony-v3-worker** (V3 ingress/outbox).

See also: [deploy/PRODUCTION-CHECKLIST.md](../../../deploy/PRODUCTION-CHECKLIST.md)

---

## Deployment order

Always deploy in this order unless you are doing a **frontend-only** hotfix:

1. **Git** — confirm branch and commit on the server
2. **Database** — apply Prisma migrations if the release includes schema changes
3. **API** — rebuild and restart Docker `api`
4. **V3 worker** — rebuild and restart `telephony-v3-worker` when V3 is enabled ([16-telephony-v3-worker.md](./16-telephony-v3-worker.md))
5. **Frontend** — build and PM2 restart `vsp-web`
6. **Verification** — `/ready`, `/ready/v3`, routes, telephony smoke test

Nginx and SSL rarely change; reload only when [deploy/nginx/vspphone.conf](../../../deploy/nginx/vspphone.conf) was updated.

---

## Frontend deploy

Script: [deploy/deploy-web.sh](../../../deploy/deploy-web.sh)

```bash
cd /opt/vsp-voip
bash deploy/deploy-web.sh
```

What the script does:

1. `git pull origin main`
2. Stops PM2 `vsp-web` (avoids crash loop during install)
3. Removes `web/node_modules` and `web/.next`
4. `npm ci` in `web/`
5. Verifies installed `next` version matches `package.json`
6. `npm run build` with `NEXT_PUBLIC_API_URL` (default `https://api.vspphone.com`)
7. `pm2 restart vsp-web` (or first-time start from ecosystem file)
8. `pm2 save`

Manual equivalent:

```bash
cd /opt/vsp-voip
git pull origin main
cd web
rm -rf node_modules .next
npm ci
export NEXT_PUBLIC_API_URL=https://api.vspphone.com
export NEXT_PUBLIC_SOFTPHONE_V2_ENABLED=true
npm run build
cd ..
pm2 restart vsp-web
pm2 save
```

Verify frontend:

```bash
pm2 status vsp-web
pm2 logs vsp-web --lines 50
curl -sI https://app.vspphone.com/ | head -5
# Hard refresh browser or incognito to avoid stale JS cache
```

---

## API deploy

Script: [deploy/deploy-api.sh](../../../deploy/deploy-api.sh)

```bash
cd /opt/vsp-voip
bash deploy/deploy-api.sh
```

What the script does:

1. `git fetch` / `checkout` / `pull` on `main` (or `DEPLOY_BRANCH`)
2. Verifies HEAD includes required bridge-grace commits
3. Sets `GIT_COMMIT` for the Docker build
4. `docker compose up -d --build api`
5. Waits up to 60s for `GET http://127.0.0.1:3000/ready`
6. Probes `POST /api/softphone/call-accepted` (expect **401** without token, not **404**)
7. Probes `POST /api/admin/numbers/sync` (expect **401**, not **404**)

Manual equivalent:

```bash
cd /opt/vsp-voip
git pull origin main
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose up -d --build api
bash deploy/deploy-v3-worker.sh
docker compose logs api --tail=80
curl -s http://127.0.0.1:3000/ready | jq .
curl -s http://127.0.0.1:3000/ready/v3 | jq .
```

Verify API publicly:

```bash
curl -s https://api.vspphone.com/ready | jq .
curl -s https://api.vspphone.com/health
```

---

## Database deploy

Migrations run automatically when the API container starts ([scripts/docker-entrypoint.sh](../../../scripts/docker-entrypoint.sh)).

For manual apply (e.g. before API restart):

```bash
cd /opt/vsp-voip
docker compose exec api npx prisma migrate deploy
# Or on host with DATABASE_URL pointing at production DB:
npx prisma migrate deploy
```

Verify migrations:

```bash
docker compose exec api npx prisma migrate status
```

**Before destructive changes:** backup Postgres:

```bash
docker compose exec postgres pg_dump -U vsp vsp_voip > backup-$(date +%Y%m%d-%H%M).sql
```

See [06-database-migrations.md](./06-database-migrations.md) and [07-prisma.md](./07-prisma.md).

---

## Verification checklist (post-deploy)

### `/ready` endpoint

```bash
curl -s https://api.vspphone.com/ready | jq .
```

Expect `ready: true` with:

- `database.connected: true`
- `redis.connected: true` (when Redis required)
- `telnyx.apiKeyConfigured: true`
- `build.gitCommit` matching deployed commit (when built via `deploy-api.sh`)

### Git commit match

On server:

```bash
cd /opt/vsp-voip && git rev-parse HEAD && git log -1 --oneline
```

Compare to `build.gitCommit` in `/ready` JSON.

Remote report from workstation:

```bash
API_URL=https://api.vspphone.com node scripts/production-deployment-report.js
```

### Build version

API embeds `GIT_COMMIT` at Docker build time ([Dockerfile](../../../Dockerfile)). If `/ready` shows `build.gitCommit: null`, redeploy API with `deploy/deploy-api.sh`.

### API routes (smoke)

| Route | Expected (no auth) |
|-------|-------------------|
| `GET /health` | 200 |
| `GET /ready` | 200, `ready: true` |
| `POST /api/softphone/call-accepted` | 401 (not 404) |
| `POST /api/admin/numbers/sync` | 401 (not 404) |

Authenticated:

```bash
API_URL=https://api.vspphone.com EMAIL=... PASSWORD=... node scripts/verify-mobile-auth.js
API_URL=https://api.vspphone.com node scripts/diagnose-did-sync.js
```

### Frontend routes

| URL | Expect |
|-----|--------|
| https://app.vspphone.com/ | Login / dashboard |
| https://app.vspphone.com/softphone-v2 | Softphone |
| https://app.vspphone.com/softphone-v2/diagnostics | WebRTC diagnostics (after web deploy) |
| https://admin.vspphone.com/ | Super admin |

---

## Environment on EC2

Root `.env` is loaded by Docker Compose. Key production values:

```env
NODE_ENV=production
API_PUBLIC_URL=https://api.vspphone.com
WEB_ORIGIN=https://app.vspphone.com
ADMIN_ORIGIN=https://admin.vspphone.com
JWT_SECRET=<do not rotate casually>
TELNYX_API_KEY=<required>
REDIS_URL=redis://redis:6379   # inside Compose network
```

PM2 env for web: [deploy/pm2.ecosystem.config.js](../../../deploy/pm2.ecosystem.config.js)

---

## Telnyx webhooks

After HTTPS is live, webhooks must point to:

```
https://api.vspphone.com/webhook/call-control
```

Confirm in API startup logs:

```bash
docker compose logs api | grep -i webhook
```

Test inbound call before announcing go-live.

---

## Related docs

- [04-pm2.md](./04-pm2.md) — PM2 operations
- [05-nginx.md](./05-nginx.md) — reverse proxy
- [08-rollback.md](./08-rollback.md) — rollback procedures
- [10-production-checklist.md](./10-production-checklist.md) — full pre/post checklist
- [14-telephony-validation.md](./14-telephony-validation.md) — call testing
