# Mobile inbound calling setup (Phase 3)

Inbound calls on the Flutter app use **Telnyx WebRTC push** + native **CallKit (iOS)** / **ConnectionService (Android)** via `flutter_callkit_incoming`.

## Architecture

```
Inbound PSTN call
  → Telnyx Call Control (ring group member type: app)
  → Telnyx push (FCM Android / VoIP APNs iOS)
  → Native Answer/Decline UI (locked screen supported)
  → TelnyxClient.handlePushNotification()
  → WebRTC media session
  → POST /api/softphone/call-log (direction: inbound)
```

Foreground calls (app connected) also show in-app Answer/Decline on the **Phone** tab.

## Backend requirements

1. **Call Control** app configured (`TELNYX_CALL_CONTROL_APP_ID`)
2. **Credential connection** for WebRTC (`TELNYX_CREDENTIAL_CONNECTION_ID`)
3. Ring group member targeting the agent:
   ```json
   { "type": "app", "userId": "<user-uuid>", "label": "Mobile agent" }
   ```
4. Public API URL for webhooks (`API_PUBLIC_URL`)
5. Run migration for push token fields:
   ```powershell
   npx prisma migrate deploy
   ```

New API: `POST /api/softphone/push-token` — stores FCM/VoIP token on the user and passes it to Telnyx during WebRTC login.

## Android (FCM + ConnectionService)

1. Create a Firebase project and add an Android app with package `com.vspvoip.mobile`.
2. Download `google-services.json` → `mobile/android/app/google-services.json`
3. In Telnyx Portal → Credential Connection → enable **Push notifications** and upload your Firebase server key / service account as Telnyx docs specify.
4. Grant notification permission on Android 13+ when prompted.
5. Rebuild:
   ```powershell
   cd mobile
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
   ```

Without `google-services.json`, **foreground inbound** still works when the app is connected; **background push** requires Firebase.

## iOS (APNs + PushKit + CallKit)

1. Apple Developer → enable **Push Notifications** + **Background Modes** (VoIP, audio) for your App ID.
2. Create a **VoIP services** certificate/key and configure in Telnyx Portal for the credential connection.
3. Open the Xcode workspace and set your development team:
   ```powershell
   open ios/Runner.xcworkspace
   ```
4. `AppDelegate.swift` registers PushKit and forwards VoIP pushes to CallKit (already wired in this repo).
5. Run on a **physical device** — VoIP push does not work on simulator.

## Verify

| Check | Expected |
|---|---|
| Phone tab shows “Push notifications registered” | After login with Firebase/iOS token |
| Foreground inbound | In-app Answer/Decline card + native UI |
| Background inbound | Native full-screen incoming call UI |
| After hangup | Call appears in **Calls** tab as inbound |
| Dashboard | Total call count increments |

## Troubleshooting

- **No push when locked:** Confirm Telnyx credential connection has push configured and token is registered (Phone tab message).
- **Early answer before INVITE:** Handled automatically (`waitingForInvite` pattern in softphone controller).
- **Duplicate connect:** Do not call `connectWithToken` after `handlePushNotification` — the app checks pending push metadata before connecting.
