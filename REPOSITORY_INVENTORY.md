# V3 Repository Inventory

**Version:** 3.0.0 (GA preparation)  
**Generated:** 2026-07-03  
**Branch:** `release/v3.0.0-rc1` @ `b724754`

---

## Summary

| Category | Count |
|----------|-------|
| V3 backend services | **62** modules (+ 12 runtime = **74** files) |
| API route handlers | **96** |
| React pages (`/v3/*`) | **43** |
| V3 React components | **3** (+ shared ops/pbx/callflow) |
| Prisma V3 models | **22** |
| V3 migrations | **11** (57 total repo migrations) |
| V3 unit tests | **130** (55 test files) |
| V3 documentation pages | **~50+** (see below) |
| Runtime adapters | **10** |
| Feature flags (env) | **6** primary |
| Protected telephony files | **11** (unchanged) |

---

## Backend Services (`lib/v3/`)

### Phase 1 — Provisioning
`employeeService`, `healthCheckService`, `repairService`, `provisioningService`, `auditService`, `extensionService`, `pbxHealthService`

### Phase 2 — Marketplace
`numberInventoryService`, `marketplaceService`, `assignmentService`, `inventoryHealthService`, `telnyxService`, `telnyxNumberService`

### Phase 3 — Desk Phones
`deviceService`, `deviceTemplateService`, `deviceProvisioningService`, `deviceHealthService`, `deviceRepairService`

### Phase 4 — Call Flows
`callFlowService`, `callFlowNodeService`, `callFlowValidationService`, `callFlowSimulationService`, `callFlowExecutionService`

### Phase 5 — PBX Objects
`ringGroupService`, `queueService`, `businessHoursService`, `holidayService`, `voicemailService`

### Phase 6 — Softphone UX
`softphoneProfileService`, `userPreferenceService`, `devicePreferenceService`, `presenceService`, `contactDirectoryService`, `softphoneHealthService`

### Phase 7 — Operations
`dashboardService`, `analyticsService`, `reportService`, `activityService`, `notificationCenterService`, `systemHealthService`, `monitoringService`, `metricsService`

### Phase 8 — Billing & Backup
`billingService`, `subscriptionService`, `licenseService`, `backupService`, `restoreService`, `exportImportService`, `storageService`, `tenantLifecycleService`, `lifecycleHealthService`

### Phase 9 — Runtime
`runtimeSyncService`, `runtimeHealthService`, `runtimeValidationService`, `runtimeEnqueue`, `runtimeFeatureFlag`, 10 adapters

### Phase 10 — Production
`deploymentService`, `migrationService`, `migrationWizardService`, `rollbackService`, `diagnosticsService`, `productionHealthService`, `testLabService`

### Infrastructure
`featureFlag.js`

---

## API Routes (`routes/v3.js`)

**Mount:** `app.use('/api/v3', v3Routes)` in `server.js`  
**Total handlers:** 96

See `release/v3.0.0/API_REFERENCE.md`

---

## Frontend Pages (`web/src/app/(app)/v3/`)

| Route | Page |
|-------|------|
| `/v3/dashboard` | Dashboard |
| `/v3/employees` | Employees |
| `/v3/health` | Health center |
| `/v3/numbers` | Number inventory |
| `/v3/assignments` | Assignments |
| `/v3/marketplace` | Marketplace |
| `/v3/devices` | Desk phones |
| `/v3/device-provision` | Provisioning |
| `/v3/device-health` | Device health |
| `/v3/callflows` | Call flows |
| `/v3/callflows/builder` | Builder |
| `/v3/callflows/simulator` | Simulator |
| `/v3/ring-groups` | Ring groups |
| `/v3/queues` | Queues |
| `/v3/business-hours` | Business hours |
| `/v3/holidays` | Holidays |
| `/v3/voicemail` | Voicemail |
| `/v3/profile` | Softphone profile |
| `/v3/preferences` | Preferences |
| `/v3/presence` | Presence |
| `/v3/directory` | Directory |
| `/v3/analytics` | Analytics |
| `/v3/reports` | Reports |
| `/v3/monitoring` | Monitoring |
| `/v3/activity` | Activity |
| `/v3/notifications` | Notifications |
| `/v3/billing` | Billing |
| `/v3/subscription` | Subscription |
| `/v3/license` | License |
| `/v3/lifecycle` | Lifecycle |
| `/v3/backups` | Backups |
| `/v3/import-export` | Import/export |
| `/v3/runtime` | Runtime |
| `/v3/runtime/health` | Runtime health |
| `/v3/runtime/jobs` | Runtime jobs |
| `/v3/runtime-validation` | Runtime validation |
| `/v3/migration` | Migration |
| `/v3/migration-wizard` | Migration wizard |
| `/v3/production-health` | Production health |
| `/v3/diagnostics` | Diagnostics |
| `/v3/metrics` | Metrics |
| `/v3/system-health` | System health |
| `/v3/test-lab` | Test Lab |

