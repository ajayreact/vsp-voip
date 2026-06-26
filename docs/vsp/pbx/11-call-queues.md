# Call Queues

Automatic Call Distribution (ACD) queues — **NOT implemented** in VSP Phone.

---

## Current status

| Aspect | Status |
|--------|--------|
| Telnyx `enqueue` API usage | ❌ Not in codebase |
| Queue models in Prisma | ❌ None |
| Portal UI | ❌ None |
| Webhook handlers | ❌ None |

Reference Telnyx docs only: [docs/telnyx/call-control/guides/queueing-calls.md](../../telnyx/call-control/guides/queueing-calls.md)

---

## What exists today instead

| Feature | Replacement |
|---------|-------------|
| Multiple agents | Ring groups (simultaneous / sequential) |
| Hunt groups | Extension multi-device simultaneous dial |
| Agent wait | Sequential ring with timeout → voicemail |

---

## Planned approach (future)

When implementing queues:

1. Extend Call Control webhook handler — do not duplicate FSM
2. Store queue state in Redis alongside `ccs:*` sessions
3. Tenant-scoped queue definitions in Prisma
4. Reuse `resolveRingTargets` patterns for agent selection
5. Do **not** bypass existing bridge grace or VM guards

See [24-future-roadmap.md](./24-future-roadmap.md)

---

## Related docs

- [10-ring-groups.md](./10-ring-groups.md)
- [../features.md](../features.md)
