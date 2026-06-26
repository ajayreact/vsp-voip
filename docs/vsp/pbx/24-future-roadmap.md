# Future Roadmap

Planned PBX capabilities not yet in production code. Status also tracked in [../features.md](../features.md).

---

## Transfer & conference

| Feature | Phase | Reference |
|---------|-------|-----------|
| Attended (warm) transfer | Phase 2 | [16-attended-transfer.md](./16-attended-transfer.md) |
| Conference / 3-way consult | Phase 3 | [17-conference-calls.md](./17-conference-calls.md) |
| SIP REFER transfer | Phase 4 optional | call-transfer plan |

---

## Contact center

| Feature | Status |
|---------|--------|
| Call queues (ACD) | Planned — Telnyx enqueue |
| Agent skills / priorities | Planned |
| SLA / queue callbacks | Future |
| Receptionist console | Planned — audit |

---

## IVR & routing

| Feature | Status |
|---------|--------|
| Multi-level IVR | Planned |
| AI gather | Future |
| Business hours per-DID | Partial — greeting overlay |
| Call parking | Future |

---

## Presence & collaboration

| Feature | Status |
|---------|--------|
| Presence-aware routing | Planned — use `softphoneOnlineAt` |
| Team presence UI | Planned |
| SMS unified inbox | Partial — SMS exists, push gaps on mobile |
| CRM integration | Future |

---

## Media & AI

| Feature | Status |
|---------|--------|
| AI call summary | Future |
| Transcription | Future |
| Real-time admin WebSocket dashboard | Planned Phase 2 |

---

## Platform

| Feature | Status |
|---------|--------|
| ECS / multi-region | Future — see launch deployment guide |
| Desktop app (Electron) | Future |
| iOS mobile | Future |
| Fax | Future |

---

## Implementation principles

When building roadmap items:

1. Read [../architecture-decisions/](../architecture-decisions/) first
2. Extend Call Control FSM — no parallel call flows
3. Reuse Redis session patterns (`ccs:*`, `cts:*`)
4. Maintain tenant isolation
5. Regression-test bridge grace and voicemail guards

Cursor rule: [.cursor/rules/pbx-architecture.mdc](../../../.cursor/rules/pbx-architecture.mdc)

---

## Related docs

- [../features.md](../features.md)
- [docs/call-transfer-implementation-plan.html](../../call-transfer-implementation-plan.html)
- [docs/COMPLETE-APPLICATION-AUDIT.md](../../COMPLETE-APPLICATION-AUDIT.md)
