# Release Process

Standard workflow for shipping VSP Phone changes to production EC2.

---

## 1. Development

- Branch from `main`
- Follow [.cursor/rules/vsp-phone-development.mdc](../../../.cursor/rules/vsp-phone-development.mdc)
- Protected telephony files require regression analysis before merge
- Run relevant validators locally:

```bash
npm run validate:p0
npm run validate:call-transfer-session   # if telephony touched
```

---

## 2. Pre-merge checklist

- [ ] PR reviewed
- [ ] No secrets in diff
- [ ] Prisma migrations included if schema changed
- [ ] `web/package-lock.json` updated if web deps changed
- [ ] Telnyx / env changes documented

---

## 3. Merge to main

```bash
git checkout main
git pull origin main
git merge --no-ff feature/your-branch
git push origin main
```

---

## 4. Production deploy (EC2)

SSH to EC2 → `/opt/vsp-voip`:

### Schema change in release?

```bash
docker compose exec postgres pg_dump -U vsp vsp_voip > backup-pre-release.sql
```

### Deploy API (if backend changed)

```bash
bash deploy/deploy-api.sh
```

### Deploy web (if frontend changed)

```bash
bash deploy/deploy-web.sh
```

### Both changed

Deploy **API first**, then **web** (see [02-ec2-deployment.md](./02-ec2-deployment.md)).

---

## 5. Post-deploy validation

Run [10-production-checklist.md](./10-production-checklist.md) and [14-telephony-validation.md](./14-telephony-validation.md).

Automated QA:

```bash
API_BASE=https://api.vspphone.com QA_EMAIL=... QA_PASSWORD=... npm run qa
```

See [15-qa-regression.md](./15-qa-regression.md). Deploy only if QA passes.

From workstation:

```bash
API_URL=https://api.vspphone.com node scripts/production-deployment-report.js
```

---

## 6. Communicate

- Note commit SHA in release log
- If telephony-affecting: announce brief maintenance window
- If JWT or Telnyx keys rotated: users must re-login / webhooks re-verified

---

## Release types

| Type | Deploy |
|------|--------|
| Hotfix (UI only) | `deploy-web.sh` |
| Hotfix (API only) | `deploy-api.sh` |
| Feature (full stack) | API → web |
| Migration | Backup → API → verify `migrate status` |
| Nginx / SSL | Config copy + `nginx -t` + reload |
| Mobile APK | Build script + optional landing `/apk/` |

---

## Version tracking

| Layer | Version source |
|-------|----------------|
| API | `/ready` → `build.gitCommit` |
| Git on server | `git rev-parse HEAD` |
| Frontend | No runtime SHA — use server git + build timestamp in PM2 logs |
| Mobile | App build number in Flutter |

---

## Related docs

- [02-ec2-deployment.md](./02-ec2-deployment.md)
- [08-rollback.md](./08-rollback.md)
- [10-production-checklist.md](./10-production-checklist.md)
