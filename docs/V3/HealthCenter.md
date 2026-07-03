# Tenant Portal V3 — Health Center

**RC1:** v3.0.0-rc1

## Purpose

Aggregated health views across employees, PBX objects, softphone UX, devices, numbers, and system status.

## Services

- `lib/v3/healthCheckService.js`
- `lib/v3/pbxHealthService.js`
- `lib/v3/softphoneHealthService.js`
- `lib/v3/inventoryHealthService.js`
- `lib/v3/deviceHealthService.js`
- `lib/v3/systemHealthService.js`
- `lib/v3/productionHealthService.js`
- `lib/v3/lifecycleHealthService.js`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v3/health` | Combined tenant health |
| GET | `/api/v3/health/:employeeId` | Employee health |
| GET | `/api/v3/numbers/health` | Number inventory health |
| GET | `/api/v3/devices/health` | Device health |
| GET | `/api/v3/system-health` | System-wide health |
| GET | `/api/v3/production-health` | Production readiness |
| GET | `/api/v3/diagnostics` | Diagnostics bundle |

## UI

- `/v3/health` — primary health center
- `/v3/device-health` — device-specific
- `/v3/system-health` — system view
- `/v3/production-health` — production readiness
- `/v3/diagnostics` — deep diagnostics
- `/v3/dashboard` — summary metrics

## RC1 Audit

Softphone health uses read-only profiles (`getProfileReadOnly`). TENANT_USER scope enforced.

## Deployment

Read-only endpoints — safe to enable with portal flag.

## Operations

Use `/v3/health` as first-line triage. Cross-check with Test Lab automated runs on staging.

## Rollback

N/A — read-only. Repair via `/v3/repair` flows documented in `RepairPBX.md`.
