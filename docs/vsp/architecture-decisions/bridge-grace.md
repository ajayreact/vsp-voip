# ADR: Bridge Grace

## Problem

When an agent accepts an inbound WebRTC call, Telnyx may emit `call.dial.ended` on losing ring legs **before** `call.bridged` completes. Without coordination, the inbound session could route to voicemail or hang up while the agent is answering — dropping the bridge.

## Decision

Introduce **bridge grace**: client calls `POST /api/softphone/call-accepted` **before** `call.answer()`, setting Redis session `stage=connecting`. Voicemail and no-answer teardown are blocked while `stage === 'connecting'` or an active winner exists.

## Reason

Separates SDK timing (WebRTC answer) from server-side Call Control FSM. The API must know the agent committed to answer before treating dial failures as final.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| Rely on `call.bridged` only | Too late — VM may already trigger |
| Client-only grace timer | Not authoritative; refresh loses state |
| Disable voicemail on all inbound | Breaks legitimate no-answer VM |

## Trade-offs

| Pro | Con |
|-----|-----|
| Reliable inbound WebRTC bridge | Extra API round-trip before answer |
| Protects against race webhooks | Client must call endpoint reliably |
| Minimal change to winner-claim | Protected code — regression risk |

## Future impact

- Attended transfer must **not** modify bridge-grace winner logic
- Extend transfer only after `stage === 'bridged'`
- Validate with `npm run validate:rapid-accept-stress`

**Code:** `markAgentWebRtcAccepted` in `lib/inboundCallControl.js`, `lib/callControlSessionStore.js`

**Related:** [../pbx/06-session-management.md](../pbx/06-session-management.md)
