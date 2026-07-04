# ADR: DID Assignment

## Problem

Telnyx phone numbers must map to the correct tenant, extension, ring group, or user for inbound routing, with audit trail when numbers move between customers.

## Decision

- Sync Telnyx numbers via admin `POST /api/admin/numbers/sync` into `PhoneNumber` Prisma rows
- Assign routing via `routingType` + foreign keys (`extensionId`, `ringGroupId`, `assignedUserId`)
- Overlay per-DID settings on tenant `Greeting` via `applyNumberRoutingToGreeting`
- Audit moves in `DidAssignmentHistory`

Inbound resolution: `resolveInboundContext` in `lib/inboundCallControl.js`.

## Reason

Separates carrier inventory (Telnyx) from tenant dial plan (VSP DB) while supporting multiple routing strategies per DID.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| Telnyx-only assignment | No tenant metadata in VSP |
| Greeting-only routing | No per-DID flexibility |
| Manual DB edits | No sync or audit |

## Trade-offs

| Pro | Con |
|-----|-----|
| Flexible routing types | Sync drift if admin skips sync |
| Audit history | Two sources of truth (Telnyx + DB) |
| Admin portal assignment | Requires disciplined sync process |

## Future impact

- Self-service number purchase adds webhook + auto-assignment
- DID sync diagnostics: `scripts/diagnose-did-sync.js`

**Related:** [../pbx/08-did-routing.md](../pbx/08-did-routing.md)
