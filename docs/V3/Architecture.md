# Tenant Portal V3 — Architecture

**Version:** v3.0.0-rc1  
**Last updated:** 2026-07-03

---

## System Context

Tenant Portal V3 is an **administration and configuration layer** inside the existing VSP Phone monorepo. It does not replace legacy Call Control (`lib/inboundCallControl.js`, `lib/telnyxCallControl.js`) or WebRTC softphone V2 in RC1.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js) — /v3/* pages, portal-nav, v3-api.ts         │
└────────────────────────────┬────────────────────────────────────┘
                             │ JWT auth
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express API — routes/v3.js @ /api/v3                         │
│  Gate: V3_PORTAL_ENABLED → requireV3Enabled (404 when off)    │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ lib/v3/*        │ │ PostgreSQL      │ │ Redis (runtime jobs) │
│ Services        │ │ Prisma models   │ │ via runtimeEnqueue   │
└────────┬────────┘ └─────────────────┘ └──────────┬───────────┘
         │                                           │
         │ Phase 9 bridge (optional)                 ▼
         └──────────────────────────────► telephony-v3-worker
                                          lib/telephony-v3/*
```

---

## Layer Model

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **UI** | `web/src/app/(app)/v3/` | Tenant admin pages, ops dashboards |
| **API client** | `web/src/lib/v3-api.ts` | Typed fetch wrappers |
| **Navigation** | `web/src/lib/portal-nav.ts` | V3 nav gated by `NEXT_PUBLIC_V3_PORTAL` |
| **HTTP routes** | `routes/v3.js` | Auth, rate limits, role checks |
| **Services** | `lib/v3/*.js` | Business logic, tenant scoping |
| **Runtime adapters** | `lib/v3/runtime/*.js` | Enqueue sync jobs to telephony worker |
| **Schema** | `prisma/schema.prisma` + migrations | V3 entities |
| **Tests** | `tests/v3/` | Unit tests (130 tests) |

---

## Portal Phases (Logical)

Routes in `routes/v3.js` are grouped by phase:

1. **Employees & PBX health** — core tenant objects
2. **Number inventory** — Telnyx DID sync, marketplace, assignments
3. **Desk phones** — devices, templates, provisioning
4. **Call flows** — builder engine + simulator (config only)
5. **PBX objects** — ring groups, queues, hours, holidays, voicemail
6. **Softphone UX** — profiles, presence, directory (management only)
7. **Operations** — dashboard, analytics, reports, monitoring
8. **Billing & lifecycle** — subscription, backups, import/export
9. **Runtime bridge** — sync configuration to telephony-v3
10. **Production readiness** — migration, diagnostics, production health

**Post-phase additions (RC1):**

- **Test Lab** — `lib/v3/testLabService.js`
- **Migration Wizard** — `lib/v3/migrationWizardService.js`

---

## Security Model

- All routes require JWT (`authMiddleware`) and `V3_PORTAL_ENABLED`
- Tenant isolation: `req.user.tenantId` scopes queries
- Role gates:
  - `TENANT_ADMIN` / `SUPER_ADMIN` for most mutations
  - `superAdminOnly` for Test Lab, Migration Wizard, subscription PUT, marketplace admin
- Runtime sync disabled by default (`V3_RUNTIME_SYNC_ENABLED=false`)

---

## Telephony Boundary

| Component | RC1 Status |
|-----------|------------|
| Portal config (Phases 1–8) | ✅ Active when flag on |
| Runtime sync (Phase 9) | ⚠️ Opt-in per environment/tenant |
| Live call routing via V3 | ❌ Requires worker + executor flags |
| Legacy Call Control | ✅ Production path unchanged |

Protected telephony files are **not modified** by Portal V3 RC1.

---

## Related Documentation

- [Deployment.md](./Deployment.md)
- [Environment.md](./Environment.md)
- [RuntimeSync.md](./RuntimeSync.md)
- Internal: `docs/vsp/deployment/18-v3-production-operations-runbook.md`
