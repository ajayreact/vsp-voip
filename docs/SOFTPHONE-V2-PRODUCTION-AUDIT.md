# Softphone V2 — Final Production Audit & iPhone UI Redesign

**Date:** 2026-06-21  
**Route:** `/softphone-v2`  
**Build status:** `npx tsc --noEmit` ✅ · `npm run build` ✅

---

## Executive summary

Softphone V2 is **production-ready** for calling, presence, call logging, voicemail playback, and recording playback. Business logic (TelnyxRTC boot, JWT, APIs, reconnect, telemetry) is unchanged in `web/src/app/(app)/softphone-v2/page.tsx`. Presentation is delegated to `web/src/components/softphone-v2/*` (iPhone Phone App UI).

**Known gaps before legacy removal:**

| Gap | Severity | Notes |
|-----|----------|-------|
| In-call **Record** / **Add Call** UI placeholders (disabled) | Low | Legacy had `POST /api/softphone/record-start`; v2 does not wire in-call record |
| No explicit **Registration Success** telemetry on first boot | Low | `telnyx.ready` sets UI state; only reconnect path emits `Registration Restored` |
| API layer has **no automatic retry** | Info | Fire-and-forget for call-log/telemetry; presence retries on next 30s heartbeat |
| Outbound readiness gate (OVP diagnostics) | Low | Legacy pre-flight check not ported |

---

## Part 1 — Production readiness audit

### API integrations

#### `POST /api/softphone/token`

| Field | Detail |
|-------|--------|
| **Used in** | `SoftphoneV2Content` boot → `getSoftphoneToken()` (`web/src/lib/api.ts`) |
| **Request** | `{}` (POST, Bearer auth) |
| **Response** | `{ success, loginToken, sipUsername?, credentialConnectionId?, expiresInSeconds }` |
| **Error handling** | Boot catch → status message + `Registration Failed` telemetry; empty token → early return |
| **Retry** | None on token fetch; reconnect controller retries `client.connect()` after socket errors |
| **Status** | ✅ Production ready |

#### `POST /api/softphone/call-log`

| Field | Detail |
|-------|--------|
| **Used in** | `postServerCallLog()` → `softphone-call-log-client.ts` from `page.tsx` lifecycle |
| **Request** | `{ callSid, from, to, direction, status, durationSeconds? }` — status: `started` \| `connected` \| `ended` \| `failed` |
| **Response** | `{ success, callLog }` |
| **Error handling** | `.catch(() => {})` — failures never block calling |
| **Retry** | None |
| **Status** | ✅ Production ready |

#### `POST /api/softphone/presence`

| Field | Detail |
|-------|--------|
| **Used in** | `startSoftphonePresenceHeartbeat()` → `softphone-presence.ts` when `telnyxReady` |
| **Request** | `{ online: boolean }` |
| **Response** | `{ success, online }` |
| **Error handling** | Sets presence status `error`; does not block calls |
| **Retry** | Implicit — next heartbeat in **30s** (`SOFTPHONE_PRESENCE_HEARTBEAT_MS`) |
| **Status** | ✅ Production ready |

#### `POST /api/softphone/telemetry`

| Field | Detail |
|-------|--------|
| **Used in** | `trackSoftphoneEvent()` → `softphone-telemetry.ts` |
| **Request** | `{ event, properties?: { source: 'softphone-v2', at, ... } }` |
| **Response** | `{ success }` (server logs to console) |
| **Error handling** | `.catch(() => {})` |
| **Retry** | None |
| **Status** | ✅ Production ready (console sink; no persistence yet) |

#### Voicemail APIs

| Endpoint | Used in | Request | Response | Errors | Retry | Status |
|----------|---------|---------|----------|--------|-------|--------|
| `GET /api/tenant/voicemails?limit=` | `VoicemailTab` → `getVoicemails()` | GET | `{ success, count, voicemails[] }` | UI error message; 401 silent | Manual reload via `onChange` | ✅ |
| `PATCH /api/tenant/voicemails/:id/read` | `VoicemailList` on play | PATCH | `{ success, voicemail }` | `onError` callback | None | ✅ |
| `DELETE /api/tenant/voicemails/:id` | `VoicemailList` | DELETE | `{ success }` | `onError` | None | ✅ |
| `GET /api/tenant/voicemails/:id/stream` | `VoicemailList` audio src | GET | Audio stream | Play failure in UI | None | ✅ |

#### Recording APIs

