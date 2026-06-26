# ADR: Tenant-Scoped Extensions

## Problem

Multi-tenant PBX requires extension numbers (e.g. `102`) to be unique **within a tenant** but reusable across tenants, with isolated routing, voicemail, and security policies.

## Decision

Model extensions as `Extension` rows with required `tenantId`. All extension API routes and inbound resolution scope queries by tenant from JWT or DID-derived tenant. Internal dial resolves extension within tenant context only.

## Reason

Prevents cross-tenant call leakage and matches PBX admin mental model (each customer has their own dial plan).

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| Global extension namespace | Collision across tenants |
| Extension = User only | No multi-device, forwarding, or desk SIP |
| Telnyx-side tenant split | Platform uses shared Call Control app |

## Trade-offs

| Pro | Con |
|-----|-----|
| Clear isolation | Extension number uniqueness enforced per tenant in app |
| Rich per-extension policy | More complex than single-user SIP |
| Supports ring groups | Duplicate extension digits OK across tenants |

## Future impact

- Queue agents reference tenant-scoped extensions
- Outbound permission enforcement must query same tenant scope
- Super admin cross-tenant views need explicit role bypass

**Related:** [../pbx/07-multitenancy.md](../pbx/07-multitenancy.md), [../pbx/09-extension-routing.md](../pbx/09-extension-routing.md)
