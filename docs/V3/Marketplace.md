# Tenant Portal V3 — Marketplace

**RC1:** v3.0.0-rc1

## Purpose

Phase 2 number marketplace: search available DIDs, purchase, reserve, release via Telnyx integration.

## Services

- `lib/v3/marketplaceService.js`
- `lib/v3/numberInventoryService.js`
- `lib/v3/telnyxNumberService.js`
- `lib/v3/assignmentService.js`

## API

| Method | Path | Role |
|--------|------|------|
| POST | `/api/v3/numbers/search` | Super-admin |
| POST | `/api/v3/numbers/purchase` | Super-admin |
| POST | `/api/v3/numbers/release` | Super-admin |
| GET | `/api/v3/numbers` | Admin |
| POST | `/api/v3/numbers/assign` | Admin |
| POST | `/api/v3/numbers/unassign` | Admin |
| GET | `/api/v3/numbers/health` | Admin |

## UI

- `/v3/numbers` — inventory
- `/v3/assignments` — DID assignments
- `/v3/marketplace` — search/purchase (super-admin guard on UI)

## Auth

Purchase/search/release require `SUPER_ADMIN`. Tenant admins manage assignments within their tenant.

## Audit

Purchase and release operations logged via `auditService`.

## Deployment

Requires valid `TELNYX_API_KEY` and telephony readiness checks (`telnyxService.getTenantTelephonyReadiness`).

## Rollback

Release numbers via super-admin release endpoint. Assignment changes reversible via unassign.

## Operations

Verify Telnyx account balance before bulk purchase. Rate limits: `searchLimiter`, `billingLimiter` on purchase.
