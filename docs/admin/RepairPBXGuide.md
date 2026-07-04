# Repair PBX Guide — Administrator

**Version:** 3.0.0

![Screenshot placeholder: Repair inspect results](/docs/admin/screenshots/repair-pbx.png)

---

## Overview

PBX repair tools inspect and fix configuration inconsistencies without modifying live Call Control routing.

---

## Tools

| Tool | Route / API | Scope |
|------|-------------|-------|
| Tenant repair | `POST /api/v3/repair/inspect` | Whole tenant |
| Number repair | `POST /api/v3/numbers/repair` | DID inventory |
| Device repair | `POST /api/v3/devices/repair` | Desk phones |
| Runtime repair | `POST /api/v3/runtime/repair` | Runtime links |

---

## Workflow

1. **Inspect** — always run first (read-only)
2. Review report with tenant admin
3. **Apply** — only during maintenance window
4. Re-run health center

```bash
POST /api/v3/repair/inspect   # no mutations
POST /api/v3/repair/apply     # applies fixes
```

---

## Permissions

- `TENANT_ADMIN` — own tenant
- `SUPER_ADMIN` — may run global number repair

---

## Best Practices

- Never apply without reviewing inspect output
- Audit log records all apply operations
- Rate limited — do not spam repair endpoints

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| 429 rate limit | Wait and retry |
| Apply made things worse | Restore from backup |
| Runtime repair no effect | Sync may be disabled |

---

## Related

- `HealthCenterGuide.md`
- `docs/V3/RepairPBX.md`
