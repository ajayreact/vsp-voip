# Health Center Guide — Administrator

**Version:** 3.0.0

![Screenshot placeholder: Health center overview](/docs/admin/screenshots/health-center.png)

---

## Overview

The Health Center aggregates tenant readiness across employees, PBX objects, numbers, devices, and softphone UX.

**Routes:** `/v3/health`, `/v3/system-health`, `/v3/production-health`, `/v3/device-health`

---

## Health Sections

| Section | Indicates |
|---------|-----------|
| Employees | Extension linkage, provisioning gaps |
| PBX objects | Ring groups, queues, hours config |
| Numbers | DID assignment, Telnyx sync |
| Devices | Desk phone registration status |
| Softphone UX | Profile completeness, presence |
| System | Infrastructure readiness |

---

## Workflow — Daily Triage

1. Open `/v3/health`
2. Review summary readiness score
3. Drill into yellow/red items
4. Run repair inspect if needed (`RepairPBXGuide.md`)

---

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v3/health` | Combined health |
| `GET /api/v3/health/:employeeId` | Per-employee |
| `GET /api/v3/numbers/health` | Number inventory |
| `GET /api/v3/devices/health` | Device health |

---

## Best Practices

- Check health before migrations
- Re-check after any repair apply
- Use production-health before go-live

---

## Troubleshooting

| Symptom | Action |
|---------|--------|
| All red after migration | Run migration report; repair inspect |
| Softphone gaps | Expected if profiles not created — read-only check |
| Stale data | Hard refresh; verify API SHA |

---

## Related

- `RepairPBXGuide.md`
- `docs/V3/HealthCenter.md`
