# Event Sequence

Telnyx Call Control webhook events and VSP handler order for a typical inbound → WebRTC bridge call.

---

## Inbound PSTN → WebRTC agent (happy path)

| # | Telnyx event | VSP handler | Session stage |
|---|--------------|-------------|---------------|
| 1 | `call.initiated` (incoming) | `handleCallInitiated` | `init` |
| 2 | — | `resolveInboundContext`, `saveSession` | `init` |
| 3 | — | `answerCall` (PSTN) | `init` |
| 4 | — | `startConnectFlow` → dial targets | `connect` → `ringing` |
| 5 | `call.initiated` (outgoing leg) | leg indexed | `ringing` |
| — | Client: `POST call-accepted` | `markAgentWebRtcAccepted` | `connecting` |
| 6 | Client: SDK `call.answer()` | — | `connecting` |
| 7 | `call.dial.answered` | `handleDialAnswered` | `connecting` |
| 8 | `call.bridged` | `handleCallBridged`, `indexActiveAgentCall` | `bridged` |
| 9 | — | `applyAnswerSideEffectsOnce` → recording | `bridged` |
| 10 | `call.hangup` | `handleHangup`, cleanup | `hangup_pending` |

---

## Race: simultaneous ring

| Event | Handler | Redis |
|-------|---------|-------|
| Multiple `call.dial.answered` | First wins via `claimConnectedLeg` | `ccs:winner:{inboundId}` SET NX |
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
