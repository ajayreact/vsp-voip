# Marketplace Guide — Super Admin

**Version:** 3.0.0 | **Role:** `SUPER_ADMIN` only

![Screenshot placeholder: Marketplace search](/docs/admin/screenshots/marketplace.png)

---

## Overview

Search, purchase, reserve, and release Telnyx DIDs. Assign to tenants or extensions.

**Route:** `/v3/marketplace` (UI guard: `runV3SuperAdminGuard`)

---

## Workflow

1. **Search** — `POST /api/v3/numbers/search`
2. **Purchase** — `POST /api/v3/numbers/purchase`
3. **Assign to tenant** — super-admin `{ tenantId }` on assign
4. **Assign to extension** — tenant admin assign flow
5. **Release** — `POST /api/v3/numbers/release` when decommissioning

---

## API Summary

| Method | Path | Rate limit |
|--------|------|------------|
| POST | `/numbers/search` | searchLimiter |
| POST | `/numbers/purchase` | billingLimiter |
| POST | `/numbers/release` | — |
| POST | `/numbers/assign` | — |

---

## Audit Trail

All purchase and release operations logged via `auditService`.

---

## Best Practices

- Verify Telnyx account balance before bulk purchase
- Reserve numbers before final purchase if approval needed
- Document assignment in tenant notes
- Never purchase on production without change control

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Search empty | Check area code / country |
| Purchase failed | Telnyx API key, billing, rate limit |
| 403 | Not super-admin |

---

## Related

- `SuperAdminGuide.md`
- `docs/V3/Marketplace.md`
