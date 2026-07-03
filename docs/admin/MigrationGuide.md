# Migration Guide — Administrator

**Version:** 3.0.0

![Screenshot placeholder: Migration Wizard steps](/docs/admin/screenshots/migration-wizard.png)

---

## When to Migrate

- After RC1/GA deploy and UAT pass
- During scheduled maintenance window
- After staging clone validation

---

## Super Admin — Migration Wizard

| Step | Action | API |
|------|--------|-----|
| 1 Discovery | Inventory legacy vs V3 | `GET /migration-wizard/discovery` |
| 2 Validate | Pre-flight checks | `POST /migration-wizard/validate` |
| 3 Preview | Review diff | `POST /migration-wizard/preview` |
| 4 Backup | Create snapshot | `/v3/backups` |
| 5 Run | Execute | `POST /migration-wizard/run` |
| 6 Rollback | If needed | `POST /migration-wizard/rollback` |

---

## Tenant Admin — Phase 10 Migration

| Step | Route |
|------|-------|
| Preview | `/v3/migration` |
| Run | API `POST /migration/run` |
| Report | `GET /migration/report` |

---

## Pre-Migration Checklist

- [ ] Backup created
- [ ] Test Lab pass on clone
- [ ] Preview reviewed and signed off
- [ ] Maintenance window active
- [ ] Rollback contact available

---

## Post-Migration

1. `/v3/health` — all green
2. `/v3/dashboard` — metrics populated
3. Spot-check employees, numbers, devices
4. **Do not** enable runtime sync until canary approved

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| Auto-rollback triggered | Review wizard logs; fix validation errors |
| Partial migration | Run rollback; restore backup |
| Missing objects | Run repair inspect |

---

## Related

- `docs/release/05_TENANT_MIGRATION_PLAYBOOK.md`
- `SuperAdminGuide.md`
