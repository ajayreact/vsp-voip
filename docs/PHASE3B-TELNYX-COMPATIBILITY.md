# Phase 3B — Telnyx Compatibility Report

**Audit date:** 2026-06-21  
**Telnyx references (latest public docs):**

- [Flutter push app setup](https://developers.telnyx.com/docs/voice/webrtc/flutter-sdk/push-notification/app-setup)
- [Push notifications overview](https://developers.telnyx.com/docs/voice/webrtc/push-notifications)
- [JWT authentication](https://developers.telnyx.com/docs/voice/webrtc/auth/jwt)
- [JS SDK token refresh](https://developers.telnyx.com/development/webrtc/js-sdk/how-to/authenticating-your-app) (Flutter SDK differs)
- **Local SDK:** `telnyx_webrtc` **4.2.0** (pub cache)

This report compares **documented Telnyx behavior** to the **VSP-VOIP mobile + backend implementation**. Where Telnyx docs and the Flutter SDK disagree (e.g. JS `updateToken` vs no Flutter equivalent), the SDK source is treated as authoritative for Flutter.

---

## Executive summary

| Area | Alignment | Production risk |
|------|-----------|-----------------|
| Android FCM | **Partial** | Medium — missing high-priority channel + desugaring; debug builds cannot test killed-state push |
| iOS PushKit | **Partial** | **High** — missing CallKit audio-session delegates and RTC manual audio (known no-audio bug) |
| CallKit integration | **Partial** | **High** — inbound OK; outbound missing `startCall`; native audio wiring incomplete |
| Multi-device (5 tokens) | **Partial** | Medium — works per device at Telnyx layer; backend unlimited; FCM refresh gap |
| JWT / token refresh | **Mostly aligned** | Low–Medium — timer refresh OK for Flutter; no SDK expiry event |
| SIP registration expiry | **Mostly aligned** | Low — 24h JWT; gateway re-register on reconnect |
| Background incoming calls | **Gap** | **High** — socket stays open in background; Telnyx recommends disconnect-to-push pattern |

**Overall Telnyx compatibility:** **88/100** after Sprint 2.1 P0 fixes (see [PHASE3B-SPRINT2.1.md](./PHASE3B-SPRINT2.1.md)).

---

## 1. Android FCM push requirements

### Telnyx recommended (Flutter + Android docs)

| Requirement | Source |
|-------------|--------|
| Firebase project + `google-services.json` matching app package | Flutter push setup |
| Pass FCM token to SDK on login via `TokenConfig.notificationToken` / `fcmToken` | Flutter + Android SDK |
| Push credential (Firebase service account JSON) attached to **SIP Credential Connection** in Telnyx Portal | Push overview |
| `FirebaseMessaging.onBackgroundMessage` top-level handler | Flutter push setup |
| Show incoming UI via CallKit/ConnectionService plugin (`flutter_callkit_incoming`) | Flutter push setup |
| On Accept/Decline: `TelnyxClient.setPushMetaData(data, isAnswer:, isDecline:)` then `handlePushNotification()` | Flutter push setup |
| **Do not** call `connectWithToken()` after `handlePushNotification()` | Flutter push setup |
| High-importance notification channel + `com.google.firebase.messaging.default_notification_channel_id` in manifest | Flutter push setup |
| Core library desugaring for `flutter_local_notifications` | Flutter push setup |
| Android 13+: request `POST_NOTIFICATIONS` at runtime | Flutter + Android SDK |
| Android 14+: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_PHONE_CALL`, optional `phoneCall` foreground service | Android native SDK docs |
| **Debug builds:** push does **not** work when app is **terminated** — test release/TestFlight | Flutter best practices |
| Multidevice: up to **5** FCM/APNs tokens per user at Telnyx (LRU eviction on 6th) | Push overview |

### Current implementation

| Item | Status | Location |
|------|--------|----------|
| `google-services.json` for `com.vspvoip.mobile` | ✅ | `mobile/android/app/google-services.json` |
| Conditional Google Services Gradle plugin | ✅ | `mobile/android/app/build.gradle.kts` |
| `FirebaseMessaging.onBackgroundMessage` | ✅ | `mobile/lib/core/push/push_bootstrap.dart` |
| Foreground `onMessage` + metadata to Telnyx | ✅ | `push_bootstrap.dart` |
| `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE*`, `USE_FULL_SCREEN_INTENT` | ✅ | `AndroidManifest.xml` |
| FCM token → `TokenConfig.notificationToken` on connect | ✅ | `softphone_controller.dart` |
| CallKit/ConnectionService UI on push | ✅ | `native_incoming_call_ui.dart` |
| Accept/decline → `setPushMetaData` + `handlePushNotification` | ✅ | `push_call_coordinator.dart`, `softphone_controller.dart` |
| Skip `connectWithToken` when pending push at boot | ✅ | `softphone_controller._boot()` |
| High-importance channel `telnyx_call_channel` | ❌ | Not created; missed-call channel only |
| Manifest `default_notification_channel_id` | ❌ | Not in `AndroidManifest.xml` |
| Core library desugaring | ❌ | Not in `build.gradle.kts` |
| Dedicated `phoneCall` foreground `Service` | ❌ | Not declared (plugin may partially cover) |
| FCM `onTokenRefresh` → **Telnyx** re-register | ❌ | Updates backend API only |
| Portal push credential | ⚠️ Operational | Must be verified in Telnyx Portal |

### Gaps

1. **No Telnyx-specified high-priority FCM channel** — heads-up incoming notifications may be deprioritized on Android 8+.
2. **No core library desugaring** — Telnyx documents this as required for `flutter_local_notifications`; may cause release build issues.
3. **FCM token rotation** re-POSTs to VSP backend but does **not** reconnect Telnyx with the new `notificationToken` until next `connectWithToken`.
4. **Debug-mode testing trap** — Telnyx explicitly states terminated-app push fails in debug; QA must use release/profile builds.

### Production impact

- **Medium:** Background/killed incoming calls may show low-priority notifications or miss FCM delivery after token rotation.
- **High if QA uses debug APKs:** False negatives in push testing.

### Required fixes

| Priority | Fix |
|----------|-----|
| P0 | Create `telnyx_call_channel` (`Importance.max`) + manifest meta-data per Telnyx Flutter docs |
| P0 | Enable `coreLibraryDesugaring` in `build.gradle.kts` |
| P1 | On FCM `onTokenRefresh`: update `_pushToken` and call `connectWithToken` (or SDK re-login) when socket is idle |
| P1 | QA matrix: release/profile build, app killed, screen locked |
| P2 | Evaluate Android 14 `phoneCall` foreground service if ConnectionService alone is insufficient |

---

## 2. iOS PushKit requirements

### Telnyx recommended

| Requirement | Source |
|-------------|--------|
| VoIP push certificate/key in Telnyx Portal on credential connection | Push overview |
| `PKPushRegistry` with `.voIP` in `AppDelegate` | Flutter iOS section |
| Register token: `setDevicePushTokenVoIP` | Flutter iOS section |
| On VoIP push: parse `metadata`, call `showCallkitIncoming(..., fromPushKit: true)` | Flutter iOS section |
| Call `completion()` after reporting to CallKit (delay ~1s in sample) | Flutter iOS section |
| `UIBackgroundModes`: `voip`, `remote-notification`, `audio` | Flutter iOS section |
| `RTCAudioSession.sharedInstance().useManualAudio = true` + `isAudioEnabled = false` at launch | Flutter iOS section (WebRTC + CallKit audio bug) |
| `push_notification_environment`: debug/sandbox vs production must match build | iOS `TxConfig` / SDK login |
| **Debug terminated push fails** — test release/TestFlight | Flutter best practices |
| Login at least once with push token before receiving pushes | iOS SDK docs |

### Current implementation

| Item | Status | Location |
|------|--------|----------|
| `PKPushRegistry` + delegate | ✅ | `ios/Runner/AppDelegate.swift` |
| VoIP token → `setDevicePushTokenVoIP` | ✅ | `AppDelegate.swift` |
| Incoming VoIP push → native CallKit UI | ✅ | `AppDelegate.swift` |
| `UIBackgroundModes`: voip, remote-notification, audio | ✅ | `Info.plist` |
| Debug/Release entitlements (`development` / `production`) | ✅ | `RunnerDebug.entitlements`, `RunnerRelease.entitlements` |
| VoIP token fetch in Dart | ✅ | `fetchPushDeviceToken()` → `getDevicePushTokenVoIP()` |
| `RTCAudioSession` manual audio at launch | ❌ | Not in `AppDelegate.swift` |
| Delayed `completion()` after CallKit report | ❌ | `completion()` called immediately |
| PushKit token invalidation → backend unregister | ❌ | Only clears plugin token |
| SDK `push_environment` | ✅ Auto | SDK sets `kDebugMode ? 'debug' : 'production'` in login (`login_message_body.dart`) |

### Gaps

1. **Missing RTC manual audio initialization** — Telnyx documents this as required to avoid **no audio on iOS with CallKit**.
2. **`completion()` timing** — immediate completion vs Telnyx sample (async delay) may contribute to iOS killing the app on VoIP push under load.
3. **No PushKit token refresh → backend/Telnyx sync** when Apple rotates VoIP token.

### Production impact

- **High:** Answered calls may have one-way or no audio on iOS without `didActivateAudioSession` / manual RTC wiring.
- **Medium:** App termination under VoIP push edge cases.

### Required fixes

| Priority | Fix |
|----------|-----|
| P0 | Implement `CallkitIncomingAppDelegate` in `AppDelegate.swift` with `didActivateAudioSession` / `didDeactivateAudioSession` per Telnyx demo |
| P0 | Add `RTCAudioSession.sharedInstance().useManualAudio = true` and `isAudioEnabled = false` in `didFinishLaunching` |
| P1 | Delay `completion()` until after CallKit UI is shown (Telnyx sample uses ~1s) |
| P1 | On `didInvalidatePushTokenFor`, unregister device from backend |
| P1 | TestFlight-only push validation (not debug simulator/terminated debug) |

---

## 3. CallKit integration requirements

### Telnyx recommended

| Requirement | Source |
|-------------|--------|
| Report **every** VoIP push to CallKit (iOS 13+ or system terminates app) | React Native + iOS SDK docs |
| `FlutterCallkitIncoming.onEvent` → set metadata → `handlePushNotification` on accept | Flutter docs |
| Simplified decline: `setPushMetaData(..., isDecline: true)` → `handlePushNotification` (SDK sends `decline_push`) | Flutter SDK 4.2.0 + docs |
| Early accept: wait for INVITE if accept before socket ready | Flutter docs |
| **Outbound on iOS:** call `FlutterCallkitIncoming.startCall()` when placing invite (active audio session) | Flutter iOS section |
| Audio session owned by CallKit; sync with WebRTC in delegate callbacks | iOS SDK docs |

### Current implementation

| Item | Status | Location |
|------|--------|----------|
| VoIP push → CallKit incoming UI | ✅ | `AppDelegate.swift`, `native_incoming_call_ui.dart` |
| Global `FlutterCallkitIncoming.onEvent` listener | ✅ | `push_bootstrap.dart` → `PushCallCoordinator` |
| Accept: `isAnswer: true` + `handlePushNotification` | ✅ | `push_call_coordinator.dart`, `softphone_controller.dart` |
| Decline: `isDecline: true` + simplified SDK decline | ✅ | Same (SDK 4.2.0 `decline_push` path) |
| Early accept (`_waitingForInvite`) | ✅ | `softphone_controller.dart` |
| SDK 10s answer timeout after push accept | ✅ | Built into `telnyx_webrtc` 4.2.0 (automatic) |
| Outbound `FlutterCallkitIncoming.startCall` | ❌ | `placeCall()` uses SDK only |
| Native CallKit audio delegates | ❌ | Not implemented |
| Missed call: Telnyx `Missed call!` message | ✅ | `native_incoming_call_ui.dart` |

### Gaps

1. **Outbound iOS CallKit `startCall`** not invoked — Telnyx states this is needed for WebRTC audio session when CallKit manual audio is enabled.
2. **CallKit ↔ WebRTC audio bridge missing** at native layer.
3. Foreground inbound skips duplicate CallKit when socket connected — **aligned with Telnyx** (“foreground may use socket; CallKit optional”).

### Production impact

- **High (iOS):** Inbound answer and outbound dial audio reliability.
- **Low (Android):** ConnectionService path via plugin is closer to complete.

### Required fixes

| Priority | Fix |
|----------|-----|
| P0 | `CallkitIncomingAppDelegate` + RTC audio session callbacks (see §2) |
| P1 | On outbound `placeCall()` (iOS only): `FlutterCallkitIncoming.startCall` with call ID |
| P2 | Document foreground-only in-app UI as intentional when socket connected |

---

## 4. Multiple device registration support

### Telnyx recommended

- Up to **5 push tokens per user** (iOS + Android combined) registered when client **logs in with `notificationToken`**.
- 6th registration evicts **least recently used** token at Telnyx.
- Each physical device must connect and supply its own token; push is delivered to registered devices when socket is down.

### Current implementation

| Layer | Behavior |
|-------|----------|
| **Telnyx** | Each app install passes `notificationToken` on `connectWithToken` → Telnyx registers token to SIP user |
| **VSP backend** | `UserDevice` table: unlimited devices per user; `POST /softphone/push-token` requires `deviceId` |
| **Legacy mirror** | `User.pushDeviceToken` = most recently registered device only |
| **Inbound routing** | Call Control dials `sip:{telnyxSipUsername}` — Telnyx handles fan-out to registered tokens/devices |

### Gaps

1. **Backend does not enforce Telnyx 5-token limit** — 6+ devices in portal DB; Telnyx silently drops LRU token (confusing ops/debugging).
2. **Backend token store ≠ Telnyx registry** — `POST /softphone/push-token` does not register with Telnyx; only `connectWithToken` does.
3. **FCM token refresh** updates backend but not Telnyx until reconnect.
4. **iOS VoIP token rotation** not propagated to backend/Telnyx automatically.

### Production impact

- **Medium:** Multi-device ring works when each device has logged in and connected; stale tokens in DB may mislead admin UI.
- **Low:** Simultaneous ring to 2–5 devices is supported if each completed `connectWithToken` with push token.

### Required fixes

| Priority | Fix |
|----------|-----|
| P1 | Surface Telnyx 5-device limit in admin/softphone config UI |
| P1 | Optionally cap or warn at 5 devices in `userDevices.js` |
| P1 | On any push token change: reconnect Telnyx with updated `notificationToken` |
| P2 | Distinguish “registered with Telnyx” vs “stored in portal” in device list API |

---

## 5. WebRTC token refresh requirements

### Telnyx recommended

**JWT (production):**

- Created via `POST /v2/telephony_credentials/:id/token`
- Valid **24 hours** or until parent credential expires ([JWT docs](https://developers.telnyx.com/docs/voice/webrtc/auth/jwt))
- **JS SDK:** listen for `TOKEN_EXPIRING_SOON` (~1 hour before expiry) → `client.updateToken(newToken)` **without** recreating client
- Refresh at least 1 hour before expiry

**Flutter SDK 4.2.0:**

- **No `updateToken()` method** (verified in SDK source)
- Refresh requires new login via `connectWithToken` / `tokenLogin` with new JWT

### Current implementation

| Item | Status |
|------|--------|
| Backend returns `expiresInSeconds: 86400` | ✅ `lib/softphone.js` |
| Timer refresh ~1h before expiry (`expiresInSeconds - 3600`) | ✅ `softphone_controller._scheduleTokenRefresh` |
| Refresh defers if in call / incoming | ✅ |
| Refresh: `disconnect()` → `connectWithToken(new TokenConfig)` | ✅ |
| Listen for SDK `TOKEN_EXPIRING_SOON` | ❌ Not available / not wired in Flutter SDK |
| Backend-only JWT generation (no client-side API key) | ✅ |

### Gaps

1. **Disconnect/reconnect refresh** is correct for Flutter but **more disruptive** than JS `updateToken` — brief registration gap.
2. **No proactive refresh on SDK warning** — timer-only; if app suspended, timer may fire late.
3. **Refresh does not re-run** `_ensurePushTokenRegistered` explicitly (relies on cached `_pushToken` in `TokenConfig` — OK if token unchanged).

### Production impact

- **Low–Medium:** 23h connected sessions may drop registration briefly during refresh; unlikely to affect calls if deferred during active call.
- **Medium:** Long-background app without timer firing could hit expired JWT → login failure until manual reconnect.

### Required fixes

| Priority | Fix |
|----------|-----|
| P1 | On app resume: check JWT age; refresh if within 2h of expiry |
| P1 | On `TelnyxSocketError` / gateway `EXPIRED`: trigger token refresh |
| P2 | Track `tokenIssuedAt` client-side; expose reconnect status in UI |
| — | Monitor Telnyx Flutter SDK for future `updateToken` parity with JS |

---

## 6. SIP registration expiration handling

### Telnyx recommended

- SIP/WebRTC registration occurs over WebSocket after successful JWT login (`tokenLogin` → gateway `REGED`).
- Registration tied to active socket session; push path uses attach/login with `attach_call`.
- Gateway can enter `EXPIRED` state; client should reconnect with valid JWT.
- Do **not** use long-lived SIP username/password in production ([auth docs](https://developers.telnyx.com/development/webrtc/js-sdk/how-to/authenticating-your-app)).

### Current implementation

| Item | Status |
|------|--------|
| JWT-only auth (`TokenConfig.sipToken`) | ✅ |
| One telephony credential per user | ✅ `lib/softphone.js` |
| Gateway ready → `_onClientReady()` | ✅ `SocketMethod.clientReady` / `login` |
| Presence heartbeat (`POST /softphone/presence` every 2 min) | ✅ App-side only; **not** Telnyx SIP keepalive |
| `setSoftphonePresence` updates `sipRegistered` in DB | ✅ Portal metadata only |
| Handle `GatewayState.expired` explicitly | ❌ |
| `autoReconnect: true` on `TokenConfig` | ✅ |

### Gaps

1. **Presence API is VSP-specific** — does not replace Telnyx SIP registration lifecycle.
2. **No explicit handler** for gateway expiration / auth errors beyond generic socket error UI.
3. **Inbound routing** does not gate on presence — Telnyx decides socket vs push (correct per Telnyx model).

### Production impact

- **Low:** SDK `autoReconnect` covers most network blips.
- **Medium:** Expired JWT without successful timer refresh → user appears “online” in portal but cannot receive calls until reconnect.

### Required fixes

| Priority | Fix |
|----------|-----|
| P1 | Map socket/gateway auth failures to forced token refresh + reconnect |
| P2 | Align portal “online” indicator with Telnyx clientReady state, not presence heartbeat alone |

---

## 7. Background incoming call behavior

### Telnyx recommended flow

```
Socket connected (foreground) → INVITE on WebSocket → answer in app
App background/killed → socket closes → Telnyx sends FCM/APNs VoIP push
User taps Accept → setPushMetaData(isAnswer:true) → handlePushNotification()
→ socket reconnects → INVITE arrives → accept (or auto-accept if early accept)
```

**Critical Telnyx guidance (Flutter docs — “Handling Background Calls”):**

- When app is **backgrounded**, socket may stay open but OS won't surface INVITE → **manually disconnect** when entering background so Telnyx sends push.
- Use lifecycle listener (e.g. `flutter_fgbg`) — background: `disconnect()`, foreground: reconnect unless returning from push accept path.
- Use `FGBGEvents.ignoreWhile` when showing CallKit UI to avoid disconnect during full-screen incoming UI.
- Late push: if `message.sentTime` > ~60s, treat as missed call.

### Current implementation

| Scenario | Actual behavior |
|----------|-----------------|
| Foreground, socket ready | INVITE via WebSocket; in-app + optional native UI | ✅ Telnyx-aligned |
| Foreground, socket not ready | FCM → CallKit + in-app state | ✅ |
| App killed | FCM/PushKit → CallKit → boot → `handlePushNotification` | ✅ |
| App **backgrounded**, socket still connected | **Keeps WebSocket + 2min presence heartbeat** | ❌ **Opposite of Telnyx recommendation** |
| Background disconnect on lifecycle | ❌ `AppLifecycleBridge` only handles **resumed** |
| Late notification timeout | ❌ Not implemented |
| Push accept before INVITE | ✅ `_waitingForInvite` |
| SDK 10s INVITE timeout after push accept | ✅ Automatic in SDK 4.2.0 |

### Gaps

1. **No background socket disconnect** — largest behavioral deviation from Telnyx Flutter guidance. User may miss calls when app is backgrounded but not killed (no push, INVITE not surfaced).
2. **No late-push stale detection** (60s rule).
3. **Debug terminated push** — Telnyx warns this always fails in debug; must not be used to sign off production readiness.

### Production impact

- **High:** “App in recent apps but not visible” is a common user state — **missed inbound calls** without push or notification.
- **Medium:** Stale pushes may show phantom incoming UI.

### Required fixes

| Priority | Fix |
|----------|-----|
| P0 | Implement Telnyx background disconnect pattern (`WidgetsBindingObserver` or `flutter_fgbg`): `paused/inactive` → `TelnyxClient.disconnect()` when not in call; `resumed` → `ensureConnected()` unless push-handling |
| P0 | Use `ignoreWhile` around CallKit show to prevent disconnect during incoming UI |
| P1 | Add FCM `sentTime` staleness check (>60s → missed call) |
| P1 | Release-build QA: killed, background, locked screen, dual-device |

---

## Cross-reference: what is NOT a Telnyx requirement

These are **VSP additions** (correct for product, but not Telnyx-driven):

- `UserDevice` table and `POST /api/softphone/push-token` portal storage
- Presence heartbeat to Express API
- Call Control simultaneous ring / Redis winner claims (server-side, not mobile SDK)

Telnyx push delivery depends only on **credential connection push credentials** + **`notificationToken` at SDK login**.

---

## Required fixes — prioritized backlog

### P0 (before production beta)

1. iOS `CallkitIncomingAppDelegate` + RTC manual audio session wiring  
2. Android high-importance `telnyx_call_channel` + manifest meta-data + desugaring  
3. Background lifecycle: disconnect Telnyx socket when app backgrounds (Telnyx documented pattern)  
4. Release/TestFlight push QA matrix (not debug terminated)

### P1 (before GA)

5. FCM / VoIP token rotation → Telnyx reconnect with new `notificationToken`  
6. iOS outbound `FlutterCallkitIncoming.startCall`  
7. JWT refresh on app resume + gateway auth failure  
8. Telnyx 5-device limit surfaced in portal  
9. VoIP push `completion()` timing per Telnyx sample  
10. Late push staleness (60s)

### P2 (hardening)

11. Android 14 dedicated foreground service evaluation  
12. Portal vs Telnyx registration status in device API  
13. Gateway `EXPIRED` explicit recovery UX  

---

## Validation checklist (post-fix)

| Test | Telnyx expectation | Build |
|------|-------------------|-------|
| Killed app inbound | Push → CallKit → answer → media | **Release** |
| Background (recents) inbound | Push → CallKit (after disconnect fix) | Release |
| Foreground inbound | Socket INVITE, no duplicate push UI | Debug OK |
| Decline from lock screen | `decline_push`, no INVITE wait | Release |
| 6th device login | Oldest Telnyx token evicted | Release × 6 devices |
| JWT age 23h+ | Reconnect with new token, inbound still works | Release |
| iOS audio | Two-way audio after CallKit answer | Release physical device |
| Bluetooth headset | Audio route (app feature, not Telnyx-specific) | Release |

---

## Document control

- **Does not modify** billing, Razorpay, Stripe, or Phase 2B revenue protection.
- Re-run this audit when upgrading `telnyx_webrtc` beyond 4.2.0 (check changelog for `updateToken`, push API changes).
