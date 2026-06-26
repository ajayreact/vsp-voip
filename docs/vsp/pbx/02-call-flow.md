# Call Flow

Overview of inbound, outbound, and internal call paths in the current VSP Phone implementation.

---

## Inbound call flow

PSTN caller dials a tenant DID assigned to Telnyx Call Control.

```mermaid
sequenceDiagram
  participant PSTN as PSTN Caller
  participant TX as Telnyx Call Control
  participant API as VSP API
  participant RD as Redis Session
  participant WEB as Softphone V2
  participant AGT as Agent Browser

  PSTN->>TX: Inbound to DID
  TX->>API: POST /webhook/call-control call.initiated
  API->>API: resolveInboundContext (DID → tenant)
  API->>RD: saveSession (stage=init)
  API->>TX: answerCall (PSTN leg)
  alt IVR enabled and not mobile-only ring
    API->>TX: gather / speak (IVR)
  else Extension policy / ring targets
    API->>API: resolveRingTargetsForSession
    API->>TX: dialDestination (SIP/WebRTC targets)
  end
  TX->>AGT: WebRTC INVITE
  WEB->>API: POST /api/softphone/call-accepted
  API->>RD: markAgentWebRtcAccepted (stage=connecting)
  AGT->>TX: call.answer() + localStream
  TX->>API: call.bridged
  API->>RD: markSessionBridged, indexActiveAgentCall
  Note over PSTN,AGT: RTP: PSTN ↔ Telnyx ↔ WebRTC
```

**Primary handler:** `handleInboundCallControlEvent` → `handleCallInitiated` in `lib/inboundCallControl.js`

**Legacy path:** TeXML webhook `GET/POST /webhook` via `lib/callRouting.js` — still active for some PSTN-only configs; app routing may trigger Call Control migration.

---

## Outbound call flow

Agent places call from Softphone V2.

```mermaid
sequenceDiagram
  participant WEB as Softphone V2
  participant API as VSP API
  participant TX as Telnyx WebRTC
  participant PSTN as Remote Party

  WEB->>API: GET /api/softphone/config
  WEB->>API: POST /api/softphone/token
  WEB->>TX: TelnyxRTC.connect(login_token)
  WEB->>WEB: resolveOutboundDestination (ext vs PSTN)
  WEB->>TX: client.newCall({ destinationNumber, callerNumber })
  TX->>PSTN: PSTN dial-out
  PSTN->>TX: answer
  Note over WEB,PSTN: WebRTC ICE + RTP when connected
  opt Manual recording
    WEB->>API: POST /api/softphone/record-start
    API->>TX: record_start (Call Control)
  end
```

**Frontend:** `web/src/app/(app)/softphone-v2/page.tsx` — `onCallWithDestination`  
**Dial normalization:** `web/src/lib/softphone-dial.ts` — `resolveOutboundDestination`  
**Token:** `lib/softphone.js` — `createSoftphoneLoginToken`

---

## Internal extension call

Extension-to-extension via Call Control (API-initiated or dial by extension number).

```mermaid
sequenceDiagram
  participant A as Agent A
  participant API as VSP API
  participant TX as Telnyx
  participant B as Agent B

  A->>API: POST /api/softphone/internal-call (optional)
  Note over API,TX: Or inbound to extension DID / ring group ext
  API->>TX: dial internal SIP/WebRTC target
  TX->>B: INVITE
  B->>TX: answer
  TX->>API: call.bridged
```

**Handler:** `lib/internalExtensionDial.js` — `initiateInternalCallFromApi`, `handleInternalExtensionCallInitiated`

---

## Blind transfer flow

See [15-blind-transfer.md](./15-blind-transfer.md).

```mermaid
sequenceDiagram
  participant AGT as Agent
  participant API as VSP API
  participant RD as Redis
  participant TX as Telnyx

  AGT->>API: POST /api/softphone/transfer/blind
  API->>RD: resolveActiveBridgedCallForAgent
  API->>RD: save transfer session (cts:*)
  API->>TX: transferCall (PSTN caller leg)
  TX->>API: call.bridged / call.hangup webhooks
  API->>RD: finalizeTransfer, clearActiveAgentCall
```

---

## Future warm transfer (planned)

Not implemented. Planned sequence in [16-attended-transfer.md](./16-attended-transfer.md).

```mermaid
sequenceDiagram
  participant A as Agent A
  participant API as VSP API
  participant TX as Telnyx
  participant C as Consult Target
  participant PSTN as Caller

  Note over A,PSTN: Phase 2 — NOT in production code
  A->>API: POST transfer/attended/start
  API->>TX: hold caller, dial consult leg
  C->>TX: answer consult
  A->>API: POST transfer/attended/complete
  API->>TX: bridge caller to C, hangup A
```

---

## Recording lifecycle (summary)

See [13-call-recording.md](./13-call-recording.md).

```mermaid
flowchart LR
  A[Call answered] --> B{Recording enabled?}
  B -->|Inbound auto| C[startCallRecording]
  B -->|Outbound manual| D[POST record-start]
  C --> E[Telnyx records]
  D --> E
  E --> F[call.recording.saved webhook]
  F --> G[saveCallRecordingFromCallControlEvent]
  G --> H[(CallRecording)]
```

---

## Voicemail lifecycle (summary)

See [14-voicemail.md](./14-voicemail.md).

```mermaid
flowchart TD
  A[No answer / DND / after-hours] --> B{Bridge grace active?}
  B -->|Yes| Z[Block VM routing]
  B -->|No| C[startVoicemailCapture]
  C --> D[speak prompt]
  D --> E[startVoicemailRecording]
  E --> F[call.recording.saved]
  F --> G[saveVoicemailFromCallControlEvent]
  G --> H[(Voicemail)]
  G --> I[hangupCall]
```

---

## Dual webhook entry points

| Webhook | Handler | Use |
|---------|---------|-----|
| `POST /webhook/call-control` | `handleInboundCallControlEvent` | Primary — WebRTC inbound, transfer, VM |
| `GET/POST /webhook` | TeXML / `lib/callRouting.js` | Legacy PSTN routing |

Routing migration: `lib/inboundRouting.js` — `requiresCallControlRouting`

---

## Related docs

- [05-call-control.md](./05-call-control.md)
- [08-did-routing.md](./08-did-routing.md)
- [09-extension-routing.md](./09-extension-routing.md)
- [21-event-sequence.md](./21-event-sequence.md)
