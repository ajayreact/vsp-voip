# Phase 3B — Inbound Calling Readiness Report

**Generated:** Sprint 1 implementation complete  
**Validation:** `npm run validate:phase3b`

---

## Production Readiness Scores

| Area | Score | Change from audit | Notes |
|------|-------|-------------------|-------|
| **Android** | **82 / 100** | +10 | Production bundle ID, release signing scaffold, global incoming UI, FCM package aligned |
| **iOS** | **58 / 100** | +13 | `Runner.entitlements`, bundle ID, PushKit/CallKit code present; needs Apple certs + device QA |
| **WebRTC** | **76 / 100** | +2 | Unchanged core; simultaneous ring improves multi-agent inbound |
| **Call routing** | **78 / 100** | +10 | Simultaneous ring on Call Control implemented |
| **Overall inbound** | **74 / 100** | +11 | Android-first beta ready with ops checklist |

---

## Sprint 1 Deliverables

### 1. Simultaneous ring (Call Control)

- When `ringStrategy === 'simultaneous'` and 2+ targets, all legs dial in parallel via `dialAllTargetsSimultaneously()`.
- First `call.dial.answered` / `call.bridged` wins; remaining outbound legs are hung up.
- Sequential strategy unchanged (one leg at a time).
- Session tracks `outboundLegs[]`; `findSession()` resolves events on any leg.

**Files:** `lib/inboundCallControl.js`, `lib/callControlSessionStore.js`

### 2. `validate:phase3b`

Checks:

- Simultaneous ring helper unit tests
- `API_PUBLIC_URL`, `TELNYX_API_KEY`, Call Control / credential connection IDs
- Mobile production bundle IDs and signing config
- FCM `google-services.json` package match
- iOS entitlements file
- Call Control webhook setup status
- Telnyx number → Call Control assignment for app-routing numbers
- Ring target resolution for configured ring groups
- Webhook HTTP reachability (when `API_PUBLIC_URL` set)

**Run:** `npm run validate:phase3b`

### 3. Global incoming call UI

- `IncomingCallOverlay` in `AppShell` — visible on **every tab** when `SoftphoneUiState.incoming`.
- Answer / Decline wired to existing `softphone_controller` actions.
- Native Android ConnectionService / iOS CallKit unchanged (`native_incoming_call_ui.dart`, `AppDelegate.swift`).

**Files:** `mobile/lib/shared/widgets/incoming_call_overlay.dart`, `app_shell.dart`

### 4. Production mobile setup

| Item | Value |
|------|--------|
| Android `applicationId` | `com.vspvoip.mobile` |
| iOS bundle ID | `com.vspvoip.mobile` |
| Release signing | `mobile/android/key.properties` (see `key.properties.example`) |
| iOS entitlements | `mobile/ios/Runner/Runner.entitlements` (Push + VoIP) |
| FCM config | `google-services.json` updated to `com.vspvoip.mobile` |

**Important:** Re-register the Android app in Firebase Console with package `com.vspvoip.mobile` and download a fresh `google-services.json` if push fails after the package rename.

---

## Remaining Blockers

### Critical (before customer go-live)

1. **`API_PUBLIC_URL`** — HTTPS URL Telnyx can reach for `/webhook/call-control`.
2. **Telnyx Call Control app** — `TELNYX_CALL_CONTROL_APP_ID` + webhook synced to `API_PUBLIC_URL`.
3. **Telnyx credential connection** — `TELNYX_CREDENTIAL_CONNECTION_ID` with FCM + VoIP push configured in Telnyx Portal.
4. **Firebase production app** — Confirm Firebase Android app uses `com.vspvoip.mobile` (re-download `google-services.json` after console update).
5. **Apple VoIP push certificate** — Upload to Telnyx; set development team in Xcode.
6. **Android release keystore** — Copy `key.properties.example` → `key.properties` and create keystore before Play Store upload.
7. **App store distribution** — No Play Store / App Store listing yet.

### High (calling quality)

8. **Physical device E2E** — Killed-state Android + iOS inbound not validated in CI.
9. **Multi-device push** — Single `pushDeviceToken` per user (last device wins).
10. **Browser inbound** — Requires softphone tab open; no background notifications.

### Medium (future sprints)

11. Voicemail email notifications  
12. Call queues / ACD  
13. Bluetooth route picker UI  

---

## Go-Live Checklist

### Ops / Telnyx

- [ ] Set `API_PUBLIC_URL=https://your-api.example.com` in production `.env`
- [ ] Set `TELNYX_API_KEY`, `TELNYX_CALL_CONTROL_APP_ID`, `TELNYX_CREDENTIAL_CONNECTION_ID`
- [ ] Restart API — verify Call Control webhook auto-updates (`npm run validate:phase3b`)
- [ ] Telnyx Portal: FCM credentials on credential connection (Android push)
- [ ] Telnyx Portal: VoIP APNs key/certificate on credential connection (iOS push)
- [ ] Run `npm run validate:phase3b` — zero failures

### Tenant / number setup

- [ ] Number purchased and assigned to tenant (admin flow)
- [ ] Number on Telnyx **Call Control** connection (auto-sync on startup)
- [ ] Ring group includes `{ "type": "app", "userId": "<uuid>" }` members OR direct-user routing
- [ ] Ring strategy set (`simultaneous` or `sequential`) in greeting settings

### Android app

- [ ] Firebase project with Android app `com.vspvoip.mobile`
- [ ] `mobile/android/app/google-services.json` in place
- [ ] `mobile/android/key.properties` for release builds
- [ ] Install build: `flutter run --dart-define=API_BASE_URL=https://your-api.example.com`
- [ ] Phone tab shows “Push notifications registered” after login
- [ ] Test: foreground inbound → overlay Answer works on any tab
- [ ] Test: background/killed inbound → ConnectionService full-screen ring

### iOS app

- [ ] Apple Developer: Push Notifications + Background Modes (VoIP, audio)
- [ ] Xcode: development team + `Runner.entitlements` linked
- [ ] Physical device (simulator cannot receive VoIP push)
- [ ] Test: PushKit → CallKit → answer → two-way audio

### Browser softphone

- [ ] User opens `/softphone` and stays connected for inbound
- [ ] WebRTC credential connection configured

### Post-call verification

- [ ] Inbound call appears in Calls tab / portal call log
- [ ] Missed call → voicemail (if enabled) in portal `/voicemail`
- [ ] Simultaneous ring group: multiple agents ring; first answer wins

---

## Quick validation commands

```powershell
# Backend inbound readiness
npm run validate:phase3b

# Mobile (from repo root)
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=https://your-api.example.com
```

---

## Related documentation

- [Mobile inbound setup](../mobile/docs/inbound-calling-setup.md)
- Call Control routing: `lib/inboundCallControl.js`
- Validation script: `scripts/validate-phase3b.js`
