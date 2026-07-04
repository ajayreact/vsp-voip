# V3.0.0 — API Reference

**Base URL:** `https://api.vspphone.com/api/v3`  
**Gate:** `V3_PORTAL_ENABLED=true` (404 when disabled)  
**Auth:** `Authorization: Bearer <JWT>` on all routes

---

## Global Conventions

### Authentication Roles

| Role | Middleware | Access |
|------|------------|--------|
| Any authenticated user | — | Profile, presence, directory, preferences |
| `TENANT_ADMIN` / `SUPER_ADMIN` | `adminOnly` | Most tenant mutations |
| `SUPER_ADMIN` | `superAdminOnly` | Marketplace purchase, migration wizard, test lab |

### Standard Success Response

```json
{ "success": true, ...payload }
```

### Standard Error Response

```json
{ "error": "Human-readable message", "code": "MACHINE_CODE" }
```

| HTTP | Meaning |
|------|---------|
| 400 | Validation / missing field |
| 401 | Missing or invalid JWT |
| 403 | Role or tenant scope denied |
| 404 | Resource not found or portal disabled |
| 429 | Rate limit exceeded |
| 500 | Server error |

### Rate Limits

| Limiter | Routes |
|---------|--------|
| `v3RepairLimiter` | repair, device repair, number repair, runtime repair |
| `v3HeavyMutationLimiter` | backup rollback, runtime sync, migration run, test lab |
| `billingLimiter` | number purchase |
| `searchLimiter` | number search |

### Tenant Scoping

Most routes use `req.user.tenantId`. Super-admin may pass `tenantScoped` or `tenantId` for cross-tenant ops where documented.

---

## Phase 1 — Employees & Health

### POST `/employees`

| | |
|---|---|
| **Auth** | `adminOnly` + tenant |
| **Service** | `employeeService.createEmployee` |
| **Models** | `User`, `Extension`, `Tenant` |

**Request:**
```json
{ "name": "Alice", "email": "alice@example.com", "extensionNumber": "101" }
```

**Response:** `201` — `{ success, employee, extension }`

**Errors:** `400` validation, `403` no tenant, `409` duplicate

---

### GET `/health`

| | |
|---|---|
| **Auth** | `adminOnly` + tenant |
| **Services** | `healthCheckService`, `pbxHealthService`, `softphoneHealthService`, `systemHealthService` |

**Response:** `{ success, summary, employees, readiness, pbx, softphone, systemHealth }`

---

### GET `/health/:employeeId`

**Response:** `{ success, employee, readiness }`

---

### POST `/repair/inspect`

| | |
|---|---|
| **Auth** | `adminOnly` + tenant |
| **Service** | `repairService.inspect` |
| **Rate limit** | `v3RepairLimiter` |

**Response:** `{ success, scanned, issues[] }`

---

### POST `/repair/apply`

**Request:** optional `{ apply: true }` (always applies when called)  
**Service:** `repairService.repair`  
**Audit:** `v3.pbx.repair`

---

### POST `/employees/:id/provision-device`

**Request:** `{ "target": "sip_phone" }`  
**Service:** `provisioningService.provisionDeviceForEmployee`  
**Audit:** `v3.employee.provision_device`

---

## Phase 2 — Numbers & Marketplace

### GET `/numbers`

**Query:** `search`, `status`, `limit`, `offset`, `tenantScoped` (super-admin)  
**Service:** `numberInventoryService.listInventory`

---

### POST `/numbers/search`

| | |
|---|---|
| **Auth** | `superAdminOnly` |
| **Service** | `marketplaceService.searchMarketplace` |

**Request:** `{ "country": "US", "areaCode": "212", "limit": 20 }`  
**Response:** `{ success, numbers[] }`

---

### POST `/numbers/purchase`

**Auth:** `superAdminOnly` + `billingLimiter`  
**Request:** `{ "number": "+12125551234" }` or `{ "reserveOnly": true, ... }`  
**Audit:** `v3.number.purchased` / `v3.number.reserved`

---

### POST `/numbers/assign`

**Request:** `{ "phoneNumberId": "uuid", "extensionId": "uuid" }` or super-admin `{ "tenantId": "uuid" }`  
**Service:** `assignmentService`

---

### POST `/numbers/unassign`

