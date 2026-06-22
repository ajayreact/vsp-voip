# Phase 5 — Next Priority Roadmap

**Date:** 2026-06-21  
**Scope:** Ring Groups → Call Queues → Receptionist Console → SIP Desk Phones  
**Explicitly out of scope:** Auto Attendant / IVR builder (do not build)

**Build order:** 5A → 5B → 5C → 5D (each phase ships before the next starts)

---

## Current platform baseline (Phases 4A–4C)

| Capability | Today | Phase 5 impact |
|------------|-------|----------------|
| Extensions | First-class entity (`Extension`) | Ring group / queue members reference extensions |
| Single tenant ring group | `Greeting.ringGroupMembers` JSON | **Migrate to `RingGroup` entity in 5A** |
| Ring strategies | `simultaneous`, `sequential` only | Add longest idle, round robin in 5A |
| Call Control inbound | `lib/inboundCallControl.js` | Queues, transfer, park in 5B/5C |
| Device registration | WebRTC + mobile via `UserDevice` | Desk SIP inventory in 5D |
| Voicemail / recording | Tenant + per-extension | Group-level in 5A; queue overflow in 5B |
| Security / DND | Per-extension (4C) | Inherited by group/queue members |

---

## Architecture overview

```
                    ┌─────────────────────────────────────┐
                    │         Tenant Phone System          │
                    └─────────────────────────────────────┘
                                      │
        ┌──────────────┬──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼
   Extensions    Ring Groups     Call Queues    Receptionist    SIP Phones
   (Phase 4)      (Phase 5A)      (Phase 5B)     Console 5C    (Phase 5D)
        │              │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                      │
                          Telnyx Call Control + WebRTC
                                      │
                    ┌─────────────────┴─────────────────┐
                    │  inboundCallControl (extended)     │
                    │  ringGroupRouter → queueRouter     │
                    │  receptionistActions (5C)          │
                    └───────────────────────────────────┘
```

**Routing precedence (inbound DID → destination):**

1. Number routing override (`PhoneNumber.routingType`)
2. Extension security / DND (Phase 4C)
3. Ring group or queue assignment (Phase 5A/5B)
4. Tenant default greeting (no auto attendant — busy/no-answer only)

---

# Phase 5A — Ring Groups

## Goal

Replace the legacy single JSON ring group on `Greeting` with **multiple named ring groups**, member management by extension, four ring strategies, and group voicemail/recording.

## Architecture

```
PhoneNumber ──optional──► RingGroup
Extension ◄──RingGroupMember──► RingGroup
RingGroup ──► ExtensionVoicemailSettings (group inbox via assigned numbers)
RingGroup ──► recordingPolicy (group-level override)
```

**Ring strategy engine** (`lib/ringGroupRouter.js`):

| Strategy | Behavior | Existing code reuse |
|----------|----------|---------------------|
| Simultaneous | Dial all members; first answer wins | ✅ `dialAllTargetsSimultaneously` |
| Sequential | Dial one at a time | ✅ `dialNextTarget` |
| Longest idle | Sort members by `lastAnsweredAt` ASC | New member state on `RingGroupMember` |
| Round robin | Rotate `lastRungAt` pointer | New pointer on `RingGroup` |

**Member idle tracking:** Update `RingGroupMember.lastAnsweredAt` / `lastRungAt` on hangup in Call Control.

## Database changes

**Migration:** `20260622000000_phase5a_ring_groups`

