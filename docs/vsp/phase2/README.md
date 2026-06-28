# VSP Phone — Phase 2

Approved architecture and implementation plan. **Do not add telephony features until each phase is complete and deployed.**

| Phase | Status | Document |
|-------|--------|----------|
| **2.1** Architecture freeze | **Done** | [01-architecture-freeze.md](./01-architecture-freeze.md) |
| **Pre-2.2** Multi-tenant isolation audit | **Done** | [05-multi-tenant-extension-isolation-audit.md](./05-multi-tenant-extension-isolation-audit.md) |
| **Planning** Architecture review | **Done** | [04-architecture-review-and-plan.md](./04-architecture-review-and-plan.md) |
| 2.2 Browser → admin portal | Pending approval | [03-implementation-phases.md](./03-implementation-phases.md#phase-22--browser-becomes-admin-portal) |
| 2.3 Mobile primary client | Pending | [03-implementation-phases.md](./03-implementation-phases.md#phase-23--mobile-becomes-primary-client) |
| 2.4 Extension architecture | Pending | [03-implementation-phases.md](./03-implementation-phases.md#phase-24--extension-architecture) |
| 2.5 QR provisioning | Pending | [03-implementation-phases.md](./03-implementation-phases.md#phase-25--qr-provisioning) |
| 2.6 Desk phone | Pending | [03-implementation-phases.md](./03-implementation-phases.md#phase-26--desk-phone) |
| 2.7 Tenant portal redesign | Pending | [03-implementation-phases.md](./03-implementation-phases.md#phase-27--tenant-portal-redesign) |

## Related docs

- [Deprecated modules](./02-deprecated-modules.md) — paths scheduled for removal after stabilization
- [PBX call flow](../pbx/02-call-flow.md) — current runtime behavior (pre–Phase 2.4)
- [Telnyx Call Control ADR](../architecture-decisions/call-control.md)

## Rules (all phases)

1. Each phase builds successfully.
2. Each phase passes existing tests.
3. No unrelated code changes.
4. One git commit per phase.
5. Wait for approval before starting the next phase.
6. All telephony changes follow [Telnyx Call Control Pattern 1](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals).
