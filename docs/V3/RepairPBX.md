# Tenant Portal V3 — Repair PBX

**RC1:** v3.0.0-rc1

## Purpose

Phase 1 PBX repair tools inspect and fix tenant configuration inconsistencies (extensions, links, provisioning gaps) without touching live Call Control routing.

## Services

- `lib/v3/repairService.js` — tenant-wide inspect/apply
- `lib/v3/deviceRepairService.js` — desk device repair
- Number repair via `/api/v3/numbers/repair`
- Runtime repair via `/api/v3/runtime/repair`

## API

| Method | Path | Role | Rate limit |
|--------|------|------|------------|
| POST | `/api/v3/repair/inspect` | Admin | v3RepairLimiter |
| POST | `/api/v3/repair/apply` | Admin | v3RepairLimiter |
| POST | `/api/v3/numbers/repair` | Admin | v3RepairLimiter |
| POST | `/api/v3/devices/repair` | Admin | v3RepairLimiter |
| POST | `/api/v3/runtime/repair` | Admin | v3RepairLimiter |

## UI

- `/v3/health` — health summary with readiness indicators
- Repair actions triggered from health/repair flows in portal

## Audit

All apply operations log via `auditService` (`v3.pbx.repair`, etc.).

## Operations

1. Run **inspect** first; review report
2. Apply only during maintenance window if mutations required
3. Re-run health check after apply
4. Do not run repair on production during active calls without ops approval

## Rollback

Repair mutations are data changes — use backup restore if incorrect apply. Inspect is read-only.

## Deployment

No special flags beyond `V3_PORTAL_ENABLED`.
