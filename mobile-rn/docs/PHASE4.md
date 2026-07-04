# Phase 4 — Mobile Implementation Guide

**Audience:** Developers working in `mobile-rn/`.  
**Authoritative scope:** [docs/vsp/phase4/README.md](../../docs/vsp/phase4/README.md)

**Mandatory rules:** [docs/vsp/phase4/03-mobile-development-rules.md](../../docs/vsp/phase4/03-mobile-development-rules.md)  
**Build sequence:** [docs/vsp/phase4/04-development-sequence.md](../../docs/vsp/phase4/04-development-sequence.md)

---

## Build order

| Phase | Status |
|-------|--------|
| 4.1 Authentication | ✅ Complete — [PHASE4-1-AUTH.md](./PHASE4-1-AUTH.md) |
| 4.2 Calling UI | **Next** |
| 4.3 Contacts & communication | Planned |
| 4.4 Settings | Planned |
| 4.5 Performance & polish | Planned |

The API at tag `phase2-production-ready` is the contract. Do not add endpoints or change telephony behavior. If you hit a backend bug, **stop and report** — see [03-mobile-development-rules.md](../../docs/vsp/phase4/03-mobile-development-rules.md).

---

## Phase 4 deliverables

| Phase | Doc |
|-------|-----|
| **4.1 Authentication** | [PHASE4-1-AUTH.md](./PHASE4-1-AUTH.md) |

### Remaining scope by phase

| Phase | Screens / areas |
|-------|-----------------|
| **4.2** | Home, Dial Pad, Incoming, Outgoing, In-Call |
| **4.3** | Contacts, Favorites, Recents, Call History, Voicemail |
| **4.4** | SIP Configuration, Desk Phone QR, Audio, Notifications, Profile |
| **4.5** | Animations, skeletons, FlashList, memory, transitions |

Before touching telephony modules, inspect existing code — see [04-development-sequence.md](../../docs/vsp/phase4/04-development-sequence.md#existing-implementation-map).

Feature status matrix: [01-mobile-feature-matrix.md](../../docs/vsp/phase4/01-mobile-feature-matrix.md)

---

## Design

Follow [DESIGN.md](./DESIGN.md) — VSP enterprise UI, not consumer phone clones.

---

## Build & test

```bash
# From repo root
npm run test:mobile

# From mobile-rn/
npm install
npx expo start
```

Push setup: [ANDROID-FIREBASE-SETUP.md](./ANDROID-FIREBASE-SETUP.md)

---

## API endpoints (unchanged from Phase 2)

Reuse existing softphone and portal routes — see [docs/vsp/pbx/20-api-reference.md](../../docs/vsp/pbx/20-api-reference.md).

Key mobile paths:

- `POST /api/mobile/provision` — QR redeem
- `POST /api/softphone/token` — Telnyx login
- `POST /api/softphone/presence` — registration heartbeat
- `POST /api/softphone/push-token` — FCM/APNs
- `GET /api/calls` — call history
- Voicemail routes as used by portal

---

## Out of scope for Phase 4

- New PBX features
- SMS/messaging feature expansion (maintain only)
- Flutter `mobile/` (removed)
