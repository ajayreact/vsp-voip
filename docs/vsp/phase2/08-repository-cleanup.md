# Phase 2.8 — Repository Cleanup

**Status:** Complete  
**Scope:** Remove deprecated Flutter client and unreferenced artifacts. **No telephony backend changes.**

---

## Removed

| Category | Items |
|----------|--------|
| Flutter app | Entire `mobile/` directory (~230 files) |
| Build scripts | `scripts/build-mobile-android.ps1`, `scripts/build-mobile-ios.sh` |
| Dead code | `lib/inboundRoutingAuditLog.js` (zero imports) |

---

## Retained (intentionally)

| Item | Reason |
|------|--------|
| `web/src/app/(app)/softphone*` | Gated admin rollback path (`NEXT_PUBLIC_BROWSER_CALLING_ENABLED`) |
| `web/src/lib/telephony/*` | Still imported by gated softphone pages |
| `lib/callRouting.js` | Active TeXML webhook path in `server.js` |
| `POST /api/softphone/internal-call` | Used by mobile-rn API client + tests |
| `mobile-rn/src/sip/qrProvisioning.ts` | Legacy `vsp-sip-provision` QR support in settings |
| `docs/telnyx/javascript-sdk/flutter/*` | External Telnyx reference docs (not app code) |

---

## Migrated references

| From | To |
|------|-----|
| `scripts/validate-phase3b-sprint2.js` | Validates `mobile-rn/` + backend APIs |
| `scripts/validate-phase3b-sprint21.js` | Validates `mobile-rn/` native plugins |
| `scripts/validate-pbx-production.ts` | Extension dial check uses `mobile-rn/src/calling/dialNormalization.ts` |
| `package.json` build scripts | EAS build instructions for `mobile-rn` |
| `deploy/nginx/vspphone.conf` | APK alias → `mobile-rn/dist/apk/` |

---

## Standard mobile client

**`mobile-rn/`** (React Native / Expo) is the only supported mobile application.

Deprecated: ~~`mobile/`~~ (Flutter) — removed.
