# RC1 Runtime Sync Canary Guide

**Release:** v3.0.0-rc1  
**Default state:** `V3_RUNTIME_SYNC_ENABLED=false`  
**Prerequisite:** Portal RC1 deployed and UAT passed on staging tenant

---

## Overview

Runtime sync pushes portal configuration to the telephony-v3 worker. **Do not enable globally in RC1.** Use a single canary tenant via allowlist.

---

## Pre-Canary Checklist

| # | Requirement | ✓ |
|---|-------------|---|
| 1 | Portal UAT passed on staging tenant | ☐ |
| 2 | Test Lab run completed with acceptable results | ☐ |
| 3 | Backup of canary tenant taken | ☐ |
| 4 | Maintenance window scheduled | ☐ |
| 5 | Legacy telephony still primary — rollback plan ready | ☐ |
| 6 | `telephony-v3-worker` running (if testing live sync) | ☐ |

---

## Step 1 — Enable Allowlist

Set **one** tenant UUID in `.env`:

```bash
# Example Test Lab tenant (staging)
V3_RUNTIME_SYNC_TENANT_ALLOWLIST=1dc390cf-3dcf-4123-8373-1557adbdca84
```

| # | Verify | ✓ |
|---|--------|---|
| 1 | Only one tenant ID in allowlist | ☐ |
| 2 | Tenant ID confirmed with ops | ☐ |
| 3 | No wildcard / empty allowlist with global enable | ☐ |

**Script shortcut (EC2):**

```bash
bash deploy/staging-v3-runtime-canary.sh <TENANT_UUID>
```

---

## Step 2 — Enable Runtime Sync

```bash
V3_RUNTIME_SYNC_ENABLED=true
```

Redeploy API:

```bash
export DEPLOY_BRANCH=release/v3.0.0-rc1
bash deploy/deploy-api.sh
```

Verify in container:

```bash
docker compose exec api printenv | grep V3_RUNTIME_SYNC
```

| # | Verify | Expected | ✓ |
|---|--------|----------|---|
| 1 | `V3_RUNTIME_SYNC_ENABLED` | `true` | ☐ |
| 2 | Allowlist matches canary tenant | UUID | ☐ |
| 3 | Non-allowlisted tenants do not enqueue jobs | ☐ |

---

## Step 3 — Execute Resync

Via UI: `/v3/runtime` → **Resync**  
Via API:

```bash
POST /api/v3/runtime/resync
Authorization: Bearer <tenant-admin-jwt-for-canary-tenant>
```

| # | Verify | ✓ |
|---|--------|---|
| 1 | Resync returns success | ☐ |
| 2 | Jobs appear in `/v3/runtime/jobs` | ☐ |
| 3 | No error spike in API logs | ☐ |

---

## Step 4 — Execute Repair

If runtime validation shows missing links:

```bash
POST /api/v3/runtime/repair
```

Or UI: `/v3/runtime` → **Repair**

| # | Verify | ✓ |
|---|--------|---|
| 1 | Repair report generated | ☐ |
| 2 | Missing runtime links reduced | ☐ |
| 3 | Audit log entry created | ☐ |

---

## Step 5 — Validate Runtime

```bash
GET /api/v3/runtime-validation
POST /api/v3/runtime-validation/run
```

UI: `/v3/runtime-validation`

| # | Check | ✓ |
|---|-------|---|
| 1 | Validation report loads | ☐ |
| 2 | No critical failures for canary tenant | ☐ |
| 3 | Runtime health `/v3/runtime/health` acceptable | ☐ |

---

## Step 6 — Verify Jobs

Monitor `/v3/runtime/jobs`:

| Job state | Action |
|-----------|--------|
| Completed | Proceed to telephony smoke test |
| Pending > 5 min | Check worker logs |
| Failed | Retry once; if repeat → disable sync |
| Dead letter | **Stop canary** — investigate |

```bash
docker compose logs telephony-v3-worker --tail=100
POST /api/v3/runtime/jobs/:jobId/retry   # single retry only
```

| # | Verify | ✓ |
|---|--------|---|
| 1 | All expected object types synced | ☐ |
| 2 | No stuck PROCESSING jobs | ☐ |
| 3 | Worker heartbeat healthy | ☐ |

---

## Step 7 — Disable on Any Failure

**Immediately disable** if:

- Job failure rate > 10% on canary
- Missing runtime links cannot be repaired
- Telephony smoke test fails
- Unexpected impact on legacy call path

```bash
V3_RUNTIME_SYNC_ENABLED=false
V3_RUNTIME_SYNC_TENANT_ALLOWLIST=
bash deploy/deploy-api.sh
```

Optional worker pause:

```bash
TELEPHONY_V3_OUTBOX_PAUSED=true
docker compose restart telephony-v3-worker
```

| # | Post-disable verify | ✓ |
|---|---------------------|---|
| 1 | No new jobs enqueueing | ☐ |
| 2 | Legacy telephony unaffected | ☐ |
| 3 | Incident documented | ☐ |

---

## Success Criteria

- [ ] All runtime jobs completed for canary tenant
- [ ] Runtime validation green
- [ ] Telephony smoke test passed (`04_TELEPHONY_SMOKE_TEST.md`)
- [ ] No regression on non-canary tenants
- [ ] Ops sign-off for next rollout phase

---

## Related

- `04_TELEPHONY_SMOKE_TEST.md`
- `docs/V3/RuntimeSync.md`
- `deploy/staging-v3-runtime-canary.sh`
