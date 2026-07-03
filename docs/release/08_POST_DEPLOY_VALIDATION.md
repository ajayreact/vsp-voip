# RC1 Post-Deploy Validation

**Release:** v3.0.0-rc1  
**Run after:** Every deploy, migration batch, and runtime sync change  
**Environment:** Production (or staging mirror)

---

## Infrastructure

| # | Check | Command / Location | Expected | ✓ |
|---|-------|-------------------|----------|---|
| 1 | API `/health` | `curl -sf .../health` | 200 | ☐ |
| 2 | API `/ready` | `curl -sf .../ready \| jq .` | all true | ☐ |
| 3 | Git SHA match | `/ready` → `build.gitCommit` | = deployed SHA | ☐ |
| 4 | Docker API healthy | `docker compose ps api` | healthy | ☐ |
| 5 | PM2 web online | `pm2 status vsp-web` | online | ☐ |
| 6 | Postgres migrations | `prisma migrate status` | up to date | ☐ |
| 7 | Redis reachable | `/ready` redis check | true | ☐ |

---

## Health

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 8 | Tenant health center | `/v3/health` | ☐ |
| 9 | System health | `/v3/system-health` | ☐ |
| 10 | Production health | `/v3/production-health` | ☐ |
| 11 | Diagnostics bundle | `/v3/diagnostics` | ☐ |
| 12 | PBX repair inspect (read-only) | API `POST /repair/inspect` | ☐ |

---

## Metrics

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 13 | Portal metrics endpoint | `/v3/metrics` or `/api/v3/metrics` | ☐ |
| 14 | API 5xx rate normal (<0.1%) | logs / monitoring | ☐ |
| 15 | No spike in `/api/v3/*` 4xx/5xx | logs | ☐ |
| 16 | `/metrics/v3` (if worker running) | optional | ☐ |

---

## Dashboard

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 17 | Dashboard loads | `/v3/dashboard` | ☐ |
| 18 | Summary cards populated | dashboard | ☐ |
| 19 | Charts render | dashboard | ☐ |
| 20 | No console errors (browser) | devtools | ☐ |
| 21 | Refresh stable (3x rapid refresh) | dashboard | ☐ |

---

## Runtime

| # | Check | Location | Expected (RC1) | ✓ |
|---|-------|----------|----------------|---|
| 22 | Runtime status | `/v3/runtime` | disabled or canary OK | ☐ |
| 23 | Runtime health | `/v3/runtime/health` | ☐ |
| 24 | Job queue | `/v3/runtime/jobs` | no stuck jobs | ☐ |
| 25 | Runtime validation | `/v3/runtime-validation` | ☐ |
| 26 | Sync flag correct | `.env` / container env | per rollout phase | ☐ |

---

## Queues

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 27 | Queue list loads | `/v3/queues` | ☐ |
| 28 | Queue CRUD smoke test | create/read/update | ☐ |
| 29 | Queue validation passes | API validate | ☐ |

---

## Employees

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 30 | Employee list | `/v3/employees` | ☐ |
| 31 | Count matches expected | vs migration report | ☐ |
| 32 | Per-employee health | `/v3/health/:id` | ☐ |

---

## Numbers

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 33 | Inventory loads | `/v3/numbers` | ☐ |
| 34 | Assignments correct | `/v3/assignments` | ☐ |
| 35 | Numbers health | API `/numbers/health` | ☐ |
| 36 | Telnyx sync status | health indicators | ☐ |

---

## Devices

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 37 | Device list | `/v3/devices` | ☐ |
| 38 | Device health | `/v3/device-health` | ☐ |
| 39 | Provisioning configs valid | sample device config | ☐ |

---

## Call Flows

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 40 | Call flow list | `/v3/callflows` | ☐ |
| 41 | Validation on primary flow | API validate | ☐ |
| 42 | Simulator runs | `/v3/callflows/simulator` | ☐ |

---

## Backups

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 43 | Backup list accessible | `/v3/backups` | ☐ |
| 44 | Latest backup < 24h (if scheduled) | backup timestamp | ☐ |
| 45 | Restore preview works | API preview | ☐ |

---

## Migration

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 46 | Migration report | `/v3/migration` or API report | ☐ |
| 47 | No failed migration runs | migration history | ☐ |
| 48 | Test Lab last run | `/v3/test-lab` | ☐ |

---

## Sign-Off

| Field | Value |
|-------|-------|
| Deploy SHA | |
| Validated by | |
| Date/time | |
| Environment | |
| Result | ☐ PASS ☐ FAIL |

**FAIL → execute `07_ROLLBACK_PLAYBOOK.md` before proceeding.**

---

## Related

- `01_DEPLOYMENT_CHECKLIST.md`
- `02_UAT_CHECKLIST.md`
