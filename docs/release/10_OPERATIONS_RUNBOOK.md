# RC1 Operations Runbook

**Release:** v3.0.0-rc1  
**On-call scope:** Portal UI/API, migrations, backups — **not** live telephony unless runtime sync enabled

---

## Daily Checks (5–10 min)

| # | Check | How | Alert if |
|---|-------|-----|----------|
| 1 | API health | `curl -sf .../health` | non-200 |
| 2 | API ready | `curl -sf .../ready \| jq .` | any false |
| 3 | Git SHA drift | `/ready` vs expected deploy | mismatch |
| 4 | PM2 web status | `pm2 status vsp-web` | not online |
| 5 | Docker API | `docker compose ps api` | unhealthy |
| 6 | API error logs | `docker compose logs api --since 24h \| grep -i error` | spike |
| 7 | V3 5xx rate | monitoring dashboard | >0.1% sustained |

---

## Weekly Checks (30 min)

| # | Check | How |
|---|-------|-----|
| 1 | Production health page | `/v3/production-health` |
| 2 | System health | `/v3/system-health` |
| 3 | Disk / DB growth | EC2 + Postgres metrics |
| 4 | Backup freshness | `/v3/backups` — latest < 7 days |
| 5 | Migration run history | `/v3/migration` — no stuck runs |
| 6 | Test Lab (staging) | Re-run if staging env available |
| 7 | Prisma migration status | `prisma migrate status` |
| 8 | Review support tickets tagged V3 | trend analysis |
| 9 | Certificate expiry | Nginx/ssl cert dates |
| 10 | `.env` drift audit | compare to secure backup |

---

## Monthly Checks (1–2 hours)

| # | Check | How |
|---|-------|-----|
| 1 | Restore drill | backup restore to staging clone |
| 2 | Migration wizard dry-run | staging tenant |
| 3 | UAT regression sample | `02_UAT_CHECKLIST.md` subset |
| 4 | Review known limitations | `09_KNOWN_LIMITATIONS.md` |
| 5 | Access review | super-admin accounts |
| 6 | Telnyx account / billing | number inventory reconcile |
| 7 | Dependency security | `npm audit` (informational) |
| 8 | Documentation review | update runbooks if process changed |

---

## Backup Schedule

| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Tenant V3 backup | Before each migration | 90 days | `/v3/backups` |
| Tenant export JSON | Before major change | 30 days | `/v3/import-export` |
| PostgreSQL infra | Daily | 30 days | `pg_dump` / AWS snapshot |
| `.env` secure copy | On change | 90 days | encrypted store |

**Before any migration:** mandatory tenant backup (see `05_TENANT_MIGRATION_PLAYBOOK.md`).

---

## Migration Schedule

| Phase | Batch size | Window |
|-------|------------|--------|
| Pilot | 1 tenant | Business hours OK with notice |
| Early rollout | 1–2/day | Off-peak preferred |
| Full rollout | 3–5/day max | Off-peak |
| Rollback window | 24h post-migration | ops on standby |

Track: tenant UUID, migration run ID, operator, result, backup ID.

---

## Runtime Sync Monitoring

**Only applicable when canary enabled.**

| Signal | Normal | Alert |
|--------|--------|-------|
| Job completion rate | >95% | <90% |
| Stuck PROCESSING jobs | 0 | >0 for 5 min |
| DLQ depth | 0 | >0 |
| Worker heartbeat | fresh | stale >60s |
| `/v3/runtime/health` | green | yellow/red |

```bash
docker compose logs telephony-v3-worker --tail=100
curl -sf .../ready/v3
```

**Alert action:** Disable sync per `07_ROLLBACK_PLAYBOOK.md` Level 2.

---

## Incident Response

### Severity Levels

| Level | Example | Response time |
|-------|---------|---------------|
| P1 | Portal down, wrong tenant data | 15 min |
| P2 | Migration failure, dashboard broken | 1 hour |
| P3 | Single feature broken, workaround exists | 4 hours |
| P4 | Cosmetic, docs | next sprint |

### P1 Procedure

1. Acknowledge incident — assign incident commander
2. Check `/ready` and recent deploys
3. Disable portal if widespread (`07_ROLLBACK_PLAYBOOK.md` Level 1)
4. If telephony impacted → disable runtime sync (Level 2)
5. Notify stakeholders
6. Post-mortem within 48h

### Useful Commands

```bash
cd /opt/vsp-voip
docker compose logs api --tail=200
docker compose logs telephony-v3-worker --tail=100
pm2 logs vsp-web --lines 100
curl -sf http://127.0.0.1:3000/ready | jq .
docker compose exec postgres psql -U vsp -d vsp_voip -c "SELECT count(*) FROM \"V3MigrationRun\" WHERE status='FAILED';"
```

---

## Emergency Rollback

**Fastest path (portal issues only):**

```bash
V3_PORTAL_ENABLED=false
unset NEXT_PUBLIC_V3_PORTAL
bash deploy/deploy-web.sh
docker compose restart api
```

**Full procedure:** `07_ROLLBACK_PLAYBOOK.md`

Post-rollback: run `08_POST_DEPLOY_VALIDATION.md` + test legacy telephony.

---

## Contacts & Escalation

| Role | Responsibility |
|------|----------------|
| On-call ops | Deploy, rollback, health checks |
| Super-admin | Migration wizard, test lab, marketplace |
| DBA | Postgres restore, migration issues |
| Telephony lead | Runtime sync, call failures (if enabled) |

---

## Key URLs

| URL | Purpose |
|-----|---------|
| `https://api.vspphone.com/ready` | Deploy verification |
| `https://app.vspphone.com/v3/dashboard` | Portal health |
| `https://app.vspphone.com/v3/health` | Tenant health center |
| `https://app.vspphone.com/v3/production-health` | Production readiness |
| `https://app.vspphone.com/v3/runtime` | Runtime sync status |

---

## Related Documents

| Doc | Purpose |
|-----|---------|
| `01_DEPLOYMENT_CHECKLIST.md` | Deploy procedure |
| `07_ROLLBACK_PLAYBOOK.md` | Rollback procedures |
| `08_POST_DEPLOY_VALIDATION.md` | Post-deploy checks |
| `09_KNOWN_LIMITATIONS.md` | Deferred items |
| `docs/vsp/deployment/18-v3-production-operations-runbook.md` | Extended internal runbook |