| Endpoint | Used in | Request | Response | Errors | Retry | Status |
|----------|---------|---------|----------|--------|-------|--------|
| `GET /api/tenant/recordings?limit=` | `MoreTab` → `getCallRecordings()` | GET | `{ success, count, recordings[] }` | UI error | Re-open More tab | ✅ |
| `GET /api/tenant/recordings/:id/stream` | `RecordingsList` | GET | Audio stream | `onError` | None | ✅ |
| `POST /api/softphone/record-start` | **Not used in v2** | `{ callControlId, from, to }` | `{ success, started, callControlId }` | N/A | N/A | ⚠️ Legacy only |

#### Supporting APIs (boot / More tab)

| Endpoint | Used in | Status |
|----------|---------|--------|
| `GET /api/softphone/config` | Boot — caller ID, tenant numbers, routing | ✅ |
| `GET /api/extensions` (via `getExtensions()`) | Contacts tab | ✅ |
| `GET /api/softphone/diagnostics` | Validation dashboard (More → Diagnostics) | ✅ |

---

### Call lifecycle verification

#### Outbound

| State | Telnyx / app | Server log | Telemetry | UI |
|-------|--------------|------------|-----------|-----|
| started | `newCall` invoked | `status: started` | `Call Started` | Outgoing overlay |
| requesting | `new` / `requesting` | — | — | "Connecting…" |
| trying | `trying` | — | — | Outgoing overlay |
| ringing | `ringing` / `early` | — | — | Ringback audio |
| active | `active` | `status: connected` | `Call Connected` | Full-screen active call |
| ended | `hangup` / `destroy` | `status: ended` + duration | `Call Ended` | Return to Recents |
| failed | No `active` before terminal | `status: failed` | `Call Failed` | History + toast if missed inbound |

#### Inbound

| State | Detection | Server log | Telemetry | UI |
|-------|-----------|------------|-----------|-----|
| ringing | `isInboundCall` + `ringing` | `status: started` | `Call Started` | Full-screen incoming |
| answered | `call.answer()` → `active` | `status: connected` | `Call Connected` | Active call |
| rejected | Decline → `userDeclined` | `status: failed` | `Call Failed` | — |
| missed | Terminal without `active` | `status: failed` | `Call Failed` | Missed toast + Recents |
| active | `active` | `connected` | `Call Connected` | Active call |
| ended | Terminal after active | `ended` + duration | `Call Ended` | — |

#### Recovery

| Event | Handler | Telemetry | UI |
|-------|---------|-----------|-----|
| WebSocket disconnect | `telnyx.socket.close` → `reconnectController.schedule()` | — | `Reconnecting…` |
| Reconnect attempt | Exponential backoff (1.5s → 60s cap) | `Reconnect Attempt` | Attempt count in status |
| Reconnect success | `telnyx.ready` after attempts > 0 | `Registration Restored` | Ready status |
| Registration restored | `reconnectController.reset()` | `{ attempts, reconnectedAt }` | Validation dashboard |
| Boot / runtime error | `telnyx.error`, boot catch | `Registration Failed` | Status message |

---

### Telemetry coverage matrix

| Category | Event | Emitted | Location |
|----------|-------|---------|----------|
| Registration | success (first boot) | ❌ Gap | Consider `telnyx.ready` when `attempts === 0` |
| Registration | failure | ✅ | Boot empty token, boot catch, `telnyx.error` |
| Reconnect | attempt | ✅ | `softphone-v2-reconnect.ts` callback |
| Reconnect | restored | ✅ | `telnyx.ready` after reconnect |
| Calls | started | ✅ | `beginCallSession` |
| Calls | connected | ✅ | `markCallSessionActive` |
| Calls | failed | ✅ | History save + `newCall` catch |
| Calls | ended | ✅ | Completed history save |
| Media | voicemail played | ✅ | `voicemail-list.tsx` |
| Media | recording played | ✅ | `recordings-list.tsx` |

---

## Part 2 — Legacy retirement audit

### Features verified (v2 parity)

