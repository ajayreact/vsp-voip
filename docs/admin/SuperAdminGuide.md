# Super Admin Guide — Tenant Portal V3

**Version:** 3.0.0 | **Role:** `SUPER_ADMIN`

---

## Overview

Super admins manage cross-tenant operations: marketplace, migration wizard, test lab, and global number inventory.

![Screenshot placeholder: Super admin V3 navigation](/docs/admin/screenshots/super-admin-nav.png)

---

## Permissions

| Feature | Super Admin | Tenant Admin |
|---------|:-----------:|:------------:|
| V3 dashboard | ✅ | ✅ |
| Marketplace purchase | ✅ | ❌ |
| Migration Wizard | ✅ | ❌ |
| Test Lab | ✅ | ❌ |
| Subscription PUT | ✅ | ❌ |
| Global number inventory | ✅ | ❌ |
| Tenant migration run | ✅ | ✅ (own tenant) |

---

## Workflows

### Marketplace Number Purchase

1. Navigate to `/v3/marketplace`
2. Search by country/area code
3. Purchase or reserve number
4. Assign to tenant via `/v3/assignments`

### Migration Wizard

1. `/v3/migration-wizard`
2. Discovery → Validate → Preview → Backup → Run
3. See `MigrationGuide.md`

### Test Lab

1. Enable `V3_TEST_LAB_ENABLED` on staging
2. `/v3/test-lab` → Run suite
3. Review run ID and failures

---

## Best Practices

- Never leave `V3_TEST_LAB_ALLOW_PRODUCTION=true` on production
- Always preview migration before run
- Use separate super-admin accounts (not shared)
- Audit marketplace purchases weekly

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Migration wizard 403 | Confirm SUPER_ADMIN role |
| Test lab disabled | Set `V3_TEST_LAB_ENABLED=true` |
| Marketplace 429 | Wait for rate limit reset |

---

## Related

- `TenantAdminGuide.md`
- `MigrationGuide.md`
- `docs/release/05_TENANT_MIGRATION_PLAYBOOK.md`
