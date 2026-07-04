# Phase 3 — Inbound Caller ID Validation

**Status:** Validated against Telnyx WebRTC SDK documentation and automated proof tests.  
**Scope:** Softphone V2 web client only (no Call Control / webhook / mobile changes).

---

## Root cause verification

| Finding | Evidence |
|---------|----------|
| Telnyx first inbound notification is `telnyx.notification` → `callUpdate`, `call.state === 'ringing'` | [Call State Lifecycle](https://developers.telnyx.com/development/webrtc/js-sdk/explanation/call-state-lifecycle.md) |
| SDK exposes `Call.remotePartyNumber` and `Call.remotePartyName` on ringing | [Call Class](https://developers.telnyx.com/development/webrtc/js-sdk/reference/call.md) |
| Raw WebSocket `telnyx_rtc.ringing` carries `caller_id_number`, `caller_id_name` | [JS SDK Anatomy](https://developers.telnyx.com/docs/voice/webrtc/js-sdk/anatomy.md) |
| Call Control PSTN→WebRTC bridge sets dial `from` = tenant DID, `fromDisplayName` = PSTN caller/CNAM | `lib/inboundCallControl.js` → `dialSingleTarget()` |
| **Bug:** UI trusted `remotePartyNumber` only; tenant DID filtered → empty → "Unknown Caller" | Fixed: full field chain + sticky FSM |
| **Bug:** Caller updated only after Accept via `call-accepted` pstnCaller | Fixed: resolve at first notification; Accept is fallback only |

---

## Notification payload analysis

On the **first inbound** `callUpdate` (ringing), inspect via DevTools log `inbound.callerFields`:

| Field | Telnyx source | Call Control PSTN bridge typical value |
|-------|---------------|----------------------------------------|
| `remotePartyNumber` | `caller_id_number` on agent leg | Tenant DID (filtered) |
| `remotePartyName` | `caller_id_name` / `fromDisplayName` | CNAM **or** PSTN E.164 |
| `options.caller_id_number` | Raw ringing param (when SDK exposes) | PSTN caller or tenant DID |
| `options.caller_id_name` | Raw ringing param | CNAM |
| `options.client_state` | Call Control dial metadata | Base64 JSON `{ pstnCaller, pstnCallerName }` |
| `options.customHeaders` | SIP custom headers | Varies |
| `notification.payload.from` | Legacy / alternate builds | Sometimes PSTN caller |
| Pending lookup (`GET /api/softphone/pending-inbound-caller`) | Redis index at dial time | `session.from`, `callerDisplayName` |

---

## Caller identity resolution order

### Display number (E.164)

1. `options.caller_id_number` / `callerIdNumber` — if not tenant DID
2. `remotePartyNumber` — if not tenant DID
3. `remotePartyName` — when value parses as E.164 (bridge without CNAM)
4. `options.remoteCallerNumber` / `options.remotePartyNumber`
5. `client_state.pstnCaller` (Call Control dial)
6. `notification.from`, cached `pstnCallerHint`, notification scan
7. `remoteIdentity` (filtered)
8. Pending inbound lookup (async, only if still Unknown at session create)
9. `Unknown` — only when all sources empty (Anonymous/Blocked PSTN)

### Display name (CNAM)

1. `options.caller_id_name` / `callerIdName`
2. `remotePartyName` — when not phone-like
3. `options.remoteCallerName`
4. `client_state.pstnCallerName`
5. Pending lookup `pstnCallerName`

### UI rendering (`IncomingCallScreen`)

- **Name + number:** when `nameHint` differs from formatted E.164
- **Number only:** when no CNAM / contact match
- **Never** show "Unknown Caller" unless resolution returns `Unknown` / empty

### Sticky identity (duplicate notifications)

- `mergeInboundCallerLabel()` — session ref + FSM `SESSION_LABEL`
- Known caller never replaced by `Unknown` or empty

---

## Test scenarios (automated proof)

| Scenario | Test file | Status |
|----------|-----------|--------|
| 1 – PSTN inbound before Accept | `tests/lib/inbound-caller-validation.test.ts` | ✅ |
| 2 – CNAM name + number | same | ✅ |
| 3 – Number only, no CNAM | same | ✅ |
| 4 – Duplicate notifications | same + `call-fsm.test.ts` | ✅ |

Run:

```bash
npm run test:telephony
# includes tests/lib/inbound-caller-validation.test.ts
```

---

## Manual verification checklist

1. Open Softphone V2 with DevTools console.
2. Place PSTN call to tenant DID.
3. **Before Accept:** confirm overlay shows number (and CNAM if present); log `inbound.callerFields` shows field snapshot.
4. **After Accept:** confirm name/number unchanged; no second `inbound.callerFields` identity change.
5. Decline test call; repeat with CNAM-enabled caller if available.

---

## Files

| File | Role |
|------|------|
| `web/src/lib/inbound-caller-display.ts` | Resolution chain, field snapshot, merge helpers |
| `web/src/lib/telephony/call-fsm.ts` | Sticky session labels |
| `web/src/app/(app)/softphone-v2/page.tsx` | Notification handler, field logging, pending hydrate |
| `web/src/lib/softphone-call-log-client.ts` | Pending caller fetch |
| `tests/lib/inbound-caller-validation.test.ts` | Scenario proof tests |
