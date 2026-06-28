# VSP Phone — PBX Architecture

Internal reference for how VSP Phone implements multi-tenant PBX on Telnyx Call Control + WebRTC.

**Phase 2 (approved):** [../phase2/README.md](../phase2/README.md) — mobile-primary, browser admin-only.

**Start here:** [01-system-architecture.md](./01-system-architecture.md)

---

## Guides

| # | Topic | Document |
|---|-------|----------|
| 01 | System architecture | [01-system-architecture.md](./01-system-architecture.md) |
| 02 | Call flow overview | [02-call-flow.md](./02-call-flow.md) |
| 03 | WebSocket lifecycle | [03-websocket-lifecycle.md](./03-websocket-lifecycle.md) |
| 04 | WebRTC media | [04-webrtc-media.md](./04-webrtc-media.md) |
| 05 | Call Control | [05-call-control.md](./05-call-control.md) |
| 06 | Session management | [06-session-management.md](./06-session-management.md) |
| 07 | Multitenancy | [07-multitenancy.md](./07-multitenancy.md) |
| 08 | DID routing | [08-did-routing.md](./08-did-routing.md) |
| 09 | Extension routing | [09-extension-routing.md](./09-extension-routing.md) |
| 10 | Ring groups | [10-ring-groups.md](./10-ring-groups.md) |
| 11 | Call queues | [11-call-queues.md](./11-call-queues.md) |
| 12 | IVR | [12-ivr.md](./12-ivr.md) |
| 13 | Call recording | [13-call-recording.md](./13-call-recording.md) |
| 14 | Voicemail | [14-voicemail.md](./14-voicemail.md) |
| 15 | Blind transfer | [15-blind-transfer.md](./15-blind-transfer.md) |
| 16 | Attended transfer | [16-attended-transfer.md](./16-attended-transfer.md) |
| 17 | Conference calls | [17-conference-calls.md](./17-conference-calls.md) |
| 18 | Presence | [18-presence.md](./18-presence.md) |
| 19 | Mobile app | [19-mobile-app.md](./19-mobile-app.md) |
| 20 | API reference | [20-api-reference.md](./20-api-reference.md) |
| 21 | Event sequence | [21-event-sequence.md](./21-event-sequence.md) |
| 22 | Security | [22-security.md](./22-security.md) |
| 23 | Performance | [23-performance.md](./23-performance.md) |
| 24 | Future roadmap | [24-future-roadmap.md](./24-future-roadmap.md) |

---

## Related

| Topic | Location |
|-------|----------|
| Feature status matrix | [../features.md](../features.md) |
| Architecture decisions (ADRs) | [../architecture-decisions/](../architecture-decisions/) |
| Telnyx mapping | [../../telnyx/architecture.md](../../telnyx/architecture.md) |
| Deployment | [../deployment/README.md](../deployment/README.md) |
| Telephony validation | [../deployment/14-telephony-validation.md](../deployment/14-telephony-validation.md) |

---

## Validation

- [VALIDATION.md](./VALIDATION.md)
- `npm run validate:pbx-docs`

---

## Cursor rules

- [.cursor/rules/pbx-architecture.mdc](../../../.cursor/rules/pbx-architecture.mdc)
- [.cursor/rules/protected-telephony-components.mdc](../../../.cursor/rules/protected-telephony-components.mdc)