```prisma
enum RingStrategy {
  SIMULTANEOUS
  SEQUENTIAL
  LONGEST_IDLE
  ROUND_ROBIN
}

model RingGroup {
  id                   String       @id @default(uuid())
  tenantId             String
  tenant               Tenant       @relation(...)
  name                 String
  extensionNumber      String?      // optional virtual ext e.g. "200"
  ringStrategy         RingStrategy @default(SIMULTANEOUS)
  ringTimeoutSeconds   Int          @default(25)
  roundRobinPointer    Int          @default(0)
  voicemailEnabled     Boolean      @default(true)
  callRecordingEnabled Boolean      @default(true)
  isActive             Boolean      @default(true)
  members              RingGroupMember[]
  phoneNumbers         PhoneNumber[] // optional direct assignment
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  @@unique([tenantId, name])
  @@index([tenantId, isActive])
}

model RingGroupMember {
  id              String    @id @default(uuid())
  ringGroupId     String
  ringGroup       RingGroup @relation(...)
  extensionId     String
  extension       Extension @relation(...)
  priority        Int       @default(0)
  lastAnsweredAt  DateTime?
  lastRungAt      DateTime?
  isActive        Boolean   @default(true)

  @@unique([ringGroupId, extensionId])
  @@index([ringGroupId, priority])
}

// PhoneNumber add: ringGroupId String? (nullable FK)
```

**Data migration:** One-time script copies `Greeting.ringGroupMembers` → default `RingGroup` "Main" if enabled.

**Deprecate (do not delete in 5A):** `Greeting.ringGroupEnabled`, `ringGroupMembers`, `ringStrategy` — read-only fallback for 1 release.

## API changes

| Method | Path | Role |
|--------|------|------|
| GET | `/api/tenant/ring-groups` | List groups + member counts |
| POST | `/api/tenant/ring-groups` | Create group |
| GET | `/api/tenant/ring-groups/:id` | Detail + members + stats |
| PATCH | `/api/tenant/ring-groups/:id` | Update name, strategy, timeout, VM/recording |
| DELETE | `/api/tenant/ring-groups/:id` | Soft-delete / deactivate |
| POST | `/api/tenant/ring-groups/:id/members` | Add extension `{ extensionId, priority? }` |
| DELETE | `/api/tenant/ring-groups/:id/members/:memberId` | Remove member |
| PATCH | `/api/tenant/ring-groups/:id/members/reorder` | Priority order |
| GET | `/api/tenant/ring-groups/:id/voicemails` | Group inbox |
| GET | `/api/tenant/ring-groups/:id/analytics` | Answer rate, missed, avg duration |

**Lib modules:** `lib/ringGroups.js`, `lib/ringGroupRouter.js` (extends `resolveRingTargets`)

**Inbound hook:** `resolveRingTargets` checks `PhoneNumber.ringGroupId` or extension forward destination `RING_GROUP` → loads members via extension SIP credentials.

## UI changes

**Nav:** Phone System → **Ring Groups** (`/phone-system/ring-groups`)

| Page | Purpose |
|------|---------|
| List | Name, strategy, members, status, actions |
| Create / Edit wizard | Name, strategy, timeout, VM, recording |
| Detail | Member table (drag reorder), analytics cards |
| Add members | Extension picker (online indicator) |

**Components:** `ring-group-list.tsx`, `ring-group-form.tsx`, `ring-group-members.tsx`

## Validation suite

**Script:** `npm run validate:phase5a`

| # | Test |
|---|------|
| 1 | Schema: `RingGroup`, `RingGroupMember` |
| 2 | CRUD ring group API |
| 3 | Add/remove/reorder members |
| 4 | Simultaneous strategy resolves N extension targets |
| 5 | Sequential strategy dials in priority order |
| 6 | Longest idle sorts by `lastAnsweredAt` |
| 7 | Round robin advances pointer |
| 8 | Inbound simulation: Call Control session gets correct targets |
| 9 | WebRTC + mobile member both receive ring (mock SIP usernames) |
| 10 | Group voicemail saved when no answer |
| 11 | Group recording flag respected |
| 12 | Migration from `Greeting.ringGroupMembers` |

## Readiness score — **74/100** (pre-build estimate)

| Factor | Score | Notes |
|--------|-------|-------|
| Call Control simultaneous/sequential | 90 | Production-tested (Phase 3B) |
| Extension + device model | 85 | Members link cleanly |
| Longest idle / round robin | 50 | New state + tests needed |
| Group VM/recording | 65 | Reuse tenant VM pipeline |
| UI complexity | 70 | Standard CRUD + member picker |
| Migration from Greeting JSON | 60 | One-time script risk |

