# Disaster Recovery

Recover production after a failed deployment, instance corruption, or data loss. Assumes EC2 at `/opt/vsp-voip` with Docker + PM2 + Nginx.

---

## Immediate triage

1. **Stop the bleeding** — rollback or take app offline message
2. **Preserve evidence** — save logs before restart
3. **Assess scope** — API only, web only, DB, full instance
4. **Restore from backup** when data integrity is uncertain

```bash
# Capture state
cd /opt/vsp-voip
git rev-parse HEAD > /tmp/deploy-sha.txt
docker compose ps > /tmp/docker-ps.txt
docker compose logs api --tail=200 > /tmp/api-log.txt
pm2 logs vsp-web --lines 100 --nostream > /tmp/pm2-log.txt
curl -s http://127.0.0.1:3000/ready > /tmp/ready.json
```

---

## Recover after failed deployment

Follow [08-rollback.md](./08-rollback.md):

1. `git checkout <last-known-good>`
2. Restore `.env` backup if env was changed
3. `bash deploy/deploy-api.sh` and/or `deploy/deploy-web.sh`
4. Run [10-production-checklist.md](./10-production-checklist.md)

If Telnyx webhooks were changed, restore URL in Mission Control.

---

## Recover database

### Symptoms

- `/ready` → `database.connected: false`
- Postgres container exit
- Migration failure

### Steps

```bash
docker compose ps postgres
docker compose logs postgres --tail=50

# Restart Postgres
docker compose up -d postgres
docker compose exec postgres pg_isready -U vsp

# If data corrupt — restore backup
docker compose stop api
docker compose exec -T postgres psql -U vsp -d vsp_voip < /path/to/backup.sql
docker compose up -d api
docker compose exec api npx prisma migrate status
```

### No backup available

- Contact AWS snapshot restore if EBS snapshots enabled
- Last resort: `pg_dump` from replica — not configured by default

**Prevention:** `pg_dump` before every migration release.

---

## Recover Docker

```bash
cd /opt/vsp-voip
docker compose down
docker compose up -d postgres redis
# Wait for postgres healthy
docker compose up -d --build api
docker compose ps
curl -s http://127.0.0.1:3000/ready | jq .
```

If volumes corrupted (rare):

```bash
# DESTRUCTIVE — only if volume is unrecoverable and backup exists
docker compose down -v   # removes pgdata/redisdata
# Restore postgres from backup, redeploy API
```

---

## Recover PM2 / frontend

```bash
cd /opt/vsp-voip
pm2 delete vsp-web 2>/dev/null || true
bash deploy/deploy-web.sh
pm2 save
curl -sI http://127.0.0.1:3001/
```

If Node broken on host:

```bash
node -v   # need 18+
cd web && npm ci && npm run build
pm2 start deploy/pm2.ecosystem.config.js
```

---

## Recover Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
sudo cp /opt/vsp-voip/deploy/nginx/vspphone.conf /etc/nginx/sites-available/vspphone.conf
sudo nginx -t && sudo systemctl reload nginx
```

SSL failure:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

Landing 403:

```bash
sudo bash /opt/vsp-voip/deploy/setup-landing.sh
```

---

## Recover Redis

Symptoms: Call Control session errors, cache misses, rate limit oddities.

```bash
docker compose ps redis
docker compose exec redis redis-cli ping
docker compose restart redis
docker compose restart api
```

If Redis data must be cleared (sessions lost — users re-login, active calls may drop):

```bash
docker compose exec redis redis-cli FLUSHALL
docker compose restart api
```

---

## Full instance recovery

If EC2 instance is replaced:

1. Provision new instance; attach or restore EBS volume if available
2. Install Docker, Node 20, PM2, Nginx, certbot
3. Clone repo to `/opt/vsp-voip`
4. Restore `.env` from secrets backup
5. Restore Postgres volume or `pg_dump` restore
6. `docker compose up -d`
7. `bash deploy/deploy-web.sh`
8. Install Nginx config + SSL ([05-nginx.md](./05-nginx.md))
9. Verify Telnyx webhooks point to new IP/DNS
10. Full [14-telephony-validation.md](./14-telephony-validation.md)

---

## RTO / RPO targets (internal guidance)

| Asset | Target |
|-------|--------|
| API + web rollback | < 15 min with known good commit |
| DB restore from daily backup | Depends on backup age (RPO = last backup) |
| Full instance rebuild | 1–4 hours |

---

## Related docs

- [08-rollback.md](./08-rollback.md)
- [03-docker.md](./03-docker.md)
- [06-database-migrations.md](./06-database-migrations.md)
- [11-known-issues.md](./11-known-issues.md)