| Feature | V2 | Legacy |
|---------|----|----|
| JWT / Telnyx registration | ✅ | ✅ |
| Outbound / inbound calls | ✅ | ✅ |
| Two-way audio | ✅ | ✅ |
| Hangup | ✅ | ✅ |
| Call timer | ✅ | ✅ |
| DTMF | ✅ | ✅ |
| Hold / Mute | ✅ | ✅ |
| Caller ID selection | ✅ | ✅ |
| Extension dialing | ✅ | ✅ |
| Presence heartbeat | ✅ (30s) | ✅ |
| Server call logging | ✅ | ✅ |
| Voicemail list / play / delete | ✅ | ✅ |
| Recordings list / play | ✅ | ✅ |
| Recent calls (local) | ✅ | ✅ |
| Reconnect | ✅ (exponential) | ✅ (fixed delay) |
| Telemetry | ✅ | Partial |
| iPhone-style UI | ✅ | ❌ |
| In-call record start | ❌ | ✅ |
| Deep debug / trace | ❌ | ✅ |
| OVP outbound gate | ❌ | ✅ |

### APIs verified

All v2-used endpoints tested via code path review and production build. No backend changes required for v2.

### Remaining technical debt

1. **Dual softphone routes** — `/softphone` and `/softphone-v2` both exist; flag controls nav default.
2. **Legacy-only libs** — `telnyx-softphone-session.ts`, `telnyx-debug.ts`, `softphone-call-trace.ts` only referenced from legacy page.
3. **Local call history** — `localStorage` key `softphone-v2-call-history` separate from platform `/calls`.
4. **Telemetry sink** — Server logs only; no DB/analytics pipeline.
5. **Record / Add Call** — UI placeholders disabled; no `record-start` integration.

### Risks before removing legacy

| Risk | Mitigation |
|------|------------|
| Tenants using in-call record | Survey usage; port `startSoftphoneRecording` or keep legacy flag for admins |
| Ops relies on legacy diagnostics | Validation dashboard + `/api/softphone/diagnostics` in More tab |
| Rollback needed post-removal | Keep `SOFTPHONE_V2_ENABLED=false` deploy path until 2-week bake-off complete |
| Mobile unaffected | Mobile uses same APIs; web legacy removal is isolated |

### Recommendations

1. Run **2-week production bake-off** with v2 default (`NEXT_PUBLIC_SOFTPHONE_V2_ENABLED=true`).
2. Add **Registration Success** telemetry on first `telnyx.ready` (optional, low effort).
3. Decide on **in-call recording** — port or document as deferred.
4. After bake-off, execute legacy removal checklist below.
5. Redirect `/softphone` → `/softphone-v2` permanently (301 or Next.js redirect).

---

### Legacy removal checklist

#### Files to remove

```
web/src/app/(app)/softphone/page.tsx
web/src/lib/telnyx-softphone-session.ts      # if no other imports
web/src/lib/telnyx-debug.ts                  # if no other imports
web/src/lib/softphone-call-trace.ts          # if no other imports
```

**Keep (shared with v2):**

```
web/src/lib/softphone-dial.ts
web/src/lib/softphone-caller-id.ts
web/src/lib/softphone-call-log-client.ts
web/src/lib/softphone-presence.ts
web/src/lib/softphone-telemetry.ts
web/src/lib/softphone-config.ts
web/src/lib/softphone-call-utils.ts          # optional consolidate
web/src/lib/call-sounds.ts
web/src/components/voicemail-list.tsx
web/src/components/recordings-list.tsx
```

#### Routes to remove / change

| Action | Route |
|--------|-------|
| Remove page | `/softphone` (`web/src/app/(app)/softphone/`) |
| Rename (optional) | `/softphone-v2` → `/softphone` |
| Update nav | `getSoftphoneHref()` always `/softphone` |
| Remove redirect | Legacy page's `router.replace('/softphone-v2')` |

#### Feature flags to remove

| Flag | Location |
|------|----------|
| `NEXT_PUBLIC_SOFTPHONE_V2_ENABLED` | `softphone-config.ts`, `deploy/deploy-web.sh` |
| `SOFTPHONE_V2_ENABLED` | Deploy script mapping |

After removal: delete `isSoftphoneV2Enabled()` branches; single route `/softphone`.

#### Migration steps

1. Confirm 2-week v2 bake-off checklist (see `SOFTPHONE-V2-MIGRATION.md`).
2. Merge `/softphone-v2` → `/softphone` (move `page.tsx`, update imports).
3. Update `sidebar.tsx`, `dashboard/page.tsx`, error boundary hrefs.
4. Delete legacy page and unused libs.
5. Remove feature flag env vars from deploy docs.
6. Run `npm run build` + smoke test all call flows.

#### Rollback steps

1. Set `SOFTPHONE_V2_ENABLED=false` in deploy.
2. Redeploy web — restores legacy `/softphone` nav target.
3. Legacy page must remain in repo until removal is final.

#### Deployment sequence

