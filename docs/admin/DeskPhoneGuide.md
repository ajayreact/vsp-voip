# Desk Phone Guide — Administrator

**Version:** 3.0.0

![Screenshot placeholder: Device list](/docs/admin/screenshots/desk-phones.png)

---

## Overview

Manage desk phone registration, templates, provisioning, and health.

**Routes:** `/v3/devices`, `/v3/device-provision`, `/v3/device-health`

---

## Workflow — Provision New Phone

1. Register device (`POST /api/v3/devices`)
2. Assign to employee/extension
3. Run provision (`POST /api/v3/devices/provision`)
4. Provide config URL to phone
5. Verify registration in device health

---

## Supported Operations

| Action | API |
|--------|-----|
| List devices | `GET /devices` |
| Create | `POST /devices` |
| Get config | `GET /devices/:id/config` |
| Update | `PUT /devices/:id` |
| Remove | `DELETE /devices/:id` |
| Repair | `POST /devices/repair` |

---

## Model

`V3DeskDevice` — status: CREATED → ASSIGNED → PROVISIONED → REGISTERED

---

## Best Practices

- Record MAC addresses accurately
- Use device templates for consistent config
- Re-provision after extension changes
- Live registration requires runtime sync (post-canary)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Phone won't register | Check config URL, firewall, Telnyx SIP |
| Stuck in PROVISIONED | Verify extension assignment |
| Config 404 | Re-run provision with regenerate |

---

## Related

- `docs/V3/DeskPhones.md`
- `TenantAdminGuide.md`
