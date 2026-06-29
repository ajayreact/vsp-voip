# Phase 4 — Mobile Implementation Guide

**Audience:** Developers working in `mobile-rn/`.  
**Authoritative scope:** [docs/vsp/phase4/README.md](../../docs/vsp/phase4/README.md)

---

## Backend is frozen

The API at tag `phase2-production-ready` is the contract. Do not add endpoints or change telephony behavior. If you hit a backend bug, follow [02-backend-freeze-rules.md](../../docs/vsp/phase4/02-backend-freeze-rules.md).

---

## Phase 4 deliverables

| # | Feature | Start here |
|---|---------|------------|
| 1 | QR Login | `src/screens/QrLoginScreen.tsx`, `src/auth/qrLogin.ts` |
| 2 | Remember Me | `src/auth/tokenStorage.ts`, `LoginScreen.tsx` |
| 3 | Biometric Login | New — `expo-local-authentication` |
| 4 | Dial Pad | `src/screens/calls/DialPadScreen.tsx` |
| 5 | Contacts | `src/screens/contacts/*`, `contactsService.ts` |
| 6 | Call History | `RecentCallsScreen.tsx`, `useRecentCalls.ts` |
| 7 | Incoming Call UI | `IncomingCallScreen.tsx` |
| 8 | In-Call Screen | `ActiveCallScreen.tsx` |
| 9 | Voicemail | `src/screens/voicemail/*` |
| 10 | Push Notifications | `src/notifications/*` |
| 11 | Settings | `src/screens/settings/*` |
| 12 | Desk Phone Provisioning | `SipConfigurationScreen.tsx`, `provisionService.ts` |

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
