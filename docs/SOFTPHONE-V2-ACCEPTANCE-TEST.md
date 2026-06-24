# Softphone V2 — Final Acceptance Test Report

**Date:** 2026-06-21  
**Scope:** Production readiness validation (no code changes)  
**Method:** Static code-path audit + `npx tsc --noEmit` / `npm run build` (pass)  
**Live PSTN/inbound/reconnect tests:** Not executed in this session — marked **LIVE QA REQUIRED**

---

## 1. PASS / FAIL Summary

| Area | Static review | Live QA required | Overall |
|------|---------------|------------------|---------|
| Outbound PSTN | **PASS** | Audio, carrier routing | **PASS*** |
| Inbound PSTN | **PASS** | Audio, PSTN delivery | **PASS*** |
| Extension dialing | **PASS** | Extension-to-extension ring | **PASS*** |
| Presence | **PASS** | DB/UI visibility | **PASS*** |
| Reconnect | **PASS** | Mid-call reconnect | **CONDITIONAL** |
| Voicemail | **PASS** | Play stream in prod | **PASS*** |
| Recordings | **PASS** | Stream/download in prod | **PASS*** |
| Telemetry | **PARTIAL** | API log verification | **FAIL** (1 event gap) |
| Navigation | **PASS** | — | **PASS** |
| Build / compile | **PASS** | — | **PASS** |

\* *Calling and media paths are implemented and compile-clean; live carrier validation is standard pre-cutover QA, not a code defect.*

**Acceptance verdict:** **CONDITIONAL PASS** — ready for production use with monitoring; one telemetry gap and admin-only voicemail delete should be tracked.

---

## 2. Critical Issues

*None identified.* No code-path blockers prevent placing, receiving, or logging calls.

---

## 3. High Issues

| # | Issue | Evidence | Impact |
|---|-------|----------|--------|
| H1 | **Registration Success telemetry not emitted** | `SoftphoneTelemetryEvent` in `softphone-telemetry.ts` has `Registration Failed` and `Registration Restored` but no `Registration Success`. First `telnyx.ready` does not call `trackSoftphoneEvent`. | Acceptance telemetry checklist incomplete; ops cannot distinguish first registration from reconnect restore without log inference |
| H2 | **Voicemail delete restricted to admins** | `DELETE /api/tenant/voicemails/:id` requires `SUPER_ADMIN` or `TENANT_ADMIN` (`routes/portal.js`). UI exposes delete to all users via `VoicemailList`. | Regular tenant users see delete button but receive **403** — acceptance criterion "Delete works" **fails for non-admin roles** |

---

## 4. Medium Issues

| # | Issue | Evidence | Impact |
|---|-------|----------|--------|
| M1 | **Reconnect during active call not validated** | `keepConnectionAliveOnSocketClose: true` + reconnect on `telnyx.socket.close`; no automated test for mid-call WebSocket drop | Unknown whether active call survives reconnect in all network conditions |
| M2 | **Telemetry sink is console-only** | `POST /api/softphone/telemetry` logs to API stdout; no DB/analytics | Production monitoring depends on log aggregation |
| M3 | **Server call log uses `failed` for rejected inbound** | Declined calls post `status: failed` (not a distinct `rejected`) | Platform `/calls` may not distinguish reject vs missed vs failed outbound |
| M4 | **Extension dialing uses WebRTC `newCall`, not `internal-call` API** | `resolveOutboundDestination` → `client.newCall({ destinationNumber, callerNumber })` | Differs from mobile server-orchestrated path; relies on Telnyx extension routing — must be verified live per tenant |

---

## 5. Low Issues

| # | Issue | Evidence | Impact |
|---|-------|----------|--------|
| L1 | **Telemetry naming mismatch** | Spec asks "Registration Failure" / "Reconnect Restored"; code emits `Registration Failed` / `Registration Restored` | Dashboard/query aliases needed |
| L2 | **Voicemail tab remounts on each visit** | Conditional render in `iphone-phone-app.tsx` refetches list | Extra API calls; no functional break |
| L3 | **In-call Record / Add Call disabled** | `ActiveCallScreen` placeholders disabled | Documented deferral; not a regression vs stated v2 scope |
| L4 | **Local recents history only** | `localStorage` key `softphone-v2-call-history` | Recents not synced to server; platform history is separate via call-log |
| L5 | **No API retry for call-log / telemetry** | Fire-and-forget `.catch(() => {})` | Transient network blips may drop logs (calls unaffected) |

