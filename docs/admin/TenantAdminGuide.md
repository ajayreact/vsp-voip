# Tenant Admin Guide — Tenant Portal V3

**Version:** 3.0.0 | **Role:** `TENANT_ADMIN`

---

## Overview

Tenant admins manage their organization's PBX configuration, employees, numbers, devices, and operations dashboard.

![Screenshot placeholder: Tenant admin dashboard](/docs/admin/screenshots/tenant-dashboard.png)

---

## Daily Tasks

| Task | Route |
|------|-------|
| Check health | `/v3/health` |
| Review dashboard | `/v3/dashboard` |
| Manage employees | `/v3/employees` |
| Assign numbers | `/v3/numbers`, `/v3/assignments` |

---

## Permissions

Tenant admins can manage all tenant-scoped V3 features except super-admin-only routes (marketplace purchase, migration wizard, test lab, subscription PUT).

---

## Workflows

### Add Employee

1. `/v3/employees` → Create
2. Provision extension
3. Optional: provision desk phone

### Configure Ring Group

1. `/v3/ring-groups` → Create
2. Add members, set strategy
3. Validate before save

---

## Best Practices

- Run health center before and after changes
- Backup before bulk changes (`/v3/backups`)
- Use call flow simulator before publishing flows
- Do not enable runtime sync without ops approval

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 403 on V3 pages | Confirm tenant linked to account |
| Empty dashboard | Complete migration or add employees |
| Health warnings | Run repair inspect |

---

## Related

- `HealthCenterGuide.md`
- `CallFlowGuide.md`
