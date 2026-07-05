# Event Sequence

Telnyx Call Control webhook events and VSP handler order for a typical inbound → WebRTC bridge call.

---

## Inbound PSTN → desk SIP / WebRTC agent (happy path — Telnyx Option A)

Official Telnyx lifecycle: answer inbound PSTN, `dial` with `link_to` + `bridge_on_answer: true`, then rely on `call.answered` and `call.bridged` (not `call.dial.answered`).

| # | Telnyx event | VSP handler | Session stage |
|---|--------------|-------------|---------------|
| 1 | `call.initiated` (incoming PSTN) | `handleCallInitiated` | `init` |
| 2 | — | `resolveInboundContext`, `saveSession` | `init` |
| 3 | — | `answerCall` (PSTN — always, before dial) | `init` |
| 4 | — | `dialDestination` (`link_to`, `bridge_on_answer: true`) | `connect` → `ringing` |
| 5 | `call.initiated` (outgoing dial leg) | `handleInboundAgentDialLegInitiated` → indexed + `outboundLegs` | `ringing` |
| 5b | `call.initiated` (incoming credential leg, voice webhook) | `handleInboundAgentCredentialRingInitiated` → indexed + `outboundLegs` | `ringing` |
| 6 | `call.answered` (dial leg **or** credential incoming leg) | `handleCallAnswered` → `onOutboundLegAnswered` | `connecting` |
| 7 | `call.bridged` (×2, auto via `bridge_on_answer`) | `handleCallBridged` → `markSessionBridged`, `indexActiveAgentCall` | `bridged` |
| 8 | — | `applyAnswerSideEffectsOnce` → recording | `bridged` |
| 9 | `call.hangup` | `handleHangup`, cleanup | `hangup_pending` |

`call.dial.answered` is handled only as a best-effort fallback (`handleDialAnswered` normalizes to `call.answered`); production path must not depend on it.

### Runtime log markers (desk SIP inbound)

| Expected Telnyx step | VSP log / stage |
|----------------------|-----------------|
| PSTN answered | `logInboundCallStart` after `answerCall` in `handleCallInitiated` |
| Dial leg created | `↳ Call Control dial sip:` then `inbound agent dial leg indexed` |
| Credential ring (if dual-leg) | `inbound agent credential ring indexed` |
| Agent picks up | `CALL_DIAL_ANSWERED` with `awaitingBridge: true`, `stage=connecting` |
| Bridge complete | `CALL_BRIDGED`, `stage=bridged`, `winnerLeg` set |

---

## Race: simultaneous ring

| Event | Handler | Redis |
|-------|---------|-------|
| Multiple `call.answered` / `call.bridged` | First wins via `claimConnectedLeg` on `call.bridged` | `ccs:winner:{inboundId}` SET NX |
| Loser legs | Hung up or ignored | — |
| Late `call.dial.ended` during `connecting` | Ignored (bridge grace) | stage check |

Validate: `npm run validate:rapid-accept-stress`

---

## No-answer → voicemail

| # | Event / action | Stage |
|---|----------------|-------|
| 1 | Ring timeout exhausted | `ringing` |
| 2 | `routeToVoicemailOrHangup` | — |
| 3 | `startVoicemailCapture` | `voicemail_prompt` |
| 4 | `call.speak.ended` | `voicemail_prompt` |
| 5 | `startVoicemailRecording` | `voicemail_record` |
| 6 | `call.recording.saved` | save VM, hangup |

Blocked if `stage === 'connecting'` or active winner during bridge grace.

---

## Blind transfer events

| # | Event | Handler |
|---|-------|---------|
| 1 | API `POST transfer/blind` | `initiateBlindTransfer` |
| 2 | Telnyx transfer initiated | outgoing leg |
| 3 | `call.bridged` | `handleTransferCallControlEvent` → success |
| 4 | `call.hangup` | agent leg cleanup |

---

## Outbound WebRTC (client-driven)

| # | Actor | Action |
|---|-------|--------|
| 1 | Client | `newCall` via SDK |
| 2 | Telnyx | PSTN leg + WebRTC negotiation |
| 3 | Client | Optional `POST record-start` |
| 4 | Telnyx | `call.recording.saved` if recording |

Minimal VSP webhook involvement for pure outbound WebRTC unless recording.

---

## Recording webhook

| Event | Routes to |
|-------|-----------|
| `call.recording.saved` | `handleCallControlRecordingWebhook` |
| client_state.voicemail | `saveVoicemailFromCallControlEvent` |
| else | `saveCallRecordingFromCallControlEvent` |

---

## SDK events (parallel track)

| SDK event | Client action |
|-----------|---------------|
| `telnyx.notification` (ringing) | Show inbound UI |
| User answer | `call-accepted` → `call.answer()` |
| `telnyx.notification` (active) | `wireWebCallAudio` |
| `telnyx.notification` (hangup) | Clear UI |

---

## Related docs

- [02-call-flow.md](./02-call-flow.md)
- [05-call-control.md](./05-call-control.md)
- [06-session-management.md](./06-session-management.md)
- [15-blind-transfer.md](./15-blind-transfer.md)
