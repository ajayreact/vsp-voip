# Rollback

How to safely revert a bad deployment on EC2. **Always note the current commit and backup `.env` and database before rolling back.**

---

## Decision tree

| What broke | Rollback scope |
|------------|----------------|
| UI only, API fine | Frontend (git + PM2) |
| API routes / webhooks | Backend (git + Docker) |
| Schema migration failed | Database restore + API |
| Everything | Full stack (Git + Docker + PM2 + optional DB) |

**Rule:** Match rollback scope to what was deployed. Do not rebuild API if only frontend changed.

---

## Frontend only

When: bad Next.js build, wrong `NEXT_PUBLIC_*`, PM2 issue — API and calls still work.

```bash
cd /opt/vsp-voip
git log -5 --oneline                    # pick good commit
git checkout <good-commit>
bash deploy/deploy-web.sh
pm2 status vsp-web
curl -sI https://app.vspphone.com/ | head -3
```

Verification:

- Portal loads, login works
- Softphone registers
- Hard refresh / incognito (clear browser cache)

Return to `main` after hotfix:

```bash
git checkout main && git pull
```

---

## Backend only

When: API regression, webhook errors, missing routes — frontend unchanged.

```bash
cd /opt/vsp-voip
cp .env .env.backup-$(date +%Y%m%d)
git checkout <good-commit>
bash deploy/deploy-api.sh
# Or manual:
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose up -d --build api
docker compose logs api --tail=50
curl -s http://127.0.0.1:3000/ready | jq .
```

Verification:

- `/ready` → `ready: true`
- `build.gitCommit` matches checked-out commit
- `POST /api/softphone/call-accepted` → 401 (not 404)
- Test inbound call + webhook in Telnyx debugger

---

## Database rollback

When: migration corrupted data or failed mid-apply.

**Prefer restore from backup** over manual SQL:

```bash
docker compose stop api
docker compose exec -T postgres psql -U vsp -d vsp_voip < backup-YYYYMMDD.sql
docker compose up -d api
docker compose exec api npx prisma migrate status
```

If migration partially applied, consult Prisma docs for `_prisma_migrations` table resolution before re-deploying.

Pair with API rollback to a commit **before** the bad migration if schema must match code.

---

## Git rollback

On EC2:

```bash
cd /opt/vsp-voip
git fetch origin
git log origin/main -10 --oneline
git checkout <commit-sha>
# Then redeploy affected layers (web and/or api)
```

Document the rolled-back commit in the incident ticket.

**Do not** force-push `main` from EC2. Fix forward on a developer machine and deploy normally.

---

## Docker rollback

Rebuild from previous commit:

```bash
git checkout <good-commit>
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose build --no-cache api
docker compose up -d api
```

If old image layers cause confusion:

```bash
docker compose down
docker compose up -d --build api
```

Verify no stale container:

```bash
docker compose ps
docker compose logs api --tail=30
```

---

## PM2 rollback

Included in frontend rollback via `deploy/deploy-web.sh`. Minimal restart only if build already matches good commit:

```bash
git checkout <good-commit>
cd web && npm ci && NEXT_PUBLIC_API_URL=https://api.vspphone.com npm run build
cd .. && pm2 restart vsp-web && pm2 save
```

---

## Telnyx / Nginx rollback

If webhook URL or Nginx config changed:

1. Revert [deploy/nginx/vspphone.conf](../../../deploy/nginx/vspphone.conf) if needed → `sudo nginx -t && sudo systemctl reload nginx`
2. Restore Telnyx webhook URL in Mission Control (keep previous URL documented in [deploy/PRODUCTION-CHECKLIST.md](../../../deploy/PRODUCTION-CHECKLIST.md))

---

## Rollback verification checklist

- [ ] `git rev-parse HEAD` documented
- [ ] `/ready` healthy, `gitCommit` matches
- [ ] Frontend loads (incognito)
- [ ] Login + JWT API calls work
- [ ] Inbound test call
- [ ] Outbound test call
- [ ] Two-way audio
- [ ] Telnyx debugger shows expected events
- [ ] `.env` restored if JWT/Telnyx secrets were touched

Full telephony checklist: [14-telephony-validation.md](./14-telephony-validation.md)

---

## Related docs

- [02-ec2-deployment.md](./02-ec2-deployment.md)
- [10-production-checklist.md](./10-production-checklist.md)
- [12-disaster-recovery.md](./12-disaster-recovery.md)
