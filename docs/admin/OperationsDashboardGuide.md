# Operations Dashboard Guide

**Version:** 3.0.0

![Screenshot placeholder: Operations dashboard](/docs/admin/screenshots/operations-dashboard.png)

---

## Overview

Operations dashboards provide real-time visibility into tenant health, metrics, runtime jobs, and production readiness.

---

## Monitoring

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/v3/dashboard` | Summary KPIs |
| Monitoring | `/v3/monitoring` | Live ops feed |
| Activity | `/v3/activity` | Audit-style activity log |
| Notifications | `/v3/notifications` | Alert center |

**API:** `GET /api/v3/dashboard`, `/monitoring`, `/activity`, `/notifications`

---

## Alerts

Configure organizational alerting on:

- `/ready` false
- `/api/v3/*` 5xx rate > 0.1%
- Migration run FAILED status
- Runtime job DEAD_LETTER

---

## Metrics

| Page | Route | API |
|------|-------|-----|
| Metrics | `/v3/metrics` | `GET /api/v3/metrics` |
| Analytics | `/v3/analytics` | `GET /api/v3/analytics` |
| Reports | `/v3/reports` | `GET /api/v3/reports` |

Export: `POST /api/v3/reports/export`

---

## Health Scores

| Source | Interpretation |
|--------|----------------|
| `/v3/health` | Tenant readiness aggregate |
| `/v3/system-health` | Platform-level |
| `/v3/production-health` | GA readiness indicators |
| `/v3/diagnostics` | Deep diagnostic bundle |

See `HealthCenterGuide.md`

---

## Runtime Jobs

| Page | Route |
|------|-------|
| Runtime overview | `/v3/runtime` |
| Job list | `/v3/runtime/jobs` |
| Runtime health | `/v3/runtime/health` |
| Validation | `/v3/runtime-validation` |

Monitor job states: PENDING → RUNNING → SUCCESS / FAILED

---

## Diagnostics

`/v3/diagnostics` — API: `GET /api/v3/diagnostics`

Use for support escalations. Include output in incident tickets.

---

## Repair PBX

From health center or API — see `RepairPBXGuide.md`

Quick: `POST /api/v3/repair/inspect`

---

## Migration Wizard

Super-admin: `/v3/migration-wizard`  
See `MigrationGuide.md`

---

## Test Lab

Super-admin staging: `/v3/test-lab`  
Requires `V3_TEST_LAB_ENABLED=true`

| API | Purpose |
|-----|---------|
| `GET /test-lab/status` | Enabled state |
| `POST /test-lab/run` | Execute suite |
| `GET /test-lab/runs/:id` | Run detail |

---

## Daily Ops Checklist

1. `/ready` + git SHA
2. `/v3/production-health`
3. Review migration runs (if active rollout)
4. Check runtime jobs (if sync enabled)
5. PM2 + Docker status

Full schedule: `docs/release/10_OPERATIONS_RUNBOOK.md`

---

## Related

- `docs/release/10_OPERATIONS_RUNBOOK.md`
- `HealthCenterGuide.md`
