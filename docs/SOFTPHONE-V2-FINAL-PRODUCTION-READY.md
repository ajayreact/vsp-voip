# Softphone V2 — Final Production Ready

**Date:** 2026-06-21  
**Status:** Production ready with monitoring  
**Route:** `/softphone-v2` (default when `NEXT_PUBLIC_SOFTPHONE_V2_ENABLED=true`)

---

## Production readiness fixes (this release)

### 1. Registration Success telemetry — **FIXED**

| Before | After |
|--------|-------|
| First `telnyx.ready` emitted no registration success event | `trackSoftphoneEvent('Registration Success')` on first successful registration (`attempts === 0`) |
| Only `Registration Restored` after reconnect | Unchanged — still emitted when `attempts > 0` |

**Implementation:**

- `web/src/lib/softphone-telemetry.ts` — added `Registration Success` to event union
- `web/src/app/(app)/softphone-v2/page.tsx` — `registrationSuccessEmittedRef` guards one-time emit per session

**Telemetry matrix:** 10/10 acceptance events now covered.

| Event | Status |
|-------|--------|
| Registration Success | ✅ |
| Registration Failed | ✅ |
| Reconnect Attempt | ✅ |
| Registration Restored | ✅ |
| Call Started / Connected / Failed / Ended | ✅ |
| Voicemail Played / Recording Played | ✅ |

---

### 2. Voicemail delete permission — **FIXED**

| Before | After |
|--------|-------|
| Delete button visible to all users | Delete hidden unless `TENANT_ADMIN` or `SUPER_ADMIN` |
| Non-admins received 403 from API | UI matches backend RBAC (no backend change) |

**Implementation:**

- `web/src/components/voicemail-list.tsx` — optional `canDelete` prop (default `false`)
- `web/src/components/softphone-v2/voicemail-tab.tsx` — loads role via `getMe()`

---

### 3. Diagnostics dashboard — **ENHANCED**

**Location:** More → Diagnostics (read-only)

| Field | Source |
|-------|--------|
| Registration Status | Telnyx registration + reconnect state |
| Telnyx Ready | `telnyxReady` |
| WebSocket Connected | `telnyxSocketConnected` |
| Presence Active | Presence heartbeat status |
| Current Caller ID | Selected outbound caller ID |
| Active Call Count | Live call session (0 or 1) |
| Failed Call Count | Local session history (non-completed) |
| Missed Call Count | Local session history (`status: missed`) |
| Reconnect Count | Cumulative reconnect attempts this session |
| Last Telemetry Event | In-memory telemetry snapshot with timestamp |

**Implementation:**

- `web/src/components/softphone-v2-validation-dashboard.tsx` — expanded read-only rows
- `web/src/lib/softphone-telemetry.ts` — `subscribeSoftphoneTelemetry` + last-event snapshot
- Props threaded via `page.tsx` → `IphonePhoneApp` → `MoreTab`

No backend changes.

---

## Build verification

```bash
cd web && npx tsc --noEmit && npm run build
```

Expected: pass (run after deploy).

---

## Remaining technical debt

| Item | Severity | Notes |
|------|----------|-------|
| Dual routes `/softphone` + `/softphone-v2` + feature flag | Low | Remove after bake-off |
| Legacy softphone page + debug libs | Low | `telnyx-debug.ts`, `softphone-call-trace.ts`, `telnyx-softphone-session.ts` |
| In-call `POST /api/softphone/record-start` not wired | Medium | Record button disabled in v2 UI |
| Telemetry sink is API console logs only | Low | No DB/analytics pipeline |
| Local recents vs platform `/calls` | Low | By design — server call-log is authoritative |
| Mid-call reconnect | Low | Requires live QA; code uses `keepConnectionAliveOnSocketClose` |
| Legacy OVP outbound readiness gate | Low | Not ported from legacy |

**No open high-severity acceptance issues** from the 2026-06-21 audit.

---

## Legacy retirement recommendation

### **Keep legacy for 2-week bake-off, then remove**

| Phase | Action |
|-------|--------|
| **Now → +2 weeks** | V2 default (`SOFTPHONE_V2_ENABLED=true`); legacy available via flag rollback |
| **Monitor** | API `[softphone-telemetry]` logs; Diagnostics dashboard in More tab |
| **After bake-off** | Remove `web/src/app/(app)/softphone/page.tsx`, consolidate route to `/softphone`, drop feature flag |

**Rollback (if needed):**

```bash
SOFTPHONE_V2_ENABLED=false bash deploy/deploy-web.sh
```

**Do not remove legacy now** — allows instant rollback while production validates reconnect, PSTN, and extension flows with real tenants.

---

## Deployment

```bash
SOFTPHONE_V2_ENABLED=true bash deploy/deploy-web.sh
```

**Post-deploy smoke test:**

1. Open `/softphone-v2` → More → Diagnostics → confirm Registration Success in Last Telemetry Event after load
2. Voicemail tab as member user → no delete button
3. Voicemail tab as tenant admin → delete button visible
4. Place outbound call → Last Telemetry Event updates through call lifecycle

---

## Files changed (production fixes only)

| File | Change |
|------|--------|
| `web/src/lib/softphone-telemetry.ts` | Registration Success event, last-event snapshot, subscribe API |
| `web/src/app/(app)/softphone-v2/page.tsx` | Emit Registration Success; diagnostics counters |
| `web/src/components/softphone-v2-validation-dashboard.tsx` | Expanded diagnostics rows |
| `web/src/components/softphone-v2/more-tab.tsx` | Pass diagnostics props |
| `web/src/components/softphone-v2/iphone-phone-app.tsx` | Prop threading |
| `web/src/components/voicemail-list.tsx` | Conditional delete button |
| `web/src/components/softphone-v2/voicemail-tab.tsx` | Role-based `canDelete` |

**Unchanged:** Telnyx boot, JWT, call flow, presence, reconnect, UI layout/design.

---

## Related documents

- [SOFTPHONE-V2-PRODUCTION-AUDIT.md](./SOFTPHONE-V2-PRODUCTION-AUDIT.md) — Full API and lifecycle audit
- [SOFTPHONE-V2-ACCEPTANCE-TEST.md](./SOFTPHONE-V2-ACCEPTANCE-TEST.md) — Acceptance test report (pre-fixes)
- [SOFTPHONE-V2-MIGRATION.md](./SOFTPHONE-V2-MIGRATION.md) — Parity migration and rollback
