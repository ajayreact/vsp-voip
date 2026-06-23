# Softphone v2 Migration Report

**Date:** 2026-06-21  
**Goal:** Make `/softphone-v2` the default production softphone and retire `/softphone` safely.

---

## 1. Feature comparison

| Feature | Legacy `/softphone` | V2 `/softphone-v2` | Missing in V2 |
|--------|---------------------|--------------------|---------------|
| JWT authentication | ✅ | ✅ | — |
| Telnyx WebRTC registration | ✅ | ✅ | — |
| Outbound PSTN calling | ✅ | ✅ | — |
| Inbound calling | ✅ | ✅ | — |
| Two-way audio | ✅ | ✅ | — |
| Hangup | ✅ | ✅ | — |
| Call timer | ✅ | ✅ | — |
| DTMF (in-call keypad) | ✅ | ✅ | — |
| Mute / Unmute | ✅ | ✅ | — |
| Hold / Resume | ✅ | ✅ | — |
| Recent calls (local) | ❌ | ✅ | — |
| Call history (localStorage) | ❌ | ✅ | — |
| Call back | ❌ | ✅ | — |
| Full-screen incoming call UI | Partial | ✅ | — |
| Missed call tracking + toast | ❌ | ✅ | — |
| Voicemail center (in-app) | ❌ | ✅ | — |
| Recordings center (in-app) | ❌ | ✅ | — |
| Modern iPhone-style UI | ❌ | ✅ | — |
| Dark mode | ❌ | ✅ | — |
| Extension dialing (2–6 digits) | ✅ | ❌ | **Yes** |
| Caller ID picker (tenant numbers) | ✅ | ❌ (first/default only) | **Yes** |
| Visual dial pad (append digits) | ✅ | ❌ (text input + in-call DTMF) | Partial |
| Outbound ringback tones | ✅ | ❌ | **Yes** |
| Outbound readiness gate | ✅ | ❌ | **Yes** |
| Inbound routing readiness warnings | ✅ | ❌ | **Yes** |
| Server diagnostics panel | ✅ | ❌ | **Yes** |
| Deep call trace / debug instrumentation | ✅ | ❌ | Intentional |
| Telnyx socket auto-reconnect | ✅ | ❌ | **Yes** |
| Softphone presence heartbeat | ✅ | ❌ | **Yes** |
| Server-side call logging (`/call-log`) | ✅ | ❌ | **Yes** |
| Live call recording start | ✅ | ❌ | **Yes** |
| Microphone priming / permission UX | ✅ | ❌ | Partial |
| Internal transfer UI | ❌ | ❌ | — |
| Ring group configuration UI | ❌ (in Greeting) | ❌ (in Greeting) | — |
| CRM integrations | ❌ | ❌ | — |
| Call notes | ❌ | ❌ | — |
| Contacts directory | ❌ | ❌ | — |
| Production telemetry | ❌ | ✅ | — |
| Error boundary + legacy fallback link | ❌ | ✅ | — |

---

## 2. Legacy-only functionality (not in V2)

These exist in legacy and should be ported or consciously deferred before removing `/softphone`:

1. **Extension dialing** — legacy dials 2–6 digit extensions via `client.newCall({ destinationNumber: extensionDigits })`.
2. **Caller ID selection** — legacy lets users pick from assigned tenant numbers.
3. **Outbound readiness checks** — legacy blocks PSTN dial when Telnyx OVP / credential connection is misconfigured.
4. **Inbound routing warnings** — legacy surfaces diagnostics when inbound PSTN → WebRTC may fail.
5. **Softphone presence** — legacy sends `POST /api/softphone/presence` heartbeat (used for extension reachability).
6. **Server-side call logging** — legacy posts completed calls to `POST /api/softphone/call-log` (platform Call History).
7. **Live call recording** — legacy starts recording via `POST /api/softphone/record-start` when call becomes active.
8. **Telnyx reconnect** — legacy schedules reconnect on disconnect.
9. **Outbound ringback** — legacy plays ringback while outbound is ringing.
10. **Debug / diagnostics panel** — legacy shows SIP username, invite timestamps, PC stats (ops tooling).

**Not implemented in either softphone:** internal blind/warm transfer UI, CRM, call notes, contacts (platform may add these separately).

---

## 3. Migration checklist

### Pre-deploy

- [x] Feature flag: `SOFTPHONE_V2_ENABLED` / `NEXT_PUBLIC_SOFTPHONE_V2_ENABLED`
- [x] Navigation → `/softphone-v2` when flag enabled
- [x] `/softphone` redirects to v2 when flag enabled
- [x] `/softphone-v2` redirects to legacy when flag disabled (rollback)
- [x] Error boundary with legacy fallback link
- [x] Production telemetry (`POST /api/softphone/telemetry`)
- [ ] Port extension dialing to v2 (recommended before legacy removal)
- [ ] Port presence heartbeat to v2 (recommended for extension routing)
- [ ] Port server call-log to v2 (recommended for `/calls` history parity)

### Deploy

```bash
# On EC2
export SOFTPHONE_V2_ENABLED=true
bash deploy/deploy-web.sh
```

Rollback:

```bash
export SOFTPHONE_V2_ENABLED=false
bash deploy/deploy-web.sh
```

### Post-deploy validation

- [ ] Menu **Softphone** opens `/softphone-v2`
- [ ] Outbound call to test DID (+13099880196 ecosystem)
- [ ] Inbound call to tenant DID → full-screen incoming UI → answer → audio
- [ ] Mute, hold, DTMF, hangup
- [ ] Voicemail play → telemetry in API logs `[softphone-telemetry]`
- [ ] Recording play → telemetry event
- [ ] Force React error → error boundary → legacy link works
- [ ] Set `SOFTPHONE_V2_ENABLED=false` → menu opens `/softphone`

### Retire legacy (future)

- [ ] Port remaining gap features above
- [ ] 2-week stable telemetry review
- [ ] Remove `/softphone` route and legacy libs (`telnyx-debug`, `softphone-call-trace`, etc.)
- [ ] Rename `/softphone-v2` → `/softphone` (optional clean URL)

---

## 4. Feature flag

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `SOFTPHONE_V2_ENABLED` | EC2 / deploy shell | `true` | Passed to Next.js build |
| `NEXT_PUBLIC_SOFTPHONE_V2_ENABLED` | Next.js build | from above | Client-side routing |

Implementation: `web/src/lib/softphone-config.ts`

---

## 5. Production telemetry

Events tracked from v2:

| Event | Trigger |
|-------|---------|
| Call Started | Outbound `newCall` or inbound ring session |
| Call Connected | Telnyx state → `active` |
| Call Failed | Unanswered / rejected / Telnyx error |
| Call Ended | Completed call with duration |
| Voicemail Played | Voicemail stream play |
| Recording Played | Recording stream play |

Backend: `POST /api/softphone/telemetry` (structured console log; extend to DB/analytics later).

Client: `web/src/lib/softphone-telemetry.ts`

---

## 6. Build validation

Run before deploy:

```bash
cd web
npx tsc --noEmit
npm run build
```

---

## 7. Recommendation

**Ship v2 as default now** with the feature flag for instant rollback. Keep legacy at `/softphone` for 30 days while porting extension dialing, presence, and server call-log. Remove legacy only after telemetry shows stable call success rates and gap features are addressed or accepted as deferred.
