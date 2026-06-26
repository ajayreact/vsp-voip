# ADR: Redis Session Store

## Problem

Call Control webhooks are stateless HTTP callbacks. Multi-leg inbound calls (simultaneous ring, bridge races, transfer) require fast, shared, ephemeral state across webhook invocations.

## Decision

Store Call Control sessions in **Redis** with key prefix `ccs:*` (inbound) and `cts:*` (transfer). TTL 3600s. Fall back to in-process `Map` only when Redis unavailable (development).

## Reason

Redis provides sub-millisecond reads, atomic SET NX for winner races, and shared state if API scales horizontally.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| Postgres only | Too slow for webhook hot path; row locking complexity |
| In-memory only | Lost on restart; breaks multi-instance |
| Telnyx client_state only | Size limits; awkward for complex FSM |

## Trade-offs

| Pro | Con |
|-----|-----|
| Atomic race handling | Another infra dependency |
| Fast session lookup | Sessions lost if Redis flushed |
| Clean separation from CDR | Must require Redis in production |

## Future impact

- Horizontal API scaling **requires** Redis — disable in-memory fallback in prod
- Queue/conference state should use same Redis cluster with new prefixes
- Never duplicate session stores in new modules

**Code:** `lib/callControlSessionStore.js`

**Related:** [../pbx/06-session-management.md](../pbx/06-session-management.md)
