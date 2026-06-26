# ADR: Call Control

## Problem

VSP needed inbound PSTN → WebRTC agent bridging, IVR, voicemail, recording, and transfer on a single carrier platform without maintaining SIP media infrastructure.

## Decision

Use **Telnyx Call Control API** as the primary server-side call state machine. VSP implements an event-driven FSM in `lib/inboundCallControl.js` driven by `POST /webhook/call-control` webhooks, with REST commands via `lib/telnyxCallControl.js`.

TeXML (`/webhook`) remains as legacy for PSTN-only routing during migration.

## Reason

Call Control provides programmatic answer, dial, bridge, transfer, gather, speak, and record on individual call legs — required for WebRTC agent legs alongside PSTN callers.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| TeXML-only | Cannot bridge WebRTC app legs cleanly |
| Self-hosted FreeSWITCH/Asterisk | Operational burden, no Telnyx PSTN integration |
| WebRTC-only (no Call Control) | No inbound DID orchestration |

## Trade-offs

| Pro | Con |
|-----|-----|
| No media on AWS | Webhook latency sensitivity |
| Rich call primitives | Dual TeXML + CC paths during migration |
| Carrier-grade PSTN | Telnyx vendor lock-in |

## Future impact

- New features extend `handleInboundCallControlEvent` — no parallel FSM
- Queues/conference use same webhook entry point
- Deprecate TeXML when all DIDs on Call Control app

**Related:** [../pbx/05-call-control.md](../pbx/05-call-control.md)