**Recommendation:** Build 5A first — highest reuse, unblocks 5B overflow destinations.

---

# Phase 5B — Call Queues

## Goal

ACD-style queues with hold music, position announcements, timeout, overflow routing, and operational metrics.

## Architecture

```
Inbound DID ──► CallQueue ──► QueueMember extensions (ordered/skilled)
                    │
                    ├── Hold music (Telnyx playback URL)
                    ├── Position TTS ("You are caller number 3")
                    ├── Timeout ──► Overflow (extension | ring group | VM | external)
                    └── Metrics ──► QueueMetricSnapshot (hourly rollups)
```

**Queue state (Redis):** `queue:{queueId}:waiting` — ordered list of `{ callControlId, enteredAt, from }`

**Agent offer flow:**
1. Caller enters queue → playback + periodic position
2. Next available agent (longest idle among logged-in members) → outbound dial leg
3. Agent answer → bridge; else re-queue or timeout

## Database changes

**Migration:** `20260622100000_phase5b_call_queues`

```prisma
enum QueueOverflowAction {
  VOICEMAIL
  RING_GROUP
  EXTENSION
  EXTERNAL_NUMBER
  HANGUP
}

model CallQueue {
  id                  String              @id @default(uuid())
  tenantId            String
  name                String
  extensionNumber     String?             // e.g. "300"
  maxWaitSeconds      Int                 @default(300)
  maxQueueSize        Int                 @default(10)
  wrapUpSeconds       Int                 @default(15)
  holdMusicUrl        String?
  announcePosition    Boolean             @default(true)
  announceIntervalSec Int                 @default(45)
  overflowAction      QueueOverflowAction @default(VOICEMAIL)
  overflowDestination String?
  ringGroupId         String?             // overflow to ring group
  isActive            Boolean             @default(true)
  members             CallQueueMember[]
  metrics             QueueMetricSnapshot[]
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  @@unique([tenantId, name])
}

model CallQueueMember {
  id           String    @id @default(uuid())
  queueId      String
  queue        CallQueue @relation(...)
  extensionId  String
  extension    Extension @relation(...)
  priority     Int       @default(0)
  loggedIn     Boolean   @default(true)
  lastAnswerAt DateTime?
  callsTaken   Int       @default(0)

  @@unique([queueId, extensionId])
}

model QueueMetricSnapshot {
  id                String    @id @default(uuid())
  queueId           String
  queue             CallQueue @relation(...)
  periodStart       DateTime
  waitingCount      Int       @default(0)
  answeredCount     Int       @default(0)
  missedCount       Int       @default(0)
  abandonedCount    Int       @default(0)
  avgWaitSeconds    Int       @default(0)
  maxWaitSeconds    Int       @default(0)
  createdAt         DateTime  @default(now())

  @@index([queueId, periodStart])
}
```

