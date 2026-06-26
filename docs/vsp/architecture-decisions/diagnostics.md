# ADR: WebRTC Diagnostics

## Problem

One-way audio and ICE failures are hard to diagnose from server logs alone because RTP does not traverse VSP API.

## Decision

Add **passive** WebRTC diagnostics — registry and `/softphone-v2/diagnostics` page that reads RTCPeerConnection stats, ICE states, and RTP counters during active calls. No change to telephony logic; hooks run after existing `wireWebCallAudio()`.

Modules: `web/src/lib/webrtc-diagnostics.ts`, `webrtc-diagnostics-registry.ts`, diagnostics page.

## Reason

Separates evidence gathering from fix attempts. Office vs home comparisons distinguish firewall issues from deployment regressions.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| Server-side RTP stats | No visibility into browser path |
| Always-on verbose SDK logging | Noise in production |
| Third-party monitoring SaaS | Cost; data privacy |

## Trade-offs

| Pro | Con |
|-----|-----|
| Export JSON for tickets | Requires frontend deploy to access |
| Zero media path change | Does not fix issues — informs them |
| Reuses existing PC attachment | Protected page — minimal hooks only |

## Future impact

- Diagnostics 404 = deployment issue, not media bug
- Capture checklist: `scripts/office-webrtc-capture-checklist.md`

**Related:** [../pbx/04-webrtc-media.md](../pbx/04-webrtc-media.md), [../deployment/13-monitoring.md](../deployment/13-monitoring.md)
