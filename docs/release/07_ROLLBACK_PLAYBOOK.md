# RC1 Rollback Playbook

**Release:** v3.0.0-rc1  
**Goal:** Restore stable service within 15 minutes (portal disable) to 2 hours (full restore)

---

## Decision Tree

```
Issue detected
    │
    ├─ Portal UI/API only? ──► Disable Portal (Level 1)
    │
    ├─ Runtime sync causing issues? ──► Disable Runtime Sync (Level 2)
    │
    ├─ Bad migration? ──► Migration Rollback (Level 3)
    │
    ├─ Data corruption? ──► Restore Backup (Level 4)
    │
    └─ Bad deploy/build? ──► Git Rollback (Level 5)
```

---

## Level 1 — Disable Portal

**Time:** ~5 minutes  
**Impact:** V3 UI hidden; legacy portal unchanged; V3 data preserved

```bash
cd /opt/vsp-voip

# Edit .env
V3_PORTAL_ENABLED=false

# Rebuild web WITHOUT V3 flag
unset NEXT_PUBLIC_V3_PORTAL
bash deploy/deploy-web.sh

# Restart API to pick up flag
docker compose restart api
```

| # | Verify | Expected | ✓ |
|---|--------|----------|---|
| 1 | `/api/v3/health` with JWT | 404 | ☐ |
| 2 | V3 nav hidden in browser | ☐ |
| 3 | Legacy portal functional | ☐ |
| 4 | `/ready` true | ☐ |
| 5 | Legacy telephony unaffected | ☐ |

---

## Level 2 — Disable Runtime Sync

**Time:** ~5 minutes  
**Use when:** Runtime jobs failing or call routing impacted on canary tenant

```bash
V3_RUNTIME_SYNC_ENABLED=false
V3_RUNTIME_SYNC_TENANT_ALLOWLIST=

bash deploy/deploy-api.sh

# Optional: pause worker outbox
TELEPHONY_V3_OUTBOX_PAUSED=true
docker compose restart telephony-v3-worker
```

| # | Verify | ✓ |
|---|--------|---|
| 1 | No new jobs in `/v3/runtime/jobs` | ☐ |
| 2 | Legacy Call Control handling calls | ☐ |
| 3 | Canary tenant calls restored | ☐ |

---

## Level 3 — Migration Rollback

**Time:** 15–60 minutes  
**Use when:** Migration left tenant in bad state

**Wizard rollback (super-admin):**

```bash
POST /api/v3/migration-wizard/rollback
{ "tenantId": "<UUID>", "runId": "<RUN_ID>" }
```

**Tenant migration rollback:**

```bash
POST /api/v3/migration/rollback
```

| # | Verify | ✓ |
|---|--------|---|
| 1 | Rollback API returns success | ☐ |
| 2 | Health center returns to pre-migration state | ☐ |
| 3 | Legacy telephony still works | ☐ |

---

## Level 4 — Restore Backup

**Time:** 30–120 minutes  
**Use when:** Data corruption or rollback insufficient

```bash
# Identify backup ID from /v3/backups or API
POST /api/v3/backup/restore-preview
POST /api/v3/backup/restore
{ "backupId": "<ID>" }
```

| # | Verify | ✓ |
|---|--------|---|
| 1 | Restore preview reviewed | ☐ |
| 2 | Restore completes | ☐ |
| 3 | `TENANT_MISMATCH` not triggered (same tenant) | ☐ |
| 4 | Health center green | ☐ |
| 5 | Tenant admin notified | ☐ |

**Infrastructure DB restore** (catastrophic):

```bash
# Restore PostgreSQL from pg_dump snapshot
# Then redeploy matching git tag
```

---

## Level 5 — Git Rollback

**Time:** 20–45 minutes  
**Use when:** Bad deploy/build; not a data issue

```bash
cd /opt/vsp-voip
git fetch origin
git checkout v3.0.0-rc1          # or prior known-good SHA
git rev-parse HEAD               # record SHA

export DEPLOY_COMMIT=$(git rev-parse HEAD)
bash deploy/deploy-api.sh
bash deploy/deploy-web.sh
```

| # | Verify | ✓ |
|---|--------|---|
| 1 | `/ready` gitCommit matches rolled-back SHA | ☐ |
| 2 | Portal behavior matches expected version | ☐ |
| 3 | Migrations compatible (no downgrade needed) | ☐ |

**Warning:** Do not deploy old code against newer schema without DBA approval.

---

## Restart Services

If partial rollback insufficient:

```bash
# API
docker compose restart api
docker compose logs api --tail=50

# Web
pm2 restart vsp-web
pm2 logs vsp-web --lines 30

# Worker (if was running)
docker compose restart telephony-v3-worker

# Full stack (last resort)
docker compose down && docker compose up -d
```

| # | Verify | ✓ |
|---|--------|---|
| 1 | All containers online | ☐ |
| 2 | `/ready` true within 60s | ☐ |
| 3 | PM2 online | ☐ |

---

## Verify Health

Post-rollback validation:

```bash
curl -sf https://api.vspphone.com/ready | jq .
curl -sf https://api.vspphone.com/health
# Test legacy login + softphone if telephony was impacted
```

| # | Check | ✓ |
|---|-------|---|
| 1 | `/ready` all dependencies true | ☐ |
| 2 | Legacy inbound test call | ☐ |
| 3 | Legacy outbound test call | ☐ |
| 4 | No elevated 5xx in logs (30 min) | ☐ |
| 5 | Incident post-mortem scheduled | ☐ |

---

## Rollback Log Template

| Field | Value |
|-------|-------|
| Incident ID | |
| Rollback level used | |
| Start time | |
| End time | |
| Operator | |
| Root cause (initial) | |
| Tenants affected | |
| Verified by | |

---

## Related

- `01_DEPLOYMENT_CHECKLIST.md`
- `08_POST_DEPLOY_VALIDATION.md`
- `docs/V3/Rollback.md`
