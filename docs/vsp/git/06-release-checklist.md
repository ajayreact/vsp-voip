# Release Checklist

Complete before **every production deployment** from `main` (after tag applied).

Combines Git release gates with EC2 deployment verification.

---

## Git & version

- [ ] **Git tag** — release tagged on `main` (e.g. `v1.2.0`)
- [ ] EC2 will pull **`main` only** — not `development` or `feature/*`
- [ ] `git log -1` on EC2 matches tagged commit after pull
- [ ] Release notes / changelog updated
- [ ] Hotfix path documented if emergency release

---

## Database & backend

- [ ] **Prisma migrations** — reviewed; backup taken if schema change
- [ ] **Docker image** — `docker compose up -d --build api` (not stale cache)
- [ ] **API health** — `/ready` → `ready: true`
- [ ] `build.gitCommit` matches deployed commit
- [ ] Route probes pass (`call-accepted`, `numbers/sync` → 401 not 404)

```bash
bash deploy/deploy-api.sh
curl -s https://api.vspphone.com/ready | jq .
```

---

## Frontend

- [ ] **Frontend health** — PM2 `vsp-web` online
- [ ] **PM2** — `deploy/deploy-web.sh` completed (build + restart)
- [ ] Hard refresh / incognito tested (**browser cache**)

```bash
bash deploy/deploy-web.sh
pm2 status vsp-web
```

---

## Infrastructure

- [ ] **Nginx** — no config change, or `nginx -t` + reload if changed
- [ ] SSL valid
- [ ] `.env` unchanged unless documented (JWT, Telnyx keys)

---

## Telephony (production smoke)

- [ ] **WebRTC** — softphone registers
- [ ] **ICE** — diagnostics show `connected` during test call
- [ ] **TURN** — relay candidates available at office network (if applicable)
- [ ] Inbound + outbound test calls
- [ ] Two-way audio
- [ ] **Recording** — start/stop + portal playback
- [ ] **Voicemail** — leave test message
- [ ] **Transfer** — blind transfer if in scope for release

Route: `/softphone-v2/diagnostics` for ICE/RTP evidence.

---

## Deployment validation

- [ ] [../deployment/10-production-checklist.md](../deployment/10-production-checklist.md) complete
- [ ] `npm run validate:deployment-docs` (infra docs current)
- [ ] `API_URL=https://api.vspphone.com node scripts/production-deployment-report.js`

---

## Post-deploy

- [ ] Tag and commit SHA recorded in release log
- [ ] `development` back-merged from `main`
- [ ] Monitor API logs for 30 minutes during test calls

---

## Quick EC2 command block

```bash
cd /opt/vsp-voip
git fetch origin && git checkout main && git pull origin main
git describe --tags
bash deploy/deploy-api.sh
bash deploy/deploy-web.sh
curl -s http://127.0.0.1:3000/ready | jq '{ready, tag: .build.gitCommit}'
pm2 status vsp-web
```

---

## Related docs

- [03-release-workflow.md](./03-release-workflow.md)
- [07-rollback-strategy.md](./07-rollback-strategy.md)
- [../deployment/02-ec2-deployment.md](../deployment/02-ec2-deployment.md)