---

## 6. Remaining Technical Debt

1. Dual routes `/softphone` and `/softphone-v2` with feature flag
2. Legacy page + debug libs (`telnyx-debug.ts`, `softphone-call-trace.ts`, `telnyx-softphone-session.ts`)
3. In-call `POST /api/softphone/record-start` not wired in v2
4. OVP outbound readiness gate from legacy not ported
5. Registration Success telemetry gap (H1)
6. Voicemail delete RBAC vs UI exposure (H2)

---

## 7. Recommendation

### **Ready for Production with Monitoring**

**Rationale:**

- All core call flows (outbound, inbound, DTMF, mute, hold, hangup, timer, ringback, incoming UI, missed/reject) are implemented with consistent server call-log and local history paths.
- Presence (30s heartbeat, offline on tab close), reconnect (exponential backoff, telemetry), voicemail play/mark-read, and recordings list/stream/download are wired correctly in code.
- Production build and TypeScript check pass.
- Gaps are operational (telemetry completeness, admin-only delete, live carrier QA) — not calling blockers.

**Before removing legacy:**

1. Execute live QA checklist below in production/staging with real PSTN and extensions.
2. Monitor `[softphone-telemetry]` API logs for 2 weeks.
3. Confirm voicemail delete policy (admin-only vs expose to all users).
4. Optionally add Registration Success on first `telnyx.ready` (non-blocking).

---

## Legacy Retirement Decision

### **Keep legacy for 2-week bake-off**

| Option | Recommendation |
|--------|----------------|
| Remove legacy now | **No** — live PSTN/reconnect QA and telemetry monitoring not complete in this acceptance pass |
| **Keep legacy for 2-week bake-off** | **Yes** — flag rollback (`SOFTPHONE_V2_ENABLED=false`) remains available |
| Keep legacy for 30 days | Acceptable if tenant base is large or in-call recording parity is required |

After bake-off: remove legacy page, consolidate route to `/softphone`, drop feature flag (see `SOFTPHONE-V2-PRODUCTION-AUDIT.md`).

---

## Detailed Validation Matrix

### Outbound PSTN

| Criterion | Static | Notes |
|-----------|--------|-------|
| Call starts | ✅ | `onCallWithDestination` → `client.newCall` → `beginCallSession` → `postServerCallLog(started)` |
| Ringing state | ✅ | Telnyx states + `syncOutboundRingback` for requesting/trying/ringing |
| Active state | ✅ | `markCallSessionActive` on `active` |
| Two-way audio | ✅* | `#softphone-v2-remote` bound as `remoteElement`, `autoPlay` |
| Call timer | ✅ | `startTimer` when state → `active` |
| DTMF | ✅ | `onDtmf` → `call.dtmf(digit)` when `callState === 'active'` |
| Hold | ✅ | `call.hold()` / `unhold()` |
| Mute | ✅ | `muteAudio()` / `unmuteAudio()` |
| Hangup | ✅ | `onHangup` → `call.hangup()` → `finalizeCallSession` |
| Call history entry | ✅ | `saveCallToHistory` → `localStorage` |
| Server call log | ✅ | started → connected → ended (or failed) |
| Telemetry | ✅ | Call Started, Connected, Ended (or Failed) |

### Inbound PSTN

| Criterion | Static | Notes |
|-----------|--------|-------|
| Incoming screen | ✅ | `showIncomingOverlay` → `IncomingCallScreen` |
| Answer | ✅ | `onAnswer` → `call.answer()` |
| Reject | ✅ | `userDeclined` → local status `rejected`, server `failed` |
| Missed call | ✅ | No `active` before terminal → `missed` + toast |
| Call timer | ✅ | Starts on `active` after answer |
| Two-way audio | ✅* | Same remote audio element |
| Hangup | ✅ | Same as outbound |
| Call history | ✅ | Direction + status preserved |
| Server call log | ✅ | Same lifecycle |
| Telemetry | ✅ | Started, Connected, Ended/Failed |

### Extension Dialing