**Request:** `{ "phoneNumberId": "uuid" }`

---

### POST `/numbers/release`

**Auth:** `superAdminOnly`  
**Request:** `{ "phoneNumberId": "uuid", "notes": "..." }`

---

### POST `/numbers/repair`

**Request:** `{ "apply": true, "global": false }` (super-admin may set global)  
**Service:** `repairService.repairNumbers`

---

### GET `/numbers/health`

**Query:** `global=true` (super-admin), `limit`  
**Service:** `inventoryHealthService.listNumbersHealth`

---

## Phase 3 — Devices

### GET `/devices/health`

**Service:** `deviceHealthService.listDevicesHealth`

### POST `/devices/provision`

**Request:** `{ "deviceId": "uuid", "regenerate": false }`

### POST `/devices/repair`

**Request:** `{ "apply": true }`  
**Service:** `deviceRepairService`

### GET `/devices/vendors`

**Response:** `{ success, vendors[] }`

### GET `/devices`

**Query:** `search`, `limit`, `offset`

### POST `/devices`

**Request:** `{ "vendor": "yealink", "macAddress": "...", "employeeId": "uuid" }`  
**Model:** `V3DeskDevice`

### GET `/devices/:id/config`

**Response:** provisioning config URL/body

### PUT `/devices/:id`

**Request:** partial device fields

### DELETE `/devices/:id`

Soft-remove device

---

## Phase 5 — PBX Objects (CRUD Pattern)