**Total:** 43 unique routes

---

## Components (`web/src/components/v3/`)

| Component | Purpose |
|-----------|---------|
| `ops/ops-ui.tsx` | Ops UI, super-admin guard |
| `pbx/pbx-manager.tsx` | PBX object manager |
| `callflow/flow-builder.tsx` | Call flow visual editor |

---

## Database Models (V3)

`V3CallSession`, `V3CallLeg`, `V3SessionTransition`, `V3LegTransition`, `V3CommandOutbox`, `V3DeskDevice`, `V3CallFlow`, `V3RingGroup`, `V3Queue`, `V3BusinessHoursSchedule`, `V3Holiday`, `V3VoicemailBox`, `V3SoftphoneProfile`, `V3UserPreference`, `V3DevicePreference`, `V3PresenceConfig`, `V3TenantBackup`, `V3RuntimeSyncJob`, `V3RuntimeLink`, `V3MigrationRun`, `V3TestLabRun`, `V3FeatureFlag`

**Shared models used:** `Tenant`, `User`, `Extension`, `PhoneNumber`

---

## Migrations

**V3-specific (11):** `20260624180500` through `20260703220000`  
**Total repository:** 57

---

## Tests

| Suite | Count |
|-------|-------|
| V3 unit tests | 130 passed |
| V3 test files | 55 |
| Full vitest | 967 passed, 2 env failures |

---

## Documentation Inventory

| Path | Files | Purpose |
|------|-------|---------|
| `release/v3.0.0/` | 10 | GA release package |
| `docs/release/` | 10 | RC1 ops handover |
| `docs/V3/` | 13+ | Feature ops guides |
| `docs/admin/` | 9 | Administrator manuals |
| `docs/developer/` | 8 | Developer manuals |
| `docs/architecture/` | 3 | ER + system diagrams |
| Root RC1 docs | 6+ | CHANGELOG, readiness reports |

**Estimated V3-specific documentation pages:** **~59**

---

## Feature Flags

| Flag | Purpose |
|------|---------|
| `V3_PORTAL_ENABLED` | API gate |
| `NEXT_PUBLIC_V3_PORTAL` | Web gate |
| `V3_RUNTIME_SYNC_ENABLED` | Runtime sync |
| `V3_RUNTIME_SYNC_TENANT_ALLOWLIST` | Canary tenants |
| `V3_TEST_LAB_ENABLED` | Test Lab |
| `V3_TEST_LAB_ALLOW_PRODUCTION` | Staging override |

---

## Runtime Adapters

`extension`, `number`, `ringGroup`, `queue`, `callFlow`, `businessHours`, `holiday`, `voicemail`, `device`, base `runtimeAdapter`

---

## Protected Files (Must Not Modify for Portal GA)

| File | Purpose |
|------|---------|
| `lib/inboundCallControl.js` | Inbound orchestration |
| `lib/telnyxCallControl.js` | Telnyx API adapter |
| `lib/callControlSessionStore.js` | Redis call sessions |
| `lib/internalExtensionDial.js` | Extension dial |
| `lib/inboundRouting.js` | Inbound routing |
| `lib/extensions.js` | Extension helpers |
| `lib/pbxRebuild.js` | PBX rebuild |
| `lib/employeeTelephony.js` | Employee telephony |
| `web/src/lib/webrtc-audio.ts` | WebRTC audio |
| `web/src/lib/telnyx-softphone-session.ts` | Softphone session |
| `web/src/app/(app)/softphone-v2/page.tsx` | Softphone UI |

**Status:** No changes in V3 RC1/GA scope ✅

---

## Client SDK

`web/src/lib/v3-api.ts` — typed API wrappers  
`web/src/lib/portal-nav.ts` — navigation config
