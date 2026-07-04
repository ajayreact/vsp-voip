# Android Studio — build & run

## Why the app force-closes

### 1. Debug build without Metro (most common)

By default, Android **debug** builds do **not** embed the JavaScript bundle. They expect Metro to be running.

**Option A — Run with Metro (development):**

```powershell
cd mobile-rn
$env:EXPO_PUBLIC_API_BASE_URL = "https://api.vspphone.com"
npm start
```

In another terminal / Android Studio: Run the app on your device.

**Option B — Standalone debug APK (no Metro):**

This repo sets `debuggableVariants = []` in `android/app/build.gradle` so **debug builds embed the JS bundle**. After pulling latest code, rebuild:

```powershell
cd mobile-rn/android
.\gradlew assembleDebug
```

Install: `android/app/build/outputs/apk/debug/app-debug.apk`

### 2. Release / production APK (recommended for testing)

```powershell
cd mobile-rn
$env:EXPO_PUBLIC_API_BASE_URL = "https://api.vspphone.com"
$env:GOOGLE_SERVICES_JSON = "./google-services.json"
$env:NODE_ENV = "production"
npx expo run:android --variant release
```

APK output: `android/app/build/outputs/apk/release/app-release.apk`

### 3. EAS cloud build (same as CI)

```powershell
cd mobile-rn
npx eas-cli build --profile preview --platform android
```

---

## Required files

- `mobile-rn/google-services.json` — Firebase Android config (`com.vspphone.mobile`)
- See [ANDROID-FIREBASE-SETUP.md](./ANDROID-FIREBASE-SETUP.md)

---

## If it still crashes

Connect the phone via USB and capture logs:

```powershell
adb logcat -c
# Open app, wait for crash, then:
adb logcat -d | Select-String "FATAL|AndroidRuntime|ReactNative|vspphone"
```

Paste the output when reporting the issue.

---

## Gradle warnings

Deprecation warnings in `problems-report.html` are **not** crash causes. They can be ignored for now.

`NODE_ENV` warning during `:expo-constants:createExpoConfig` is harmless for local builds; set `$env:NODE_ENV = "production"` for release builds.
