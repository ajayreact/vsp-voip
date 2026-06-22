# Phase 5B — Inbound Dual-Target Routing

Implementation report for Phase B: extension desk + employee app inbound ringing via `resolveExtensionRingTargets()`.

**Status:** Implemented  
**Schema migration:** None (code-only deploy)

---

## Pre-flight verification (Phase A desk registration)

Before Phase B, desk credential provisioning was verified:

| Check | Result |
|-------|--------|
| Telnyx credential API | PASS — `gencredOWrc…` with tag `vsp-extension-desk` |
| Zoiper/Linphone settings | Printed by verification script |
| `Extension.sipRegistered` tracking | PASS — webhook simulation sets `true` |
| Telnyx poll | PASS — `Registered` when credential active |

### Desk registration verification script

```powershell
# Credential + tracking pipeline
npx tsx scripts/verify-extension-desk-registration.ts --extension-number 101 --simulate-webhook

# Live Zoiper/Linphone (register first, then poll)
npx tsx scripts/verify-extension-desk-registration.ts --extension-number 101 --poll-seconds 120
```

**Zoiper / Linphone settings (Ext 101):**

| Field | Value |
|-------|-------|
| Username | `Extension.telnyxSipUsername` (`gencred…`) |
| Password | `Extension.telnyxSipPassword` |
| Server | `sip.telnyx.com` |
| Port | `5060` UDP or `5061` TLS |

---

## Migration impact

| Area | Impact |
|------|--------|
| **Database** | No migration |
| **Mobile app** | Unchanged — still uses `User.telnyxSipUsername` |
| **WebRTC login** | Unchanged — `/api/softphone/token` untouched |
| **User Telnyx credentials** | Unchanged — not created/reset by Phase B |
| **Ring groups** | Unchanged — still use `ringGroupRouter.js` (Phase B.1 deferred) |
| **Call queues** | Not implemented |
| **Inbound routing** | Extension-linked DIDs now dial **desk + app** targets |

---

## Routing flow diagram

```mermaid
flowchart TD
  PSTN[Inbound PSTN call] --> CC[Telnyx Call Control webhook]
  CC --> CTX[resolveInboundContext — lookup DID]
  CTX --> EXT[resolveExtensionForPhoneRecord]
  EXT --> POL[Extension inbound policy — DND / forward / screen]
  POL --> RES[resolveExtensionRingTargets]
  RES --> DESK{type: sip<br/>Extension.telnyxSipUsername}
  RES --> APP{type: app<br/>User.telnyxSipUsername}
  DESK --> STRAT{multiDeviceEnabled?}
  APP --> STRAT
  STRAT -->|true, 2+ targets| SIM[dialAllTargetsSimultaneously]
  STRAT -->|false or 1 target| SEQ[dialNextTarget sequential]
  SIM --> TELNYX[sip:username@sip.telnyx.com]
  SEQ --> TELNYX
  TELNYX --> DEV1[Desk SIP phone]
  TELNYX --> DEV2[Mobile app + push]
  TELNYX --> DEV3[WebRTC browser]
```

### Target resolution rules

| Condition | Targets | Strategy |
|-----------|---------|----------|
| `sipEnabled` + Telnyx desk cred | `{ type: 'sip' }` | — |
| Employee assigned + user cred | `{ type: 'app' }` | — |
| Both, `multiDeviceEnabled=true` | Desk + App | **simultaneous** |
| Both, `multiDeviceEnabled=false` | Desk then App | **sequential** |
| Desk only (no employee) | `{ type: 'sip' }` only | sequential |
| App only (`sipEnabled=false`) | `{ type: 'app' }` only | sequential |

Legacy fallback: if extension cannot be resolved, `resolveDirectUserRingTargets()` (app-only) still runs.

---

## Code changes

| File | Change |
|------|--------|
| `lib/inboundRouting.js` | `resolveExtensionRingTargets()`, `resolveExtensionForPhoneRecord()`, `formatTargetDialTo()` |
| `lib/inboundCallControl.js` | Dial `type: 'sip'` via `formatTargetDialTo()` |
| `lib/pbxOwnership.js` | Chain validation uses extension ring targets |
| `lib/voiceTelemetry.js` | Export `checkTelephonyCredentialRegistration` |
| `scripts/verify-extension-desk-registration.ts` | Desk credential + registration verification |
| `scripts/validate-phase-b-inbound-routing.ts` | Phase B target resolution validation |

---

## Validation

```powershell
# Phase A desk credential
npx tsx scripts/verify-extension-desk-registration.ts --extension-number 101 --simulate-webhook

# Phase B ring target resolution
npx tsx scripts/validate-phase-b-inbound-routing.ts
```

### Manual inbound test

1. Register desk phone (Zoiper/Linphone) OR open WebRTC softphone tab.
2. Call primary DID `+1 (956) 396-1388`.
3. With `multiDeviceEnabled=true`: desk + browser/mobile ring together.
4. With `multiDeviceEnabled=false`: desk rings first, then app on no-answer.

---

## Rollback plan

1. **Revert** `lib/inboundRouting.js` and `lib/inboundCallControl.js` to prior commit.
2. Inbound returns to **app-only** dial (`User.telnyxSipUsername`).
3. Desk phones stop receiving inbound until Phase B re-deployed.
4. Phase A credentials and registration tracking remain valid.
5. No database rollback required.

---

## Ownership model (unchanged)

```
Company → Extension (desk cred) → DID → Employee (app cred) → Devices
```

Ring groups and call queues deferred — members remain Extension rows; wiring to `resolveExtensionRingTargets()` is Phase B.1.
