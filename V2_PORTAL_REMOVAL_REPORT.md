# Tenant Portal V2 Removal Report

**Branch:** `feature/remove-v2-portal`  
**Date:** 2026-07-03  
**Status:** Build passed · V3 tests 130/130 passed · Full suite 966/969 passed (3 pre-existing env/auth failures)

## Summary

Tenant Portal V2 has been retired. V3 is now the only supported tenant portal. All former `/v3/*` routes are promoted to root paths (e.g. `/dashboard`, `/employees`). Legacy V2 UI, navigation, and feature flags have been removed. Telephony runtime, softphone, and admin console were not modified.

---

## Files Removed

### V2 tenant portal pages (42 routes)

| Path | Notes |
|------|-------|
| `/assistant` | No V3 equivalent — redirects to `/dashboard` |
| `/calls` | Redirects to `/activity` |
| `/cart`, `/cart/success`, `/cart/order-placed` | Redirect to `/marketplace` |
| `/extensions` | Redirects to `/employees` |
| `/greeting` | Redirects to `/callflows` |
| `/my-numbers`, `/phone-numbers` | Redirect to `/numbers` |
| `/phone-system/**` | Redirect to canonical routes |
| `/recordings` | Redirects to `/reports` |
| `/settings/**` | Redirect to `/profile` |
| `/sms` | Redirects to `/notifications` |
| `/ring-groups/new`, `/ring-groups/[id]` | V2 detail UX removed; list uses V3 PbxManager |

### V3 prefix directory (46 pages under `web/src/app/(app)/v3/`)

Entire tree removed after promotion to root paths.

### V2 portal components (`web/src/components/portal/`)

- `assistant-page.tsx`
- `billing-manager.tsx`
- `calls-manager.tsx`
- `devices-manager.tsx`
- `extensions-manager.tsx`
- `phone-numbers-manager.tsx`
- `recordings-manager.tsx`
- `reset-pbx-configuration-panel.tsx`
- `ring-group-create.tsx`
- `ring-group-detail.tsx`
- `ring-groups-manager.tsx`
- `settings-hub.tsx`
- `voicemail-manager.tsx`

**Kept:** `page-header.tsx` (shared by V3 pages)

### Extension UI cluster (V2-only)

- `extension-analytics-panel.tsx`
- `extension-business-panel.tsx`
- `extension-detail-drawer-shell.tsx`
- `extension-detail-drawer.tsx`
- `extension-form-panel.tsx`
- `extension-ownership-panel.tsx`
- `extension-primary-did-select.tsx`
- `extension-qr-panel.tsx`
- `extension-security-panel.tsx`
- `extension-sip-panel.tsx`

### Other removed files

- `web/src/context/cart-context.tsx`
- `web/src/lib/portal-dashboard.ts`
- `web/src/lib/businessHoursDefaults.ts`
- `web/src/components/phone-system-nav.tsx`

---

## Files Updated

| File | Change |
|------|--------|
| `web/src/lib/portal-nav.ts` | V3-only navigation at root paths; removed V2 sections and `NEXT_PUBLIC_V3_PORTAL` gate |
| `web/src/lib/v3-api.ts` | `isV3PortalEnabled()` always returns `true` |
| `lib/v3/featureFlag.js` | `requireV3Enabled` is no-op; portal always enabled |
| `web/src/components/v3/ops/ops-ui.tsx` | Removed flag checks from admin/super-admin guards |
| `web/src/components/sidebar.tsx` | Removed cart context dependency |
| `web/src/app/(app)/layout.tsx` | Removed `CartProvider` |
| `web/next.config.js` | Added `/v3/*` → `/*` and legacy route redirects |
| `deploy/deploy-web.sh` | Removed `NEXT_PUBLIC_V3_PORTAL` build flag |
| `deploy/staging-v3-portal.sh` | Updated for V3-as-default deploy |
| `tests/browser/portal-navigation.spec.ts` | Updated for V3 root routes |

### Promoted pages (new root routes, formerly under `/v3/`)

`activity`, `analytics`, `assignments`, `backups`, `business-hours`, `callflows` (+ builder, simulator), `device-health`, `device-provision`, `diagnostics`, `directory`, `health`, `holidays`, `import-export`, `license`, `lifecycle`, `marketplace`, `metrics`, `migration`, `migration-wizard`, `monitoring`, `notifications`, `preferences`, `presence`, `production-health`, `profile`, `queues`, `runtime` (+ health, jobs), `runtime-validation`, `subscription`, `system-health`, `test-lab`

### Overwritten V2 pages with V3 implementation

`dashboard`, `employees`, `devices`, `numbers`, `ring-groups`, `voicemail`, `reports`, `billing`

---

## Routes Migrated

