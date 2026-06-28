# Android Firebase setup — VSP Phone (React Native)

Package name: **`com.vspphone.mobile`** (must match `app.config.ts`).

The legacy Flutter app used **`com.vspvoip.mobile`** — that `google-services.json` **cannot** be reused for this app.

---

## 1. Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/) → project **`vsp-viop`** (or create a dedicated project).
2. **Add app** → Android.
3. Android package name: `com.vspphone.mobile`
4. Download **`google-services.json`**
5. Save to:

   ```
   mobile-rn/google-services.json
   ```

   (File is gitignored — do not commit.)

6. Enable **Cloud Messaging** (FCM) for the project.

---

## 2. Telnyx Portal

1. **Credential Connection** used by mobile softphone → **Push notifications** → Android.
2. Upload Firebase **service account JSON** (or server key per Telnyx docs for your SDK version).
3. Confirm push credential is linked to the same credential connection as WebRTC login tokens.

---

## 3. EAS build

Update `eas.json` preview profile (already set when `google-services.json` exists locally):

```json
"GOOGLE_SERVICES_JSON": "./google-services.json"
```

Build:

```powershell
cd mobile-rn
npx eas-cli build --profile preview --platform android
```

Optional — store file as EAS secret (CI builds without local file):

```powershell
npx eas-cli secret:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

---

## 4. Verify on device

After installing the preview APK:

| Check | Expected |
|-------|----------|
| Login | `https://api.vspphone.com` |
| Push registration | No “Firebase messaging unavailable” in logs |
| Foreground inbound call | Rings in app |
| Background / killed app | FCM → native incoming call UI (ConnectionService) |
| Outbound call | Telnyx registered |

---

## Troubleshooting

- **Build fails: GOOGLE_SERVICES_JSON not found** — place `google-services.json` at repo path or set EAS secret.
- **FCM token null** — wrong package in JSON; must be `com.vspphone.mobile`.
- **Push works on Flutter, not RN** — separate Firebase Android app registration required.