Each entity supports 6 routes via `mountPbxCrud`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/{entity}` | List |
| POST | `/{entity}/validate` | Validate payload |
| POST | `/{entity}` | Create |
| GET | `/{entity}/:id` | Get one |
| PUT | `/{entity}/:id` | Update |
| DELETE | `/{entity}/:id` | Remove |

**Entities:**

| Base path | Service | Model |
|-----------|---------|-------|
| `/ringgroups` | `ringGroupService` | `V3RingGroup` |
| `/queues` | `queueService` | `V3Queue` |
| `/business-hours` | `businessHoursService` | `V3BusinessHoursSchedule` |
| `/holidays` | `holidayService` | `V3Holiday` |
| `/voicemails` | `voicemailService` | `V3VoicemailBox` |

**Example — POST `/ringgroups`:**
```json
{
  "name": "Sales",
  "extensionNumber": "600",
  "strategy": "SIMULTANEOUS",
  "memberExtensionIds": ["ext-1", "ext-2"],
  "ringTimeoutSeconds": 25
}
```

**Response:** `201` — `{ success, item }`

### GET `/pbx/references`

Aggregated dropdown references for call flow builder.

---

## Phase 4 — Call Flows

### GET `/callflows/node-types`

### POST `/callflows/validate`

**Request:** `{ "definition": {...} }` or `{ "callFlowId": "uuid" }`

### POST `/callflows/simulate`

**Request:** `{ "callFlowId": "uuid", "context": {...} }`  
**Service:** `callFlowSimulationService`

### GET/POST `/callflows`

### GET/PUT/DELETE `/callflows/:id`

**Model:** `V3CallFlow`

---

## Phase 6 — Softphone UX

### GET/PUT `/profile`

**Auth:** any authenticated user  
**Model:** `V3SoftphoneProfile`  
**Query/body:** optional `userId` (admin)

### GET `/directory`

**Service:** `contactDirectoryService`

### GET/PUT `/presence`

**Model:** `V3PresenceConfig`

### GET/PUT `/preferences`

**Models:** `V3UserPreference`, `V3DevicePreference`

---

## Phase 7 — Operations

| Method | Path | Service |
|--------|------|---------|
| GET | `/dashboard` | `dashboardService` |
| GET | `/dashboard/summary` | `dashboardService` |
| GET | `/dashboard/charts` | `dashboardService` |
| GET | `/analytics` | `analyticsService` |
| GET | `/reports` | `reportService` |
| POST | `/reports/export` | `reportService` |
| GET | `/activity` | `activityService` |
| GET | `/notifications` | `notificationCenterService` |
| GET | `/system-health` | `systemHealthService` |

---

## Phase 8 — Billing & Backup

| Method | Path | Auth | Service |
|--------|------|------|---------|
| GET | `/billing` | admin | `billingService` |
| GET | `/subscription` | admin | `subscriptionService` |
| PUT | `/subscription` | **super-admin** | `subscriptionService` |
| GET | `/license` | admin | `licenseService` |
| GET | `/backup` | admin | `backupService` |
| POST | `/backup/create` | admin | `backupService` |
| POST | `/backup/restore-preview` | admin | `restoreService` |
| POST | `/backup/restore` | admin | `restoreService` |
| POST | `/backup/rollback-preview` | admin | `rollbackService` |
| POST | `/backup/rollback` | admin | `rollbackService` |
| POST | `/export` | admin | `exportImportService` |
| POST | `/import` | admin | `exportImportService` |
| GET | `/lifecycle` | admin | `tenantLifecycleService` |
| POST | `/lifecycle` | admin | `tenantLifecycleService` |

**Import error:** `TENANT_MISMATCH` when bundle tenant ≠ JWT tenant

**Models:** `V3TenantBackup`, `Tenant`

---

## Phase 9 — Runtime

| Method | Path | Service |
|--------|------|---------|
| GET | `/runtime/status` | `runtimeSyncService` |
| GET | `/runtime/jobs` | `runtimeSyncService` |
| GET | `/runtime/health` | `runtimeHealthService` |
| POST | `/runtime/sync` | `runtimeSyncService` |
| POST | `/runtime/resync` | `runtimeSyncService` |
| POST | `/runtime/repair` | `runtimeSyncService` |
| POST | `/runtime/jobs/:jobId/retry` | `runtimeSyncService` |
| GET | `/runtime-validation` | `runtimeValidationService` |
| POST | `/runtime-validation/run` | `runtimeValidationService` |

**Models:** `V3RuntimeSyncJob`, `V3RuntimeLink`

**Requires:** `V3_RUNTIME_SYNC_ENABLED=true`

---

## Phase 10 — Production

| Method | Path | Service |
|--------|------|---------|
| GET | `/monitoring` | `monitoringService` |
| GET | `/metrics` | `metricsService` |
| GET | `/diagnostics` | `diagnosticsService` |
| POST | `/migration/preview` | `migrationService` |
| POST | `/migration/run` | `migrationService` |
| POST | `/migration/rollback` | `migrationService` |
| GET | `/migration/report` | `migrationService` |
| GET | `/production-health` | `productionHealthService` |
| GET | `/deployment` | `deploymentService` |

**Model:** `V3MigrationRun`

---

## Migration Wizard (Super Admin)

| Method | Path | Service |
|--------|------|---------|
| GET | `/migration-wizard/discovery?tenantId=` | `migrationWizardService` |
| POST | `/migration-wizard/validate` | `migrationWizardService` |
| POST | `/migration-wizard/preview` | `migrationWizardService` |
| POST | `/migration-wizard/run` | `migrationWizardService` |
| POST | `/migration-wizard/rollback` | `migrationWizardService` |

---

## Test Lab (Super Admin)

| Method | Path | Service |
|--------|------|---------|
| GET | `/test-lab/status` | `testLabService` |
| GET | `/test-lab/runs` | `testLabService` |
| GET | `/test-lab/runs/:runId` | `testLabService` |
| POST | `/test-lab/run` | `testLabService` |
| POST | `/test-lab/teardown` | `testLabService` |

**Requires:** `V3_TEST_LAB_ENABLED=true`  
**Errors:** `TEST_LAB_DISABLED`, `TEST_LAB_PRODUCTION_BLOCKED`

**Model:** `V3TestLabRun`

---

## Endpoint Count

| Category | Count |
|----------|-------|
| Phase 1 | 6 |
| Phase 2 | 9 |
| Phase 3 | 9 |
| Phase 4 | 8 |
| Phase 5 (PBX CRUD × 5) | 30 |
| Phase 5 references | 1 |
| Phase 6 | 6 |
| Phase 7 | 9 |
| Phase 8 | 14 |
| Phase 9 | 9 |
| Phase 10 | 9 |
| Migration Wizard | 5 |
| Test Lab | 5 |
| **Total** | **96** |

---

## Client SDK

TypeScript: `web/src/lib/v3-api.ts`

## Related

- `docs/V3/API.md` — summary reference
- `docs/developer/Architecture.md`
