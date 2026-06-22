# Phase 3B Sprint 2 — Mobile Production Readiness

Sprint 2 builds on Sprint 1 simultaneous-ring validation (**51 passed, 0 failed**, inbound readiness **81/100**) with store-ready mobile packaging, multi-device push, audio routing, and tenant voicemail on mobile.

Run validation:

```bash
npm run validate:phase3b-sprint2
npm run validate:phase3b
npm run validate:phase3b-race
```

---

## Readiness scores (post Sprint 2)

| Area | Score | Notes |
|------|------:|-------|
| **Android readiness** | **88/100** | Production `com.vspvoip.mobile`, release signing scaffold, FCM package match, token refresh, proguard scaffold. Missing: committed keystore + Play Console listing assets. |
| **iOS readiness** | **85/100** | Debug/production entitlements split, PushKit VoIP + CallKit UI. Missing: TestFlight device matrix, Apple Push production cert verification on hardware. |
| **Overall inbound calling** | **87/100** | +6 vs Sprint 1 (81). Multi-device tokens, token refresh, mobile voicemail, missed-call notifications, audio route picker. |
| Call routing / simultaneous ring | 88/100 | Unchanged from Sprint 1 hardening |
| Multi-instance (Redis claims) | 85/100 | Requires `REDIS_URL` in production |

---

## Sprint 2 deliverables

### Priority 1 — Android / Play / FCM

- Production package `com.vspvoip.mobile` (Android + iOS)
- Release signing via `mobile/android/key.properties` (see `key.properties.example`)
- ProGuard rules scaffold: `mobile/android/app/proguard-rules.pro`
- App version `1.0.0-beta.1+2`
- FCM `onTokenRefresh` re-registers push token with backend

### Priority 2 — iOS / PushKit / CallKit

- `RunnerDebug.entitlements` → `aps-environment: development`
- `RunnerRelease.entitlements` → `aps-environment: production`
- PushKit unrestricted VoIP entitlement on release builds
- CallKit via `flutter_callkit_incoming` (incoming + missed call)

### Priority 3 — Multi-device push

- `UserDevice` table + `lib/userDevices.js`
- APIs: `POST /softphone/push-token` (requires `deviceId`), `GET/DELETE /softphone/devices`
- Mobile: stable install UUID in secure storage, device name + app version on register
- Telnyx login token refresh ~1 hour before 24h expiry
- Device unregister on logout

### Priority 4 — Audio routing

- `AudioRouteService` — speaker, earpiece, Bluetooth/headset detection
- In-call **Audio** bottom sheet on softphone screen

### Priority 5 — Voicemail + missed calls

- **Voicemail** screen at `/voicemail` (from Call history toolbar)
- Playback via Telnyx `recordingUrl` + `just_audio`
- `MissedCallNotifier` local notification when inbound is missed in foreground

---

## Remaining blockers

| Blocker | Owner | Impact |
|---------|-------|--------|
| Create release keystore + `key.properties` | DevOps | Cannot upload signed AAB to Play |
| Play Console: privacy policy, data safety, screenshots | Product | Store listing blocked |
| Apple Developer: VoIP push cert (production) + TestFlight | iOS | Background inbound on physical iPhones |
| `REDIS_URL` in production API | Ops | Multi-instance simultaneous-ring winner claims |
| Physical device QA: BT headset, dual SIM, kill-app push | QA | Beta confidence |
| Telnyx credential connection push profile (FCM + APNs) | Telnyx portal | Push delivery |

---

## Beta launch checklist

### Backend / Telnyx

- [ ] `API_PUBLIC_URL` is public HTTPS
- [ ] `TELNYX_CALL_CONTROL_APP_ID` + webhooks reachable
- [ ] `TELNYX_CREDENTIAL_CONNECTION_ID` configured
- [ ] `REDIS_URL` set for production (multi-instance)
- [ ] Run `npx prisma migrate deploy` (includes `UserDevice`)
- [ ] Ring group includes App members for beta users
- [ ] Telnyx portal: FCM + APNs keys on credential connection

### Android beta

- [ ] Copy `key.properties.example` → `key.properties` + keystore
- [ ] `flutter build appbundle --dart-define=API_BASE_URL=https://api.example.com`
- [ ] Internal testing track in Play Console
- [ ] Verify FCM push with app killed (incoming call UI)
- [ ] Verify missed-call notification + callback

### iOS beta

- [ ] Xcode: automatic signing + Push Notifications capability
- [ ] TestFlight build with **Release** entitlements (production push)
- [ ] Physical device: incoming CallKit + answer/decline
- [ ] Voicemail inbox + playback on cellular

### Multi-device

- [ ] Same user logged in on phone + tablet → both ring (simultaneous)
- [ ] Answer on one device → other stops ringing
- [ ] Logout removes device from `GET /softphone/devices`

### Regression

- [ ] `npm run validate:phase3b` — 33 passed
- [ ] `npm run validate:phase3b-race` — 18 passed
- [ ] `npm run validate:phase3b-sprint2` — all structural checks pass
- [ ] Billing / Razorpay / Phase 2B untouched

---

## Key files

| Area | Path |
|------|------|
| Multi-device API | `lib/userDevices.js`, `routes/portal.js` |
| Device ID (mobile) | `mobile/lib/core/device/device_install_service.dart` |
| Token refresh | `mobile/lib/features/softphone/providers/softphone_controller.dart` |
| Audio routes | `mobile/lib/core/audio/audio_route_service.dart` |
| Voicemail UI | `mobile/lib/features/voicemail/` |
| Sprint 2 validator | `scripts/validate-phase3b-sprint2.js` |

---

*Generated for Phase 3B Sprint 2 — does not modify billing, Razorpay, Stripe, or Phase 2B revenue protection.*
