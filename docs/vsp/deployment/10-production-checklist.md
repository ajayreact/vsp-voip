# Production Checklist

Use before **every** production deployment and after deploy completes.

---

## Pre-deploy

### Git & branch

- [ ] **Git status clean** on EC2 (or intentional deploy of specific commit documented)
- [ ] **Correct branch** — typically `main` (`DEPLOY_BRANCH` if overridden)
- [ ] **Correct commit** — `git log -1` matches expected merge SHA
- [ ] Workstation `origin/main` matches what you intend to deploy

### Backups & risk

- [ ] `.env` backed up if env vars change
- [ ] Postgres backup if migrations in release: `pg_dump`
- [ ] Telnyx webhook URLs noted for rollback
- [ ] Incident channel / maintenance notice if telephony-impacting

### Infrastructure

- [ ] **Docker images** — plan to rebuild API (`--build`) not reuse stale cache
- [ ] **Prisma migrations** — review new folders in release; backup if needed
- [ ] EC2 disk space OK (`df -h`)
- [ ] SSL cert not expiring (`certbot certificates`)

---

## Deploy execution

- [ ] API: `bash deploy/deploy-api.sh` (if backend changed)
- [ ] Web: `bash deploy/deploy-web.sh` (if frontend changed)
- [ ] Nginx reload only if config changed

---

## Post-deploy — health

### API

- [ ] **API healthy** — `curl -s https://api.vspphone.com/ready | jq .ready` → `true`
- [ ] **Database** — `database.connected: true`
- [ ] **Redis** — `redis.connected: true` (when required)
- [ ] **Build version** — `build.gitCommit` matches deployed commit
- [ ] `GET /health` → 200
- [ ] Route probes: `call-accepted`, `numbers/sync` → 401 not 404

### Frontend

- [ ] **Frontend healthy** — `pm2 status vsp-web` online
- [ ] https://app.vspphone.com loads
- [ ] https://admin.vspphone.com loads
- [ ] Hard refresh or incognito (browser cache)

### WebSocket / connectivity

- [ ] **WebSocket healthy** — Nginx upgrade headers present; no 502 on app host
- [ ] Portal API calls succeed (network tab — no CORS / 401 storms)

---

## Post-deploy — telephony & product

- [ ] **Telnyx login** — softphone registers (SIP/WebRTC connected)
- [ ] **Microphone** — browser permission granted; no muted mic icon
- [ ] **Inbound** — test call to DID rings and answers
- [ ] **Outbound** — place call; remote party rings
- [ ] **Two-way audio** — both directions heard
- [ ] **Voicemail** — leave VM; appears in portal
- [ ] **Recording** — recording starts/stops; playback works
- [ ] **Transfer** — blind transfer completes (if in scope)
- [ ] **DID sync** — `node scripts/diagnose-did-sync.js` passes
- [ ] **Assignment** — number assigned to tenant/extension
- [ ] **Extension** — extension routing works

Detailed steps: [14-telephony-validation.md](./14-telephony-validation.md)

---

## Post-deploy — auth & config

- [ ] Login web + mobile smoke test
- [ ] `JWT_SECRET` unchanged (unless planned rotation)
- [ ] `TELNYX_API_KEY` present in `/ready` → `telnyx.apiKeyConfigured`
- [ ] `WEB_ORIGIN` / `ADMIN_ORIGIN` match browser URLs

---

## Quick command block (EC2)

```bash
cd /opt/vsp-voip
git log -1 --oneline
curl -s http://127.0.0.1:3000/ready | jq '{ready, gitCommit: .build.gitCommit, db: .database.connected, redis: .redis.connected}'
pm2 status vsp-web
curl -sI https://app.vspphone.com/ | head -3
```

---

## Related docs

- [02-ec2-deployment.md](./02-ec2-deployment.md)
- [09-release-process.md](./09-release-process.md)
- [11-known-issues.md](./11-known-issues.md)
- [14-telephony-validation.md](./14-telephony-validation.md)
