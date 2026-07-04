# V3 Folder Structure

```
lib/v3/
├── employeeService.js          # Phase 1
├── healthCheckService.js
├── repairService.js
├── numberInventoryService.js   # Phase 2
├── marketplaceService.js
├── deviceService.js            # Phase 3
├── callFlowService.js          # Phase 4
├── ringGroupService.js         # Phase 5
├── queueService.js
├── softphoneProfileService.js  # Phase 6
├── dashboardService.js         # Phase 7
├── backupService.js            # Phase 8
├── runtime/                    # Phase 9
│   ├── runtimeSyncService.js
│   └── *RuntimeAdapter.js
├── migrationService.js         # Phase 10
├── migrationWizardService.js
├── testLabService.js
├── auditService.js
└── featureFlag.js

routes/v3.js                    # All /api/v3 routes

web/src/
├── app/(app)/v3/               # 43 pages
├── components/v3/
│   ├── ops/ops-ui.tsx
│   ├── pbx/pbx-manager.tsx
│   └── callflow/flow-builder.tsx
└── lib/
    ├── v3-api.ts
    └── portal-nav.ts

tests/v3/                       # 55 test files, 130 tests

prisma/migrations/202607*       # 11 V3 migrations

docs/
├── V3/                         # Feature ops guides
├── release/                    # RC1 handover
├── admin/                      # Admin manuals
├── developer/                  # This folder
└── architecture/               # ER + system diagrams

release/v3.0.0/                 # GA release package
```
