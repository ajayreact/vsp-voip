# Tenant Portal V3 — Administrator Guide

**Version:** v3.0.0-rc1

---

## Roles

| Role | Portal access |
|------|---------------|
| `TENANT_USER` | Limited read (profile, presence, directory) |
| `TENANT_ADMIN` | Full tenant configuration and ops |
| `SUPER_ADMIN` | All tenants + Test Lab, Migration Wizard, marketplace admin |

---

## Getting Started

1. Confirm V3 is enabled (`V3_PORTAL_ENABLED`, `NEXT_PUBLIC_V3_PORTAL`)
2. Log in at `https://app.vspphone.com`
3. Open **V3** section from portal navigation
4. Start at **Dashboard** (`/v3/dashboard`) for health summary

---

## Common Tasks

### Manage employees

- **Route:** `/v3/employees`
- Add users, assign extensions, link to PBX

### Number inventory

- **Route:** `/v3/numbers`, `/v3/assignments`, `/v3/marketplace`
- Sync from Telnyx, assign DIDs, marketplace purchases (super-admin for marketplace admin)

### Desk phones

- **Route:** `/v3/devices`, `/v3/device-provision`
- Register devices, apply templates, run provisioning

### Call flows & PBX

- **Routes:** `/v3/callflows`, `/v3/ring-groups`, `/v3/queues`, `/v3/business-hours`, `/v3/holidays`, `/v3/voicemail`
- Configure routing logic (live routing requires runtime sync — off by default in RC1)

### Softphone UX

- **Routes:** `/v3/profile`, `/v3/preferences`, `/v3/presence`, `/v3/directory`
- User-facing preferences managed by admins

### Operations

- **Routes:** `/v3/analytics`, `/v3/reports`, `/v3/monitoring`, `/v3/activity`, `/v3/notifications`
- Read-only dashboards and alerts

### Billing & lifecycle

- **Routes:** `/v3/billing`, `/v3/subscription`, `/v3/license`, `/v3/lifecycle`
- Subscription changes: **super-admin only** (RC1 audit)

### Backups

- **Routes:** `/v3/backups`, `/v3/import-export`
- Schedule exports before major changes

---

## Super Admin Only

### Test Lab

- **Route:** `/v3/test-lab`
- Requires `V3_TEST_LAB_ENABLED=true` on API
- Run automated staging validation suite

### Migration Wizard

- **Route:** `/v3/migration-wizard`
- Legacy → V3 tenant orchestration (6 steps)

### Production health

- **Route:** `/v3/production-health`, `/v3/diagnostics`, `/v3/system-health`

---

## Safety Practices

1. **Never** enable `V3_TEST_LAB_ALLOW_PRODUCTION` on production long-term
2. Keep `V3_RUNTIME_SYNC_ENABLED=false` until canary validated
3. Run Test Lab before Migration Wizard execute step
4. Take backup before migration or restore
5. Use super-admin accounts only for cross-tenant operations

---

## Navigation Reference

Defined in `web/src/lib/portal-nav.ts` — items filtered by role and feature flags.

---

## Related

- [API.md](./API.md)
- [Troubleshooting.md](./Troubleshooting.md)
- [Migration.md](./Migration.md)