## API changes

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/tenant/queues` | List / create |
| GET/PATCH/DELETE | `/api/tenant/queues/:id` | CRUD |
| POST/DELETE | `/api/tenant/queues/:id/members` | Member management |
| POST | `/api/tenant/queues/:id/members/:id/login` | Agent login |
| POST | `/api/tenant/queues/:id/members/:id/logout` | Agent logout |
| GET | `/api/tenant/queues/:id/metrics` | Dashboard metrics |
| GET | `/api/tenant/queues/:id/live` | Waiting callers (real-time) |

**Lib:** `lib/callQueues.js`, `lib/queueRouter.js`, `lib/queueMetrics.js`

**Telnyx:** Hold music via `speak`/`playback` on inbound leg; agent dial via existing `dialDestination`.

## UI changes

**Nav:** Phone System → **Call Queues** (`/phone-system/queues`)

| Page | Content |
|------|---------|
| List | Name, waiting, answered today, avg wait |
| Editor | Members, hold music upload, timeout, overflow |
| Live dashboard | Waiting callers table, agent status |
| Analytics | Charts: answered, missed, avg wait |

## Validation suite

**Script:** `npm run validate:phase5b`

| # | Test |
|---|------|
| 1 | Queue CRUD |
| 2 | Member login/logout |
| 3 | Caller enters queue (simulated webhook) |
| 4 | Hold music playback triggered |
| 5 | Position announcement interval |
| 6 | Agent offer on member available |
| 7 | Timeout → overflow voicemail |
| 8 | Timeout → overflow ring group |
| 9 | Metrics increment (waiting, answered, missed) |
| 10 | Max queue size rejection |

## Readiness score — **58/100** (pre-build estimate)

| Factor | Score | Notes |
|--------|-------|-------|
| Depends on 5A ring groups | — | Overflow destination |
| Redis queue state | 70 | Redis already used for Call Control sessions |
| Hold music / TTS | 55 | Telnyx playback URLs |
| Agent login model | 50 | New UX + state |
| Real-time metrics | 60 | Polling MVP; WebSocket later |
| Production ACD complexity | 45 | Phase 5B is MVP queue, not full ACD |

**Recommendation:** Ship closed beta after 5A stable; queue is highest ops risk.

---

# Phase 5C — Receptionist Console

## Goal

Live operator console for monitoring extensions, active calls, and performing transfers, pickup, park, and monitor.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Receptionist Console (Web)                  │
│  Live status │ Active calls │ Actions panel             │
└──────────────────────────┬──────────────────────────────┘
                           │ REST + WebSocket (or SSE)
┌──────────────────────────▼──────────────────────────────┐
│  lib/receptionistConsole.js                                │
│  - extension presence (from Phase 4 registration)        │
│  - active call registry (Redis)                          │
│  - transfer / park / pickup / monitor commands             │
└──────────────────────────┬──────────────────────────────┘
                           │ Telnyx Call Control API
┌──────────────────────────▼──────────────────────────────┐
│  inboundCallControl + outbound leg management              │
└─────────────────────────────────────────────────────────┘
```

**Call actions:**

| Action | Telnyx pattern |
|--------|----------------|
| Blind transfer | `transfer` to SIP/number |
| Attended transfer | Hold + dial consult + merge or cancel |
| Call pickup | Dial ringing extension's inbound leg |
| Call park | Transfer to park slot `*5901` → retrieve |
| Monitor | Whisper/coach mode (listen + optional barge) |

## Database changes

**Migration:** `20260622200000_phase5c_receptionist`

```prisma
model CallParkSlot {
  id            String   @id @default(uuid())
  tenantId      String
  slotNumber    Int      // 1-9
  callControlId String?
  parkedByUserId String?
  parkedAt      DateTime?
  retrievedAt   DateTime?

  @@unique([tenantId, slotNumber])
}

model ReceptionistActionLog {
  id          String   @id @default(uuid())
  tenantId    String
  userId      String
  action      String   // blind_transfer, attended_transfer, pickup, park, monitor
  callControlId String?
  details     Json?
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
}
```

**Redis keys:**
- `active_calls:{tenantId}` — hash of callControlId → metadata
- `park:{tenantId}:{slot}` — parked call reference

No change to Extension model — console reads registration from Phase 4A/5D.

## API changes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tenant/console/snapshot` | Extensions + active calls + park slots |
| GET | `/api/tenant/console/stream` | SSE/WebSocket live updates |
| POST | `/api/tenant/console/transfer/blind` | `{ callControlId, destination }` |
| POST | `/api/tenant/console/transfer/attended` | Start consult |
| POST | `/api/tenant/console/transfer/complete` | Merge consult |
| POST | `/api/tenant/console/pickup` | `{ ringingExtensionId }` |
| POST | `/api/tenant/console/park` | `{ callControlId, slot? }` |
| POST | `/api/tenant/console/retrieve` | `{ slot }` |
| POST | `/api/tenant/console/monitor` | `{ callControlId, mode: listen|whisper|barge }` |

**Role:** `TENANT_ADMIN` + new optional `RECEPTIONIST` role or permission flag.

## UI changes

