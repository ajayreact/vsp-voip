# RC1 UAT Checklist

**Release:** v3.0.0-rc1  
**Environment:** Staging (recommended) or production pilot tenant  
**Tester:** ________________  
**Date:** ________________  
**Build SHA:** ________________

**Legend:** PASS · FAIL · NOT TESTED

---

## 1. Login

| # | Test | Result | Comments |
|---|------|--------|----------|
| 1.1 | Tenant admin can log in at `app.vspphone.com` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 1.2 | V3 navigation visible when flag enabled | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 1.3 | Super admin can access super-admin pages | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 1.4 | Non-admin user blocked from admin V3 pages | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 1.5 | JWT session persists across page navigation | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 2. Employee Creation

| # | Test | Result | Comments |
|---|------|--------|----------|
| 2.1 | Create employee via `/v3/employees` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 2.2 | Employee appears in list | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 2.3 | Extension linked to employee | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 2.4 | Audit log entry created | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 2.5 | Duplicate email handled gracefully | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 3. Extension Creation

| # | Test | Result | Comments |
|---|------|--------|----------|
| 3.1 | Extension provisioned with employee | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 3.2 | Extension visible in health center | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 3.3 | Extension dialable via legacy softphone (if applicable) | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 3.4 | Extension repair inspect runs without error | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 4. Number Assignment

| # | Test | Result | Comments |
|---|------|--------|----------|
| 4.1 | Number inventory loads at `/v3/numbers` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 4.2 | Assign DID to extension/user | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 4.3 | Unassign DID | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 4.4 | Assignment history accurate | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 4.5 | Numbers health shows green/yellow correctly | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 5. Desk Phone Provisioning

| # | Test | Result | Comments |
|---|------|--------|----------|
| 5.1 | Register device at `/v3/devices` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 5.2 | Device template applied | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 5.3 | Provision via `/v3/device-provision` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 5.4 | Config URL/generate config succeeds | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 5.5 | Device health reflects provisioned state | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 6. Call Flow Builder

| # | Test | Result | Comments |
|---|------|--------|----------|
| 6.1 | List call flows at `/v3/callflows` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 6.2 | Create flow in builder | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 6.3 | Validate flow (no errors) | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 6.4 | Simulator runs without crash | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 6.5 | Edit and save existing flow | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 7. PBX Objects

| # | Test | Result | Comments |
|---|------|--------|----------|
| 7.1 | Create ring group `/v3/ring-groups` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 7.2 | Create queue `/v3/queues` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 7.3 | Business hours `/v3/business-hours` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 7.4 | Holiday `/v3/holidays` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 7.5 | Voicemail box `/v3/voicemail` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 7.6 | Validate each object type | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 8. Health Center

| # | Test | Result | Comments |
|---|------|--------|----------|
| 8.1 | `/v3/health` loads aggregated health | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 8.2 | Employee health drill-down works | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 8.3 | PBX objects health section populated | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 8.4 | Softphone UX health section populated | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 8.5 | Repair inspect returns actionable report | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 9. Runtime

| # | Test | Result | Comments |
|---|------|--------|----------|
| 9.1 | `/v3/runtime` shows sync disabled (RC1 default) | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 9.2 | Runtime validation page loads | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 9.3 | If canary enabled: jobs enqueue | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 9.4 | If canary enabled: runtime health green | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 9.5 | Runtime repair (canary only) | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 10. Dashboard

| # | Test | Result | Comments |
|---|------|--------|----------|
| 10.1 | `/v3/dashboard` loads without error | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 10.2 | Summary metrics display | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 10.3 | Charts render | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 10.4 | Dashboard stable under refresh (no race errors) | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 10.5 | Analytics `/v3/analytics` accessible | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 11. Billing

| # | Test | Result | Comments |
|---|------|--------|----------|
| 11.1 | `/v3/billing` loads | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 11.2 | Subscription view `/v3/subscription` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 11.3 | License view `/v3/license` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 11.4 | Subscription PUT blocked for non-super-admin | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 11.5 | Lifecycle page `/v3/lifecycle` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 12. Migration Wizard

| # | Test | Result | Comments |
|---|------|--------|----------|
| 12.1 | Super admin can access `/v3/migration-wizard` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 12.2 | Non-super-admin blocked | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 12.3 | Discovery step returns inventory | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 12.4 | Validate step passes on clean tenant | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 12.5 | Preview shows diff | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 12.6 | Run + rollback tested on staging clone | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 13. Backup

| # | Test | Result | Comments |
|---|------|--------|----------|
| 13.1 | Create backup at `/v3/backups` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 13.2 | Backup appears in list with timestamp | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 13.3 | Export JSON at `/v3/import-export` | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 13.4 | Backup size reasonable | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## 14. Restore

| # | Test | Result | Comments |
|---|------|--------|----------|
| 14.1 | Restore preview runs without error | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 14.2 | Restore to same tenant succeeds | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 14.3 | Cross-tenant restore rejected (`TENANT_MISMATCH`) | ☐ PASS ☐ FAIL ☐ NOT TESTED | |
| 14.4 | Health center green after restore | ☐ PASS ☐ FAIL ☐ NOT TESTED | |

---

## UAT Summary

| Metric | Count |
|--------|-------|
| Total tests | 58 |
| PASS | _____ |
| FAIL | _____ |
| NOT TESTED | _____ |

**UAT Sign-off:** ☐ APPROVED ☐ REJECTED  
**Signed:** ________________ **Date:** ________________

---

## Related

- `05_TENANT_MIGRATION_PLAYBOOK.md`
- `docs/V3/TestLab.md`
