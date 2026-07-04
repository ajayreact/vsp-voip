# Tenant Portal V3 — Desk Phones

**RC1:** v3.0.0-rc1

## Purpose

Phase 3 desk phone management: register devices, apply templates, auto-provision, monitor health, repair.

## Services

- `lib/v3/deviceService.js`
- `lib/v3/deviceTemplateService.js`
- `lib/v3/deviceProvisioningService.js`
- `lib/v3/deviceHealthService.js`
- `lib/v3/deviceRepairService.js`
- `lib/v3/provisioningService.js`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v3/devices` | List devices |
| POST | `/api/v3/devices` | Create device |
| GET | `/api/v3/devices/:id/config` | Provisioning config |
| PUT | `/api/v3/devices/:id` | Update device |
| DELETE | `/api/v3/devices/:id` | Remove device |
| GET | `/api/v3/devices/vendors` | Supported vendors |
| POST | `/api/v3/devices/provision` | Provision device |
| POST | `/api/v3/devices/repair` | Repair device |
| GET | `/api/v3/devices/health` | Device health summary |
| POST | `/api/v3/employees/:id/provision-device` | Provision for employee |

## UI

- `/v3/devices` — device list
- `/v3/device-provision` — provisioning wizard
- `/v3/device-health` — health dashboard

## Model

`V3DeskDevice` — linked to tenant, extension, template, provisioning state.

## Deployment

No runtime sync required for configuration storage. Live desk registration requires runtime sync + telephony worker (post-RC1).

## Rollback

Delete device records via API. Restore from backup for bulk rollback.

## Operations

Run device health before provisioning batches. Repair inspect before apply on production tenants.
