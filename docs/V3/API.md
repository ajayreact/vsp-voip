# Tenant Portal V3 — API Reference

**Version:** v3.0.0-rc1  
**Base path:** `/api/v3`  
**Auth:** Bearer JWT (all routes)  
**Gate:** Returns 404 when `V3_PORTAL_ENABLED` is not truthy

Implementation: `routes/v3.js`

---

## Authentication & Authorization

- Header: `Authorization: Bearer <token>`
- Tenant scope: derived from JWT `tenantId`
- Role middleware: `adminOnly` (TENANT_ADMIN | SUPER_ADMIN), `superAdminOnly`

---

## Phase 1 — Employees & Health

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/employees` | Admin | List employees |
| POST | `/employees` | Admin | Create employee |
| GET | `/health` | Admin | PBX health summary |
| POST | `/repair` | Admin | Repair actions |
| GET | `/audit` | Admin | Audit log |

---

## Phase 2 — Numbers

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/numbers` | Admin | Inventory list |
| POST | `/numbers/sync` | Admin | Telnyx sync |
| GET | `/marketplace` | Admin | Marketplace catalog |
| GET/POST | `/assignments` | Admin | DID assignments |

---

## Phase 3 — Devices

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET/POST | `/devices` | Admin | Device CRUD |
| POST | `/devices/provision` | Admin | Provision device |
| GET | `/devices/health` | Admin | Device health |

---

## Phase 4–5 — Call Flows & PBX Objects

| Prefix | Description |
|--------|-------------|
| `/callflows` | Call flow CRUD, nodes, validation, simulate |
| `/ring-groups` | Ring group config |
| `/queues` | Queue config |
| `/business-hours` | Hours rules |
| `/holidays` | Holiday calendar |
| `/voicemail` | Voicemail boxes |

---

## Phase 6 — Softphone UX

| Prefix | Description |
|--------|-------------|
| `/profile` | Softphone profile |
| `/preferences` | User preferences |
| `/presence` | Presence status |
| `/directory` | Contact directory |

---

## Phase 7 — Operations

| Prefix | Description |
|--------|-------------|
| `/dashboard` | Dashboard aggregates |
| `/analytics` | Analytics data |
| `/reports` | Report generation |
| `/monitoring` | Monitoring feeds |
| `/activity` | Activity log |
| `/notifications` | Notification center |

---

## Phase 8 — Billing & Lifecycle

| Prefix | Description |
|--------|-------------|
| `/billing` | Billing info |
| `/subscription` | Subscription (PUT: super-admin) |
| `/license` | License status |
| `/lifecycle` | Tenant lifecycle |
| `/backups` | Backup CRUD + restore |
| `/export`, `/import` | Tenant export/import |

---

## Phase 9 — Runtime

| Prefix | Description |
|--------|-------------|
| `/runtime` | Sync status |
| `/runtime/health` | Runtime health |
| `/runtime/jobs` | Job list |
| `/runtime-validation` | Validation runs |
| `/rollback` | Runtime rollback |

---

## Phase 10 — Production

| Prefix | Description |
|--------|-------------|
| `/deployment` | Deployment status |
| `/migration` | Tenant migration runs |
| `/diagnostics` | Diagnostics |
| `/production-health` | Production health |
| `/metrics` | Metrics |
| `/system-health` | System health |

---

## Test Lab (Super Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/test-lab/status` | Lab enabled state |
| POST | `/test-lab/run` | Execute test suite |
| GET | `/test-lab/runs` | Run history |
| GET | `/test-lab/runs/:id` | Run detail |

---

## Migration Wizard (Super Admin)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/migration-wizard/discover` | Step 1 |
| POST | `/migration-wizard/validate` | Step 2 |
| POST | `/migration-wizard/preview` | Step 3 |
| POST | `/migration-wizard/run` | Step 4 |
| POST | `/migration-wizard/post-validate` | Step 5 |
| POST | `/migration-wizard/rollback` | Step 6 |

---

## Error Format

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_CODE"
}
```

Common codes: `TEST_LAB_DISABLED`, `TENANT_MISMATCH`, `RUNTIME_SYNC_DISABLED`

---

## Rate Limits

Applied per route group: `searchLimiter`, `billingLimiter`, `v3RepairLimiter`, `v3HeavyMutationLimiter` — see `lib/rateLimit.js`.

---

## Client SDK

TypeScript client: `web/src/lib/v3-api.ts`

---

## Related

- [Architecture.md](./Architecture.md)
- `docs/vsp/pbx/20-api-reference.md` (legacy PBX APIs)
