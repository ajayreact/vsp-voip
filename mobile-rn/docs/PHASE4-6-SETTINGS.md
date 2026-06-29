# Phase 4.6 – Settings, Security & Device Management

Mobile-only changes under `mobile-rn/`. **No backend modifications.**

## Settings home

The **You** tab is now a grouped enterprise settings hub:

- Account (profile, company, extension, business DID)
- Phone system (SIP status, QR provisioning, SIP config, devices, device info)
- Calling, voicemail, messaging, notifications
- Security, appearance, diagnostics, support

Each section navigates to a focused screen. Lists use incremental React Query cache updates (devices, diagnostics) — no full-screen reload loops.

## Device management

Uses existing APIs:

| API | Purpose |
|-----|---------|
| `GET /api/softphone/devices` | List registered devices |
| `DELETE /api/softphone/devices/:deviceId` | Remove / logout device |
| Push re-register via `registerPushWithBackend()` | Refresh registration (client) |
| QR re-provision | `QrProvision` screen (existing mobile provision flow) |

## Security

| Feature | Implementation |
|---------|----------------|
| Biometric login | `authPreferences` + existing biometric auth |
| Remember me | `authPreferences` |
| Active sessions | Mapped to **Devices** screen |
| Change password | **Report only** — no authenticated API |
| Logout | Existing auth logout |

## Diagnostics

| Source | Data |
|--------|------|
| Client live | SIP, push, network, app version, build, API URL |
| `GET /api/softphone/diagnostics` | Server inbound/outbound readiness, device count, fix hints |

**Copy diagnostics** writes a plaintext report to the clipboard.

## Calling preferences

Read-only from `GET /api/tenant/extensions` (user's extension via `userId` match).

**Missing self-service API:** `PATCH /api/tenant/extensions/:id/business` requires `TENANT_ADMIN` — regular users cannot toggle DND, forwarding, or recording from mobile.

## Client-only preferences

Stored in AsyncStorage via `settingsStore.clientPrefs`:

- Voicemail playback speed (wired to `expo-av` rate)
- Voicemail auto-download flag
- Messaging delivery reports (placeholder)
- Font size preference
- Language (English only for now)

## Telephony impact

**None.** Refresh registration only re-posts push token and bumps existing push sync — no SIP/WebRTC/CallKit changes.

## Tests

```bash
npm run test:mobile
```

Includes `settings-diagnostics.test.ts`.

## Missing backend capabilities (report)

| Capability | Root cause | Recommendation |
|------------|------------|----------------|
| Change password (authenticated) | Only forgot/reset token flow exists | Add `POST /api/auth/change-password` |
| Self-service DND / forwarding / recording | Business PATCH is admin-only | Add user-scoped extension preferences endpoint |
| Active sessions list | No JWT session API | Optional session registry + revoke |
| Logout all other devices (single call) | Only per-device DELETE | Optional bulk revoke endpoint |
