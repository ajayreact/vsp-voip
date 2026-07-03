# RC1 Tenant Migration Playbook

**Release:** v3.0.0-rc1  
**Audience:** Super-admin + tenant admin  
**Tools:** Migration Wizard, Test Lab, Backup Center

---

## Overview

This playbook migrates a legacy tenant to V3 portal configuration. It does **not** automatically switch live telephony unless runtime sync is separately enabled.

---

## Phase 0 — Preparation

| # | Action | Owner | ✓ |
|---|--------|-------|---|
| 0.1 | Confirm RC1 deployed on target environment | Ops | ☐ |
| 0.2 | Identify tenant UUID | Ops | ☐ |
| 0.3 | Schedule maintenance window | Ops | ☐ |
| 0.4 | Notify tenant admin | Support | ☐ |
| 0.5 | Confirm rollback contacts available | Ops | ☐ |

---

## Phase 1 — Discovery

**UI:** `/v3/migration-wizard` → Step 1  
**API:** `GET /api/v3/migration-wizard/discovery?tenantId=<UUID>`

Captures:
- Legacy extensions, DIDs, devices
- Existing V3 objects (if partial migration)
- Gap inventory

| # | Verify | ✓ |
|---|--------|---|
| 1.1 | Discovery completes without error | ☐ |
| 1.2 | Object counts reasonable vs expected | ☐ |
| 1.3 | No unexpected cross-tenant data | ☐ |

**Output:** Save discovery JSON / screenshot for audit.

---

## Phase 2 — Validation

**API:** `POST /api/v3/migration-wizard/validate`

Pre-flight checks:
- Tenant exists and is active
- Required Telnyx readiness
- No blocking data conflicts

| # | Verify | ✓ |
|---|--------|---|
| 2.1 | Validation passes (no blocking errors) | ☐ |
| 2.2 | Warnings reviewed and accepted | ☐ |
| 2.3 | Test Lab run on staging clone (recommended) | ☐ |

**Stop if validation fails.** Fix issues before preview.

---

## Phase 3 — Preview

**API:** `POST /api/v3/migration-wizard/preview`

Dry-run diff showing what will be created/updated.

| # | Verify | ✓ |
|---|--------|---|
| 3.1 | Preview diff reviewed by ops + tenant admin | ☐ |
| 3.2 | No unexpected deletions | ☐ |
| 3.3 | Sign-off obtained | ☐ |

---

## Phase 4 — Backup

**Before any execute step:**

```bash
POST /api/v3/backup/create
# or UI: /v3/backups
```

| # | Verify | ✓ |
|---|--------|---|
| 4.1 | Backup created and listed | ☐ |
| 4.2 | Export JSON downloaded (`/v3/import-export`) | ☐ |
| 4.3 | Backup ID recorded: ________________ | ☐ |

---

## Phase 5 — Repair (Optional)

If health center or discovery shows gaps:

```bash
POST /api/v3/repair/inspect
POST /api/v3/repair/apply   # only after inspect review
```

| # | Verify | ✓ |
|---|--------|---|
| 5.1 | Inspect report reviewed | ☐ |
| 5.2 | Apply fixes non-destructive changes only | ☐ |
| 5.3 | Re-run validation | ☐ |

---

## Phase 6 — Migration (Execute)

**API:** `POST /api/v3/migration-wizard/run`  
**Rate limit:** `v3HeavyMutationLimiter`

Auto-rollback triggers on execute exception (RC1 audit).

| # | Verify | ✓ |
|---|--------|---|
| 6.1 | Run completes with success status | ☐ |
| 6.2 | Migration run ID recorded: ________________ | ☐ |
| 6.3 | No auto-rollback triggered | ☐ |
| 6.4 | API logs reviewed for errors | ☐ |

**Alternative (tenant-scoped):** `POST /api/v3/migration/run` for Phase 10 migration service.

---

## Phase 7 — Runtime Sync (Optional — Post RC1 Canary)

Only after canary approval:

1. Add tenant to `V3_RUNTIME_SYNC_TENANT_ALLOWLIST`
2. Enable `V3_RUNTIME_SYNC_ENABLED=true`
3. Execute resync (`03_RUNTIME_SYNC_CANARY.md`)

| # | Verify | ✓ |
|---|--------|---|
| 7.1 | Runtime jobs completed | ☐ |
| 7.2 | Runtime validation green | ☐ |
| 7.3 | Telephony smoke test passed | ☐ |

**Skip this phase for portal-only RC1 rollout.**

---

## Phase 8 — Validation

Post-migration checks:

| # | Check | Location | ✓ |
|---|-------|----------|---|
| 8.1 | Health center | `/v3/health` | ☐ |
| 8.2 | Employee count matches | `/v3/employees` | ☐ |
| 8.3 | Numbers inventory | `/v3/numbers` | ☐ |
| 8.4 | Devices | `/v3/devices` | ☐ |
| 8.5 | PBX objects | ring groups, queues, etc. | ☐ |
| 8.6 | Dashboard loads | `/v3/dashboard` | ☐ |
| 8.7 | Test Lab re-run | `/v3/test-lab` | ☐ |
| 8.8 | Migration report | `GET /api/v3/migration/report` | ☐ |

---

## Phase 9 — Rollback (If Needed)

Triggers:
- Execute failure with partial state
- Validation failures post-migration
- Tenant-reported critical issues

**Wizard rollback:**

```bash
POST /api/v3/migration-wizard/rollback
```

**Backup restore:**

```bash
POST /api/v3/backup/restore
```

| # | Verify | ✓ |
|---|--------|---|
| 9.1 | Rollback completes | ☐ |
| 9.2 | Tenant returned to pre-migration state | ☐ |
| 9.3 | Incident documented | ☐ |

---

## Timeline Template

| Time | Phase | Duration |
|------|-------|----------|
| T-24h | Backup + Test Lab on clone | 1h |
| T-1h | Discovery + validate + preview | 30m |
| T-0 | Backup + execute migration | 15–60m |
| T+30m | Validation + sign-off | 30m |
| T+1d | Optional runtime sync canary | separate window |

---

## Related

- `02_UAT_CHECKLIST.md`
- `03_RUNTIME_SYNC_CANARY.md`
- `docs/V3/MigrationWizard.md`