```
1. Deploy API (no change required)
2. SOFTPHONE_V2_ENABLED=true bash deploy/deploy-web.sh
3. Verify https://app.vspphone.com/softphone-v2
4. Monitor [softphone-telemetry] logs on API
5. After bake-off: deploy legacy removal PR
6. Optional: rename route to /softphone
```

---

## Part 3 — iPhone Phone App UI redesign

### Architecture (presentation only)

```
web/src/app/(app)/softphone-v2/page.tsx
  └── SoftphoneV2Content()          ← ALL business logic (unchanged Telnyx/API)
        └── IphonePhoneApp            ← Shell + overlays
              ├── BottomTabBar        ← 5 tabs (Lucide)
              ├── RecentsTab          ← Default landing
              ├── ContactsTab         ← Extensions (CRM-ready)
              ├── KeypadTab           ← Dial pad + caller ID
              ├── VoicemailTab        ← VoicemailList
              ├── MoreTab             ← Settings, recordings, diagnostics
              ├── IncomingCallScreen  ← Full-screen inbound
              ├── OutgoingCallScreen  ← Outbound pre-active
              ├── ActiveCallScreen    ← Mute, hold, DTMF, speaker
              └── RecentsDetailSheet  ← Info sheet
```

Shared utilities: `components/softphone-v2/types.ts`, `utils.ts`, `icons.tsx`.

### Updated route map

| Route | Component | Notes |
|-------|-----------|-------|
| `/softphone-v2` | `SoftphoneV2Page` → `SoftphoneV2Content` | Production default when flag true |
| `/softphone` | Legacy page OR redirect to v2 | Flag-dependent |
| `/voicemail` | Standalone voicemail page | Also embedded in v2 Voicemail tab |
| `/recordings` | Standalone recordings | Linked from More tab |
| `/settings` | Settings | Linked from More tab |

### UI screens implemented

| Screen | Tab / overlay | Features |
|--------|---------------|----------|
| Recents | Default tab | Search, All/Missed filter, avatar rows, info sheet, call back |
| Contacts | Tab 3 | Search, avatar, name, extension, department |
| Keypad | Tab 4 | iPhone 3×4 pad, green call, caller ID picker |
| Voicemail | Tab 1 | Unread badge, play, delete via `VoicemailList` |
| More | Tab 5 | Settings, recordings, diagnostics, telemetry status, version |
| Incoming call | Overlay | Accept / decline, ringtone |
| Outgoing call | Overlay | Status, end call |
| Active call | Overlay | Timer, mute, keypad, speaker, hold, end (record/add disabled) |

### Design system applied

| Token | Value |
|-------|-------|
| Background | `#F5F5F7` |
| Card | `#FFFFFF` |
| Primary | `#007AFF` |
| Success | `#34C759` |
| Danger | `#FF3B30` |
| Radius | `24px`+ (`rounded-3xl`) |
| Icons | Lucide (tabs), custom SVG (call controls) |

---

## Deployment notes

### Environment

```bash
# Web build (default v2 on)
NEXT_PUBLIC_SOFTPHONE_V2_ENABLED=true
NEXT_PUBLIC_API_URL=https://api.vspphone.com

# Deploy
SOFTPHONE_V2_ENABLED=true bash deploy/deploy-web.sh
```

### Post-deploy smoke test

1. Open `/softphone-v2` — lands on **Recents**.
2. Keypad → dial extension and PSTN — outbound connects, ringback plays.
3. Inbound call — full-screen UI, accept, two-way audio.
4. Active call — mute, hold, DTMF, speaker, timer, hangup.
5. Voicemail tab — load, play (telemetry in API logs).
6. More → Diagnostics — socket, registration, presence green.
7. Disconnect network briefly — reconnect attempt + restore.

### Rollback

```bash
SOFTPHONE_V2_ENABLED=false bash deploy/deploy-web.sh
```

Nav returns to legacy `/softphone`; v2 route remains reachable if bookmarked.

---

## Files changed (this release)

| Path | Change |
|------|--------|
| `web/src/app/(app)/softphone-v2/page.tsx` | Logic hub; renders `IphonePhoneApp` |
| `web/src/components/softphone-v2/*` | New iPhone UI components (12 files) |
| `docs/SOFTPHONE-V2-PRODUCTION-AUDIT.md` | This document |

**Not modified:** Telnyx boot, JWT handling, API payloads, presence interval, reconnect algorithm, call-log phases, voicemail/recording API clients.
