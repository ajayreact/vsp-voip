# V3 Service Dependencies & Flow Diagrams

**Version:** 3.0.0

---

## V3 Services Map

```mermaid
graph TB
    subgraph Portal["Portal Layer"]
        UI["web/src/app/(app)/v3/*"]
        API["routes/v3.js"]
    end

    subgraph Services["lib/v3 Services"]
        P1["employeeService<br/>healthCheckService<br/>repairService"]
        P2["numberInventoryService<br/>marketplaceService<br/>assignmentService"]
        P3["deviceService<br/>deviceProvisioningService"]
        P4["callFlowService<br/>callFlowSimulationService"]
        P5["ringGroupService<br/>queueService<br/>voicemailService"]
        P6["softphoneProfileService<br/>presenceService"]
        P7["dashboardService<br/>analyticsService"]
        P8["backupService<br/>billingService"]
        P9["runtimeSyncService"]
        P10["migrationService<br/>testLabService"]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL)]
        Redis[(Redis)]
    end

    UI --> API
    API --> P1 & P2 & P3 & P4 & P5 & P6 & P7 & P8 & P9 & P10
    P1 & P2 & P3 & P4 & P5 & P6 & P7 & P8 & P9 & P10 --> PG
    P9 --> Redis
```

---

## Runtime Adapters

```mermaid
graph LR
    SVC["V3 Service mutation"] --> ADP["runtime/*Adapter.js"]
    ADP --> ENQ["runtimeEnqueue.js"]
    ENQ --> Redis[(Redis)]
    Redis --> Worker["telephony-v3-worker"]
    Worker --> TC["lib/telephony-v3/*"]
    TC --> Telnyx["Telnyx API"]
```

| Adapter | Entity |
|---------|--------|
| `extensionRuntimeAdapter` | Extensions |
| `numberRuntimeAdapter` | DIDs |
| `ringGroupRuntimeAdapter` | Ring groups |
| `queueRuntimeAdapter` | Queues |
| `callFlowRuntimeAdapter` | Call flows |
| `businessHoursRuntimeAdapter` | Hours |
| `holidayRuntimeAdapter` | Holidays |
| `voicemailRuntimeAdapter` | Voicemail |
| `deviceRuntimeAdapter` | Desk devices |

---

## Portal Architecture

```mermaid
graph TB
    Browser["Browser /v3/*"] --> Next["Next.js App Router"]
    Next --> Client["v3-api.ts"]
    Client --> Express["Express /api/v3"]
    Express --> Flag{"V3_PORTAL_ENABLED?"}
    Flag -->|no| N404[404]
    Flag -->|yes| Auth["JWT + Role Gate"]
    Auth --> SVC["lib/v3/*"]
    SVC --> Prisma["Prisma ORM"]
    Prisma --> PG[(PostgreSQL)]
```

---

## Request Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant W as Next.js
    participant A as /api/v3
    participant S as lib/v3 Service
    participant D as PostgreSQL

    U->>W: Navigate /v3/dashboard
    W->>A: GET /api/v3/dashboard (JWT)
    A->>A: requireV3Enabled + adminOnly
    A->>S: dashboardService.get(...)
    S->>D: tenant-scoped queries
    D-->>S: aggregates
    S-->>A: dashboard payload
    A-->>W: JSON
    W-->>U: Render dashboard
```

---

## Migration Flow

```mermaid
sequenceDiagram
    participant SA as Super Admin
    participant W as Migration Wizard UI
    participant API as /api/v3/migration-wizard
    participant M as migrationWizardService
    participant B as backupService
    participant D as PostgreSQL

    SA->>W: Start wizard
    W->>API: GET discovery
    API->>M: discover(tenantId)
    M->>D: inventory legacy + V3
    SA->>W: Validate + Preview
    W->>API: POST preview
    SA->>W: Backup
    W->>B: create backup
    SA->>W: Run migration
    W->>API: POST run
    M->>D: migrate (transaction)
    alt failure
        M->>M: auto-rollback
    end
    M-->>W: result report
```

---

## Runtime Sync Flow

```mermaid
sequenceDiagram
    participant A as Tenant Admin
    participant API as /api/v3/runtime
    participant R as runtimeSyncService
    participant E as runtimeEnqueue
    participant Redis as Redis
    participant W as telephony-v3-worker

    A->>API: POST /runtime/resync
    API->>R: resync(tenantId)
    R->>E: enqueue jobs per entity
    E->>Redis: stream/outbox
    W->>Redis: poll jobs
    W->>W: apply to runtime state
    W->>Redis: mark complete
    A->>API: GET /runtime/jobs
    API-->>A: job statuses
```

---

## Related

- `docs/architecture/system-architecture.md`
- `docs/developer/RuntimeAdapters.md`
