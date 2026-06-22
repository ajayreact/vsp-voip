# VSP-VOIP Mobile (Flutter)

Tenant mobile app for the VSP-VOIP platform. It consumes the same Express REST API as the Next.js web portal (`http://localhost:3000`).

**Phase 1 (complete):** authentication, navigation, dashboard, call history, SMS inbox, recordings list, and profile — all wired to backend APIs.

**Phase 2 (complete):** outbound WebRTC softphone via `telnyx_webrtc` — dial pad, caller ID, mute/speaker, call logging, optional recording start.

**Phase 3 (complete):** inbound calling — Telnyx push, FCM (Android), PushKit + CallKit (iOS), ConnectionService, native Answer/Decline, call logging.

**Not included yet:** push notification for SMS, advanced multi-device routing.

See [docs/inbound-calling-setup.md](docs/inbound-calling-setup.md) for Firebase/APNs configuration.

## Repo layout

```
vsp-voip/
├── server.js              # Express API (port 3000)
├── web/                   # Next.js portal (port 3001)
└── mobile/                # Flutter app (this folder)
    └── lib/
        ├── main.dart
        ├── app.dart
        ├── config/        # API URL, Material 3 theme
        ├── core/          # Dio, storage, errors, formatters
        ├── features/      # auth, dashboard, softphone, calls, sms, recordings, profile
        ├── routing/       # go_router + auth redirects
        └── shared/        # reusable widgets + app shell
```

## Architecture

Clean architecture by feature:

| Layer | Responsibility |
|---|---|
| **presentation** | Screens, Material 3 UI, Riverpod `ConsumerWidget` |
| **providers** | Riverpod controllers + repository providers |
| **data** | Dio API clients, JSON models, repositories |
| **core** | Shared Dio client, secure token storage, error mapping |

### State management

- **Riverpod** — `AuthController`, feature `AsyncNotifier`s for each data screen
- **go_router** — auth redirects, bottom-nav shell via `StatefulShellRoute`
- **Dio** — HTTP with Bearer token interceptor
- **flutter_secure_storage** — persisted JWT

### Screens

| Screen | Route | API |
|---|---|---|
| Login | `/login` | `POST /api/auth/login` |
| Dashboard | `/dashboard` | `GET /api/dashboard/stats`, `GET /api/auth/me` |
| Call history | `/calls` | `GET /api/calls` |
| SMS inbox | `/sms` | `GET /api/sms/conversations` |
| SMS thread | `/sms/thread` | `GET /api/sms/messages` |
| Recordings | `/recordings` | `GET /api/tenant/recordings` |
| Profile | `/profile` | `GET /api/auth/me`, `GET /api/tenant/profile` |
| Softphone | `/softphone` | `GET /api/softphone/config`, `POST /api/softphone/token`, `POST /api/softphone/presence`, `POST /api/softphone/call-log`, `POST /api/softphone/record-start` |

### Softphone (Phase 2)

1. Open the **Phone** tab — the app loads Telnyx config and a login token.
2. Pick **Caller ID**, enter destination (E.164), tap **Call**.
3. Grant microphone permission when prompted.
4. Hang up to log the call to `POST /api/softphone/call-log` (shows in Call history).

**Telnyx setup:** Credential connection ID, outbound voice profile, webhook `{API_PUBLIC_URL}/webhook/voice`, and at least one tenant number.

## Prerequisites

1. [Flutter SDK](https://docs.flutter.dev/get-started/install) 3.16+ (latest stable recommended)
2. Android Studio and/or Xcode for emulators
3. API running from repo root: `npm run dev:api`
4. PostgreSQL seeded with a tenant user

## Setup

```powershell
cd mobile
flutter pub get
flutter doctor
```

## Build installable apps (local)

### Android APK (Windows / macOS / Linux)

```powershell
# From repo root — emulator API (10.0.2.2 = host machine from Android emulator)
npm run build:mobile:android

# Physical phone on same Wi‑Fi — replace with your PC's LAN IP
.\scripts\build-mobile-android.ps1 -ApiUrl "http://192.168.0.138:3000"

# Release APK (debug-signed if key.properties is missing)
npm run build:mobile:android:release
```

Output: `mobile/build/app/outputs/flutter-apk/app-debug.apk` (or `app-release.apk`).

Install:

```powershell
adb install -r mobile\build\app\outputs\flutter-apk\app-debug.apk
```

Start the API first: `npm run dev:api` (port 3000).

### iOS (macOS + Xcode only)

iOS builds cannot be produced on Windows. On a Mac:

```bash
chmod +x scripts/build-mobile-ios.sh
./scripts/build-mobile-ios.sh --simulator
# or for device (requires signing in Xcode):
./scripts/build-mobile-ios.sh --device
```

Open `mobile/ios/Runner.xcworkspace` in Xcode to run on simulator/device or archive for TestFlight.

## Run (development)

```powershell
# Android emulator — API on host machine
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000

# Physical device on same Wi‑Fi as your PC
flutter run --dart-define=API_BASE_URL=http://192.168.0.138:3000

# iOS simulator
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

From repo root:

```powershell
npm run dev:mobile
```

(Prints the recommended `flutter run` command.)

## Test login

| Role | Email | Password |
|---|---|---|
| Tenant admin | `admin@asuitech.com` | `Admin@123` |

Use a **tenant** account for dashboard, calls, SMS, and recordings. Super admin has limited tenant-scoped data.

## Shared UI components

- `LoadingView` — centered spinner
- `EmptyState` — icon + title for empty lists
- `ErrorView` — API error with retry
- `StatCard` — dashboard metric tile
- `AppShell` — bottom navigation wrapper

## Next phases

| Phase | Scope |
|---|---|
| **4** | SMS push notifications, multi-device polish |

## Notes

- Mobile apps call the API directly — no browser CORS.
- Android dev builds allow cleartext HTTP for local API testing.
- Recording playback opens the Telnyx URL in the system browser/player via `url_launcher`.
