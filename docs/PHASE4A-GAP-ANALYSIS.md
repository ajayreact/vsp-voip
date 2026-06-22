# Phase 4A — Extension Management Gap Analysis

**Date:** 2026-06-21  
**Reference model:** RingCentral-style extension export (~56 PBX fields) — used as **conceptual reference only** (uploaded `ExtensionDetail1781980649.csv` not present in repo; analysis based on typical RC export categories).  
**Current system:** VSP-VOIP tenant portal (`User`, `PhoneNumber`, `Greeting`, `UserDevice`, `Voicemail`, `CallLog`, softphone/WebRTC).

---

## A) Reference extension export (typical ~56 fields)

Categories commonly exported from legacy PBX / RingCentral admin:

| Category | Example fields | Count (typ.) |
|----------|----------------|-------------|
| Identity | Extension, Name, Email, Department, Site, Language | ~8 |
| Status | Status, Type (User/Queue), Hidden, Announcement | ~5 |
| Telephony | Direct number, Outbound caller ID, SMS, Fax | ~8 |
| Registration | SIP login, SIP password, Device count, HD voice | ~10 |
| Forwarding | Always/Busy/No answer/Don't answer, Ring delay, Simultaneous ring | ~12 |
| Features | Voicemail PIN, VM-to-email, DND, Screening, Intercom, Paging | ~10 |
| Security | Int'l calling, Directory, CLID, Trusted numbers | ~8 |
| Compliance | Recording mode, retention, consent | ~5 |

**Total:** ~56 fields — oriented to **telecom engineers**, not SaaS admins.

---

## B) Current VSP-VOIP tenant model

| Capability | Where it lives today |
|------------|---------------------|
| Users / roles | `User` (TENANT_ADMIN, TENANT_USER) |
| Direct numbers | `PhoneNumber.assignedUserId` |
| Ring groups / IVR | `Greeting` (tenant-wide, not per-extension) |
| Voicemail | `Greeting.voicemail*` + `Voicemail` table (tenant-level inbox) |
| Call recording | `Greeting.callRecordingEnabled` (tenant-wide) |
| Softphone / WebRTC | `User.telnyxSipUsername`, softphone APIs |
| Mobile devices | `UserDevice` (multi-device push) |
| Registration hint | `User.softphoneOnlineAt`, `sipRegistered` |
| Call history | `CallLog` (tenant, no extension FK) |
| Team UI | Settings → Team (users only, no extension numbers) |

---

## Compatibility matrix

### Existing features (already in platform)

| Feature | VSP today | Extension module reuse |
|---------|-----------|------------------------|
| User accounts | ✅ | Extension → optional `userId` link |
| Direct number assignment | ✅ | Show on extension detail |
| WebRTC softphone | ✅ | Registration status per linked user |
| Mobile push devices | ✅ | `UserDevice` → Devices view |
| Tenant voicemail inbox | ✅ | Extension voicemail settings + filtered inbox |
| Call recording (tenant) | ✅ | Per-extension override in Phase 4A schema |
| Call routing / ring groups | ✅ | Link from Phone System → Call routing |
| Call history / analytics | ✅ | Aggregate by assigned numbers / user |
| Multi-device registration | ✅ | Sprint 2 `UserDevice` |

### Missing features (Phase 4A MVP targets)

| Feature | Phase | Priority |
|---------|-------|----------|
| Extension entity (101, 102…) | 4A | P0 |
| Extension list + CRUD UI | 4A | P0 |
| Add Extension wizard (simplified) | 4A | P0 |
| Per-extension device registry view | 4A | P0 |
| Registration status indicator | 4A | P0 |
| Per-extension voicemail settings | 4A | P0 |
| Basic extension analytics | 4A | P0 |
| Phone System navigation shell | 4A | P0 |

### Recommended features (later phases)

| Feature | Phase | Rationale |
|---------|-------|-----------|
| Always / Busy / No-answer forwarding | 4B | High value; schema ready, UI deferred |
| DND, call screening, intercom | 4B | Business tier |
| Whitelist / blacklist / int'l lock | 4C | Enterprise security |
| Department-based routing | 4C | Needs org structure |
| Compliance recording policies | 4C | Legal/compliance |
| Queue / ACD metrics | 4C | Beyond simple extensions |
| Greeting upload per extension | 4B+ | Media storage + Telnyx integration |

### Features that should NOT be implemented

| Reference field / capability | Reason |
|------------------------------|--------|
| Raw SIP username/password in UI | JWT/WebRTC credentials managed by platform |
| 56-field export parity | Legacy PBX complexity |
| Fax / SMS per extension (RC-style) | SMS is tenant-line based today |
| HD voice / codec / RTP engineering | Carrier/platform concern |
| Multiple sites / multi-tenant RC sites | Single tenant org model |
| Paging / overhead paging | Out of scope |
| VM PIN per extension in portal | Telnyx/voicemail box not PIN-isolated yet |
| Simultaneous ring delay matrices | Use existing ring group strategy |
| Device provisioning MAC addresses | Not SaaS-friendly for MVP |
| Custom SIP headers / trunk auth | Super-admin carrier settings only |

---

## Architectural decision (Phase 4A)

```
Tenant
  └── Extension (101, 102, 103…)
        ├── optional User assignment
        ├── ExtensionVoicemailSettings
        ├── ExtensionForwarding (schema only → 4B)
        ├── ExtensionSecurity (schema only → 4C)
        └── ExtensionDevice (derived + persisted snapshots)
```

**Queues** (e.g. "102 - Support Queue") are extensions **without** `userId` — used for labeling and future routing; MVP treats them as directory entries.

---

## Production impact (pre-implementation)

| Area | Impact |
|------|--------|
| Database | Additive migrations only — no billing/Razorpay changes |
| Call routing | Unchanged — extensions do not replace `Greeting` yet |
| Telnyx | No new trunk provisioning in 4A |
| Mobile app | Unchanged — still user-based softphone |
| Risk | Low — new module isolated under `/api/tenant/extensions` |

---

## Readiness to proceed

| Gate | Status |
|------|--------|
| Gap analysis complete | ✅ |
| Scope bounded to simplified SaaS model | ✅ |
| Phase 4B/4C deferred explicitly | ✅ |
| Billing / Phase 2B untouched | ✅ Required |

**Proceed with Phase 4A MVP implementation.**
