# ADR: WebRTC Media Architecture

## Problem

Browser softphones need real-time voice without VSP operating media servers or exposing Telnyx API keys to clients.

## Decision

- Use **Telnyx WebRTC JS SDK** (`@telnyx/webrtc`) in Softphone V2
- Issue telephony credential JWT via `POST /api/softphone/token`
- Media path: browser ↔ Telnyx (ICE/STUN/TURN) ↔ PSTN/SIP
- VSP handles signaling coordination (call-accepted) and CDR — not RTP

Client modules: `telnyx-softphone-session.ts`, `webrtc-audio.ts`, `softphone-v2/page.tsx`.

## Reason

Offloads NAT traversal, codec negotiation, and carrier interconnect to Telnyx. Matches Telnyx-recommended browser integration.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| SIP.js to Telnyx SIP | Less integrated than official SDK |
| VSP TURN/media relay | Cost and complexity |
| WebRTC via Call Control only | CC does not carry browser media |

## Trade-offs

| Pro | Con |
|-----|-----|
| No RTP on AWS | Office firewall / TURN issues |
| Official SDK support | SDK version coupling (2.27.1) |
| Simple scaling | Media debugging requires client stats |

## Future impact

- Flutter uses Telnyx Flutter SDK — same token endpoint
- Media fixes target protected files — regression analysis required
- Diagnostics page for ICE/RTP evidence without changing call logic

**Related:** [../pbx/04-webrtc-media.md](../pbx/04-webrtc-media.md)