**Nav:** Phone System → **Receptionist** (`/phone-system/receptionist`)

| Panel | Content |
|-------|---------|
| Extension grid | Live status (green/amber/red), DND badge |
| Active calls | Caller, duration, extension, actions |
| Park slots | 1–9 with retrieve button |
| Transfer modal | Extension / number picker |

**Layout:** Single-page console, optimized for wide screens; collapsible on tablet.

## Validation suite

**Script:** `npm run validate:phase5c`

| # | Test |
|---|------|
| 1 | Console snapshot returns extensions + calls |
| 2 | Blind transfer API (mock Telnyx) |
| 3 | Attended transfer flow (hold → consult → merge) |
| 4 | Call pickup claims ringing leg |
| 5 | Park + retrieve round-trip |
| 6 | Monitor listen mode |
| 7 | Action audit log written |
| 8 | SSE delivers status change within 5s |

## Readiness score — **52/100** (pre-build estimate)

| Factor | Score | Notes |
|--------|-------|-------|
| Extension live status | 80 | Phase 4 registration |
| Active call registry | 55 | Needs Redis extension |
| Telnyx transfer/park APIs | 50 | Complex edge cases |
| Attended transfer UX | 45 | Multi-leg state machine |
| Monitor/whisper/barge | 40 | Carrier capability dependent |
| Real-time UI | 60 | SSE MVP sufficient |

**Recommendation:** Pilot with single receptionist + blind transfer + park only in MVP; attended/monitor in 5C.1.

---

# Phase 5D — SIP Desk Phones

## Goal

Provision and monitor Yealink, Grandstream, and Poly desk phones per extension with SIP credentials and registration inventory.

## Architecture

```
Extension ──► SipDevice (desk phone record)
            ──► Telnyx SIP credential (per extension or per device)
            ──► Registration poll (existing sipRegistered + SIP OPTIONS)

Vendor profiles (lib/sipDeviceProfiles.js):
  - Yealink: standard SIP, BLF hints (future)
  - Grandstream: standard SIP
  - Poly: standard SIP
```

**Credential model:** Extend existing `User.telnyxSipUsername` pattern to **per-device credentials** on `SipDevice` when multi-line desk phones need unique auth.

## Database changes

**Migration:** `20260622300000_phase5d_sip_desk_phones`

```prisma
enum SipDeviceVendor {
  YEALINK
  GRANDSTREAM
  POLY
  OTHER
}

enum SipDeviceStatus {
  ONLINE
  OFFLINE
  EXPIRED
  UNREGISTERED
}

model SipDevice {
  id                   String          @id @default(uuid())
  tenantId             String
  extensionId          String
  extension            Extension       @relation(...)
  vendor               SipDeviceVendor @default(OTHER)
  model                String?
  macAddress           String?
  label                String
  sipUsername          String?
  telnyxCredentialId   String?
  status               SipDeviceStatus @default(UNREGISTERED)
  lastRegistrationAt   DateTime?
  lastIpAddress        String?
  firmwareVersion      String?
  provisioningTemplate String?         // yealink | grandstream | poly
  isActive             Boolean         @default(true)
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt

  @@index([tenantId, extensionId])
  @@index([extensionId, status])
  @@unique([tenantId, macAddress])
}
```

**Extend `ExtensionDevice`:** Optionally merge `SipDevice` into `ExtensionDevice` with `deviceType: SIP` — prefer **separate table** for provisioning metadata (MAC, vendor, firmware).

## API changes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tenant/sip-devices` | Inventory (all desk phones) |
| POST | `/api/tenant/sip-devices` | Add device to extension |
| GET/PATCH/DELETE | `/api/tenant/sip-devices/:id` | CRUD |
| POST | `/api/tenant/sip-devices/:id/provision` | Generate SIP creds + provisioning URL |
| GET | `/api/tenant/sip-devices/:id/registration` | Live registration status |
| GET | `/api/tenant/sip-devices/templates/:vendor` | Provisioning template (RPS stub) |

