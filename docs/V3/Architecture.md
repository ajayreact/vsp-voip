# Tenant Portal V3 — Architecture

**RC1:** v3.0.0-rc1

## Overview

Tenant Portal V3 is an admin/configuration layer in the VSP Phone monorepo. It manages tenant PBX configuration, health, billing, and optional sync to the telephony-v3 worker without replacing legacy Call Control in RC1.

## Layers

| Layer | Path | Role |
|-------|------|------|
| UI | `web/src/app/(app)/v3/` | 43 Next.js pages |
| Client | `web/src/lib/v3-api.ts` | Typed API wrappers |
| Nav | `web/src/lib/portal-nav.ts` | Gated by `NEXT_PUBLIC_V3_PORTAL` |
| Routes | `routes/v3.js` | 96 HTTP handlers @ `/api/v3` |
| Services | `lib/v3/*.js` | ~62 service modules |
| Runtime | `lib/v3/runtime/` | 10 adapters + enqueue |
| Schema | `prisma/schema.prisma` | 22 `V3*` models |

## Request Flow

1. JWT auth (`authMiddleware`)
2. Portal gate (`requireV3Enabled` → 404 if off)
3. Tenant check (`requireTenant` on mutations)
4. Role gate (`adminOnly`, `superAdminOnly`)
5. Service call with `tenantId` scope
6. Optional audit log (`auditService.log`)

## Phase Map

| Phase | Services | API prefix |
|-------|----------|------------|
| 1 | employee, health, repair, provisioning | `/employees`, `/health`, `/repair` |
| 2 | numberInventory, marketplace, assignment | `/numbers`, marketplace routes |
| 3 | device, deviceProvisioning, deviceHealth | `/devices` |
| 4 | callFlow, callFlowNode, simulation | `/callflows` |
| 5 | ringGroup, queue, businessHours, holiday, voicemail | `/ringgroups`, `/queues`, etc. |
| 6 | softphoneProfile, presence, directory | `/profile`, `/presence`, `/directory` |
| 7 | dashboard, analytics, report, monitoring | `/dashboard`, `/analytics` |
| 8 | billing, subscription, backup, lifecycle | `/billing`, `/backup` |
| 9 | runtimeSync, runtimeHealth | `/runtime` |
| 10 | migration, deployment, diagnostics | `/migration`, `/production-health` |

## Telephony Boundary

Protected files (`lib/inboundCallControl.js`, `lib/telnyxCallControl.js`, WebRTC stack) are **not modified** by V3 RC1. Runtime sync is opt-in.

## Deployment Notes

- API must mount `app.use('/api/v3', v3Routes)` — already in `server.js`
- Migrations before flag enablement

## Rollback

Disable `V3_PORTAL_ENABLED` and rebuild web without `NEXT_PUBLIC_V3_PORTAL`.

## Operations

Monitor `/ready`, tenant health at `/v3/health`, production health at `/v3/production-health`.