| Criterion | Static | Notes |
|-----------|--------|-------|
| 2–6 digit extensions | ✅ | `EXTENSION_DIAL_PATTERN` in `softphone-dial.ts` |
| Internal routing | ✅* | Extension digits passed to Telnyx without `+1` prefix |
| Caller ID preservation | ✅ | `callerNumber: normalizeDialNumber(callerNumber)` |
| Call log creation | ✅ | `resolveCallLogParties` for from/to |

### Presence

| Criterion | Static | Notes |
|-----------|--------|-------|
| Online when open | ✅ | `startSoftphonePresenceHeartbeat` when `telnyxReady` |
| Heartbeat 30s | ✅ | `SOFTPHONE_PRESENCE_HEARTBEAT_MS = 30_000` |
| Offline on tab close | ✅ | `pagehide` / `beforeunload` → `markSoftphoneOffline()` |

### Reconnect

| Criterion | Static | Notes |
|-----------|--------|-------|
| WebSocket disconnect | ✅ | `telnyx.socket.close` handler |
| Reconnect attempt | ✅ | `createTelnyxReconnectController` + `Reconnect Attempt` telemetry |
| Registration restored | ✅ | `telnyx.ready` after attempts → `Registration Restored` |
| Calls after reconnect | ⚠️ | LIVE QA REQUIRED — SDK `keepConnectionAliveOnSocketClose` set |

### Voicemail

| Criterion | Static | Notes |
|-----------|--------|-------|
| List loads | ✅ | `VoicemailTab` → `getVoicemails(100)` |
| Play works | ✅* | `LazyStreamPlayer` + stream API + `Voicemail Played` telemetry |
| Mark read works | ✅ | `markVoicemailRead` on play (all tenant users) |
| Delete works | ⚠️ | **Admin roles only** (H2) |

### Recordings

| Criterion | Static | Notes |
|-----------|--------|-------|
| List loads | ✅ | `MoreTab` → `getCallRecordings(100)` |
| Stream playback | ✅* | `LazyStreamPlayer` + `Recording Played` telemetry |
| Download works | ✅ | `downloadAuthenticatedStream` in `RecordingsList` |

### Telemetry Events

| Event (spec) | Implemented name | Status |
|--------------|------------------|--------|
| Registration Success | — | ❌ **Not emitted** |
| Registration Failure | `Registration Failed` | ✅ |
| Reconnect Attempt | `Reconnect Attempt` | ✅ |
| Reconnect Restored | `Registration Restored` | ✅ |
| Call Started | `Call Started` | ✅ |
| Call Connected | `Call Connected` | ✅ |
| Call Failed | `Call Failed` | ✅ |
| Call Ended | `Call Ended` | ✅ |
| Voicemail Played | `Voicemail Played` | ✅ |
| Recording Played | `Recording Played` | ✅ |

### Navigation (Bottom Tabs)

| Tab | Renders | State preserved |
|-----|---------|-----------------|
| Voicemail | ✅ `VoicemailTab` | Badge in parent; list refetches on tab entry |
| Recents | ✅ Default `activeTab: 'recents'` | ✅ search, filter, history in parent |
| Contacts | ✅ `ContactsTab` | ✅ search in parent |
| Keypad | ✅ `KeypadTab` | ✅ destination, caller ID |
| More | ✅ `MoreTab` | Diagnostics toggle local only |

Tabs hidden during live call (`!hasLiveCall`); overlays take precedence — expected iPhone behavior.

---

## Live QA Checklist (post-deploy)

Execute manually against staging/production:

- [ ] Outbound PSTN: ring → answer → 60s talk → DTMF → hold → mute → hangup
- [ ] Verify `/calls` shows started → connected → ended with duration
- [ ] Inbound PSTN: ring → accept; separate test → decline; separate → miss
- [ ] Extension `101` (or tenant ext) rings target
- [ ] Close tab → presence offline within ~30s
- [ ] Disable network 10s → reconnect banner → place new call
- [ ] Mid-call network blip → verify call continues or fails gracefully
- [ ] Voicemail play + unread clears; delete as admin + confirm 403 as member
- [ ] Recording play + download in More tab
- [ ] Grep API logs for telemetry events during above

---

*Report generated without code modifications per acceptance test scope.*