**Provisioning MVP:** Return manual config bundle (server, port, username, password, codec list) — **no RPS/TR-069 in 5D MVP**.

**Vendor templates:** Static JSON per vendor in `config/sip-profiles/`.

## UI changes

**Nav:** Phone System → **Desk Phones** (`/phone-system/desk-phones`)

| Page | Content |
|------|---------|
| Inventory | Device, extension, vendor, MAC, status |
| Add device | Extension, vendor dropdown, MAC, label |
| Device detail | Registration timeline, provision credentials (admin reveal), reprovision |
| Registration monitor | Reuse Phase 4 registration page filtered to SIP |

## Validation suite

**Script:** `npm run validate:phase5d`

| # | Test |
|---|------|
| 1 | SipDevice CRUD |
| 2 | Provision creates Telnyx credential |
| 3 | Registration status sync from `User`/credential poll |
| 4 | Yealink template generates valid config |
| 5 | Grandstream template generates valid config |
| 6 | Poly template generates valid config |
| 7 | MAC uniqueness per tenant |
| 8 | Extension detail shows linked desk phone |
| 9 | Offline/expired status thresholds |
| 10 | Deactivate removes credential (optional soft) |

## Readiness score — **66/100** (pre-build estimate)

| Factor | Score | Notes |
|--------|-------|-------|
| Telnyx SIP credentials | 85 | Already used for WebRTC |
| Registration monitoring | 75 | Phase 4A device sync |
| Multi-vendor provisioning | 50 | Manual config MVP only |
| MAC inventory | 70 | Straightforward CRUD |
| RPS / zero-touch | 20 | Out of scope for 5D MVP |
| Poly/Yealink BLF | 30 | Future enhancement |

**Recommendation:** 5D can parallel 5B after 5A; desk phones do not block queue/console work.

---

# Cross-phase delivery plan

| Phase | Duration (est.) | Depends on | Ship gate |
|-------|-----------------|------------|-----------|
| **5A** Ring Groups | 2–3 sprints | Phase 4 complete | `validate:phase5a` + device ring QA |
| **5B** Call Queues | 3–4 sprints | 5A overflow | `validate:phase5b` + hold music QA |
| **5C** Receptionist | 3–4 sprints | 5A active calls | `validate:phase5c` + transfer QA |
| **5D** SIP Phones | 2 sprints | Phase 4 extensions | `validate:phase5d` + 1 physical phone |

## Phone System nav (target end state)

```
Phone System
├── Extensions        ✅ Phase 4A
├── Ring Groups       ◻ Phase 5A
├── Call Queues       ◻ Phase 5B
├── Desk Phones       ◻ Phase 5D
├── Receptionist      ◻ Phase 5C
├── Registration      ✅ Phase 4B
├── Devices           ✅ Phase 4A
├── Voicemail         ✅ Phase 4A
├── Call Routing      ✅ (Greeting — no auto attendant)
└── Security          ✅ Phase 4C
```

## Aggregate enterprise readiness (post Phase 5)

| Milestone | Score |
|-----------|-------|
| After Phase 4C (today) | **68/100** |
| After Phase 5A | **74/100** |
| After Phase 5B | **79/100** |
| After Phase 5C | **83/100** |
| After Phase 5D | **86/100** |

## Explicit non-goals (all Phase 5)

- Auto Attendant / multi-level IVR builder
- Visual dial plan editor
- Fax / SMS queue integration
- Native desktop softphone (web/mobile only)
- Zero-touch RPS for desk phones (5D.1+)
- Multi-site / franchise routing

---

## Next action

**Start Phase 5A implementation:**

1. Apply `RingGroup` + `RingGroupMember` migration  
2. Build `lib/ringGroups.js` + extend `resolveRingTargets`  
3. Ship `/phone-system/ring-groups` UI  
4. Run `validate:phase5a`  
5. Migrate legacy `Greeting.ringGroupMembers`  

See [`PHASE5A-IMPLEMENTATION-PLAN.md`](PHASE5A-IMPLEMENTATION-PLAN.md) when 5A build begins.
