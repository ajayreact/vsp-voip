# Conference Calls

Multi-party conferences — **NOT implemented** in VSP Phone.

---

## Status

| Capability | Status |
|------------|--------|
| Telnyx conference create/join | ❌ Not in VSP code |
| Conference API routes | ❌ |
| Softphone conference UI | ❌ |
| Attended transfer 3-way consult | ❌ Planned Phase 3 |

Telnyx reference: [docs/telnyx/conferences/](../../telnyx/conferences/)

---

## Planned use cases

1. **Attended transfer consult** — temporary 3-way before complete
2. **Ad-hoc conference** — agent adds participants
3. **Scheduled conference bridges** — future enterprise feature

---

## Implementation guidance (future)

When adding conferences:

- Use Telnyx Call Control conference commands — do not duplicate media bridging in VSP
- Store conference metadata tenant-scoped in Prisma
- Redis session for conference leg mapping
- Do not bypass existing inbound `ccs:*` session lifecycle
- Webhook handlers extend `handleInboundCallControlEvent` pattern

See [docs/call-transfer-implementation-plan.html](../../call-transfer-implementation-plan.html) Phase 3

---

## Related docs

- [16-attended-transfer.md](./16-attended-transfer.md)
- [24-future-roadmap.md](./24-future-roadmap.md)
- [../features.md](../features.md)