| Former V3 route | New canonical route |
|-----------------|---------------------|
| `/v3/dashboard` | `/dashboard` |
| `/v3/employees` | `/employees` |
| `/v3/numbers` | `/numbers` |
| `/v3/devices` | `/devices` |
| `/v3/ring-groups` | `/ring-groups` |
| `/v3/callflows` | `/callflows` |
| `/v3/voicemail` | `/voicemail` |
| `/v3/reports` | `/reports` |
| `/v3/billing` | `/billing` |
| `/v3/profile` | `/profile` |
| `/v3/marketplace` | `/marketplace` |
| *(all other `/v3/*`)* | `/*` (same path without prefix) |

### Legacy redirects (next.config.js)

| Source | Destination |
|--------|-------------|
| `/v3/:path*` | `/:path*` |
| `/phone-numbers`, `/my-numbers` | `/numbers` |
| `/extensions`, `/settings/team` | `/employees` |
| `/settings`, `/settings/profile` | `/profile` |
| `/cart`, `/cart/:path*` | `/marketplace` |
| `/calls` | `/activity` |
| `/recordings` | `/reports` |
| `/sms` | `/notifications` |
| `/assistant` | `/dashboard` |
| `/greeting` | `/callflows` |

---

## APIs Removed

**None.** All `/api/v3/*` endpoints remain mounted and active. Legacy `/api/*` routes used by softphone and telephony (`/api/softphone/*`, `/api/tenant/extensions/*`, etc.) are preserved.

---

## Feature Flags Removed / Changed

| Flag | Before | After |
|------|--------|-------|
| `NEXT_PUBLIC_V3_PORTAL` | Gated V3 nav and pages | **Removed** from deploy; no longer required |
| `V3_PORTAL_ENABLED` | 404 on `/api/v3/*` when off | **Always enabled** (no-op middleware) |
| `isV3PortalEnabled()` (web) | Build-time gate | Always `true` |
| `isV3PortalNavEnabled()` | Conditional nav section | **Removed** |

**Unchanged:** `NEXT_PUBLIC_BROWSER_CALLING_ENABLED`, `NEXT_PUBLIC_SOFTPHONE_V2_ENABLED`, `V3_RUNTIME_SYNC_ENABLED`, `V3_TEST_LAB_ENABLED`

---

## Components & Services Removed

See **Files Removed** above. No `lib/v3/*` backend services were deleted.

---

## Protected Components — Not Modified

- `lib/inboundCallControl.js`
- `lib/telnyxCallControl.js`
- `lib/callControlSessionStore.js`
- `web/src/lib/webrtc-audio.ts`
- `web/src/lib/telnyx-softphone-session.ts`
- `web/src/app/(app)/softphone-v2/page.tsx`

---

## Validation Results

| Check | Result |
|-------|--------|
| `npm run build` (web) | **PASSED** — 89 routes |
| TypeScript (via Next build) | **PASSED** |
| ESLint | 48 issues (14 errors — pre-existing in admin/softphone; not introduced by this change) |
| `npm test` (full) | **966 passed**, 3 failed (pre-existing: `/api/auth/me` tenantId in local env) |
| `npm test -- tests/v3` | **130/130 passed** |

---

## Remaining Legacy Code

| Item | Reason kept |
|------|-------------|
| `web/src/components/portal/page-header.tsx` | Shared header for all V3 pages |
| `web/src/components/v3/**` | Active V3 UI components |
| `web/src/lib/api.ts` | Auth, softphone, admin APIs |
| `routes/portal.js`, `routes/extensions.js` | Telephony + softphone backend |
| `web/src/components/messaging/**`, `web/src/components/ai/**` | Used by softphone / future features |
| `isV3PortalEnabled()` stub | Backward-compatible export (always true) |
| `/api/v3` mount path | API path unchanged; only UI routes de-prefixed |

### V2 features without direct V3 UI (removed from nav; soft redirects)

- Call history inbox (`/calls`) → `/activity`
- Recordings browser (`/recordings`) → `/reports`
- SMS inbox (`/sms`) → `/notifications`
- Enterprise Assistant (`/assistant`) → `/dashboard`
- IVR/greeting editor (`/greeting`) → `/callflows`
- Deep extension drawer UX → use `/employees` + `/device-provision`

APIs for calls, recordings, SMS, and assistant remain available for softphone and future portal pages.

---

## Migration Scripts (for reference)

- `scripts/remove-v2-portal-migrate.js` — initial route promotion
- `scripts/remove-v2-portal-cleanup.js` — guard cleanup
- `scripts/remove-v2-portal-final.js` — artifact removal and path fixes
- `V2_PORTAL_REMOVAL_MIGRATION.json` — machine-readable route map

---

## Deploy Notes

1. No `NEXT_PUBLIC_V3_PORTAL` or `V3_PORTAL_ENABLED` required
2. Rebuild web: `bash deploy/deploy-web.sh`
3. Restart API (feature flag change is code-level): `bash deploy/deploy-api.sh`
4. Bookmarks to `/v3/*` redirect automatically
