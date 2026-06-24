# Softphone v2 — Legacy Parity Migration Report

**Date:** 2026-06-21  
**Status:** Business-critical legacy features ported to `/softphone-v2`

---

## Features ported (this release)

| Feature | Status | Implementation |
|---------|--------|----------------|
| Extension dialing (2–6 digits) | ✅ | `web/src/lib/softphone-dial.ts` + v2 outbound dial |
| Caller ID picker | ✅ | Tenant numbers from config + `softphone-caller-id.ts` persistence |
| Server call logging | ✅ | `softphone-call-log-client.ts` → `POST /api/softphone/call-log` |
| Presence heartbeat (30s) | ✅ | `softphone-presence.ts` → `POST /api/softphone/presence` |

### Server call log lifecycle

Same `callSid` is upserted through phases:

| Phase | `status` value | When |
|-------|----------------|------|
| Started | `started` | Outbound `newCall` or inbound ring session |
| Connected | `connected` | Telnyx state → `active` |
| Ended | `ended` | Completed call (+ `durationSeconds`, `direction`) |
| Failed | `failed` | Missed / rejected / unanswered |

---

## Files reused from legacy

| Legacy source | Reused in v2 |
|---------------|--------------|
| `web/src/app/(app)/softphone/page.tsx` | Extension dial pattern (`EXTENSION_DIAL_PATTERN`, PSTN vs extension routing) → extracted to `softphone-dial.ts` |
| `web/src/lib/api.ts` | `getSoftphoneConfig`, `logSoftphoneCall`, `setSoftphonePresence` (endpoints unchanged) |
| `routes/portal.js` | `POST /api/softphone/call-log`, `POST /api/softphone/presence` (no backend changes) |
| `web/src/lib/softphone-call-utils.ts` | Reference only — v2 keeps inline `isInboundCall`; utils available if v2 is refactored |

**Not imported from legacy page** (intentionally avoided):

- `telnyx-debug.ts`, `softphone-call-trace.ts`, `telnyx-softphone-session.ts` (v2 uses `softphone-v2-reconnect.ts` instead)

**Reused from legacy libs:**

- `call-sounds.ts` — outbound ringback (via `softphone-v2-ringback.ts`)

---

## New files added

| File | Purpose |
|------|---------|
| `web/src/lib/softphone-dial.ts` | Extension vs PSTN destination resolution |
| `web/src/lib/softphone-caller-id.ts` | Load/persist last caller ID (`localStorage`) |
| `web/src/lib/softphone-call-log-client.ts` | Server call log wrapper |
| `web/src/lib/softphone-presence.ts` | 30s presence heartbeat + offline on unload |

**Previously added (production default rollout):**

| File | Purpose |
|------|---------|
| `web/src/lib/softphone-config.ts` | Feature flag + route helpers |
| `web/src/lib/softphone-telemetry.ts` | Production telemetry client |
| `web/src/components/softphone-v2-error-boundary.tsx` | Runtime error recovery |

---

## Modified files

| File | Change |
|------|--------|
| `web/src/app/(app)/softphone-v2/page.tsx` | Extension dial, caller ID picker, server logs, presence |
| `web/src/lib/api.ts` | `logSoftphoneCall` accepts `direction`, `durationSeconds` |

---

## Operational hardening (2026-06-21)

| Feature | Status | Implementation |
|---------|--------|----------------|
| Telnyx auto-reconnect (exponential backoff) | ✅ | `softphone-v2-reconnect.ts` + `telnyx.socket.close` handler |
| Outbound ringback tone | ✅ | `softphone-v2-ringback.ts` → reuses `call-sounds.ts` |
| Production monitoring telemetry | ✅ | `Reconnect Attempt`, `Registration Failed`, `Registration Restored`, `Call Failed` |
| Validation dashboard | ✅ | `softphone-v2-validation-dashboard.tsx` |

### Telemetry events

| Event | When |
|-------|------|
| Reconnect Attempt | WebSocket disconnect / error triggers backoff retry |
| Registration Failed | Boot error, empty token, or `telnyx.error` |
| Registration Restored | `telnyx.ready` after one or more reconnect attempts |
| Call Failed | Existing call failure paths (unchanged) |

### New hardening files

| File | Purpose |
|------|---------|
| `web/src/lib/softphone-v2-reconnect.ts` | Exponential backoff reconnect controller |
| `web/src/lib/softphone-v2-ringback.ts` | Outbound ringback sync wrapper |
| `web/src/components/softphone-v2-validation-dashboard.tsx` | Ops validation panel |

### Reused from legacy (hardening)

| Legacy | Reused |
|--------|--------|
| `web/src/lib/call-sounds.ts` | `playOutboundRingback`, `stopLocalRingback` |
| `telnyx-softphone-session.ts` pattern | Backoff reconnect (v2 uses exponential backoff vs fixed 1.5s) |

---

## Remaining blockers before legacy removal

| Item | Legacy | V2 | Blocker? |
|------|--------|-----|----------|
| Outbound readiness gate (OVP check) | ✅ | ❌ | Low — misconfig shows as failed call |
| Inbound routing diagnostics panel | ✅ | ❌ | Low — ops/debug only |
| Live call recording start | ✅ | ❌ | **Medium** — if tenants rely on in-call record-start |
| Visual pre-call dial pad | ✅ | ❌ | Low — text input works |
| Deep debug / trace instrumentation | ✅ | ❌ | Low — ops only |
| Microphone priming UX | ✅ | ❌ | Low |

**Recommendation:** Legacy `/softphone` can be **retired after**:

1. 1–2 weeks production validation including reconnect + ringback on v2  
2. Decision on **live call recording start** (port or defer)

---

## Validation checklist

- [ ] Dial extension `101` (or tenant extension) — no `+` prefix applied  
- [ ] Dial PSTN `+1309…` — E.164 normalization preserved  
- [ ] Change caller ID → reload page → last selection restored  
- [ ] Platform **Call History** (`/calls`) shows started → connected → ended  
- [ ] Failed outbound appears with `status: failed`  
- [ ] Presence: extension/user shows online in phone system while softphone open  
- [ ] Close tab → presence marks offline within ~30s  
- [ ] Kill WebSocket → status shows `Reconnecting…` and registration restores  
- [ ] Outbound call plays ringback until answered  
- [ ] Validation dashboard reflects connection / registration / presence state  

---

## Rollback

Set `SOFTPHONE_V2_ENABLED=false` and redeploy — menu returns to legacy `/softphone`.

---

## iPhone UI redesign (2026-06-21)

Presentation moved to `web/src/components/softphone-v2/`. Business logic remains in `page.tsx`.

See **[SOFTPHONE-V2-PRODUCTION-AUDIT.md](./SOFTPHONE-V2-PRODUCTION-AUDIT.md)** for:

- Full API / lifecycle / telemetry audit
- Legacy retirement checklist
- Component architecture & route map
- Deployment smoke tests
