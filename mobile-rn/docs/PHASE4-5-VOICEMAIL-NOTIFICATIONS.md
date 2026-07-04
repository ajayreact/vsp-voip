# Phase 4.5 – Voicemail, Notifications & Native Calling

Mobile-only changes under `mobile-rn/`. **No backend modifications.**

## Voicemail

- React Query list cache (`voicemailQueryCache.ts`) with incremental upserts — no full-screen reloads
- Authenticated streaming playback via `GET /api/tenant/voicemails/:id/stream` (`expo-av` + `expo-file-system` cache)
- Premium detail UI: contact/company/DID enrichment, play/pause/seek, share, mark read/unread (local unread), device-local remove
- AI Summary / Transcript placeholders on detail screen
- Background sync (`VoicemailSyncProvider`) with optional local notifications when `voicemailAlerts` is enabled

### Missing backend capability (report only)

| Capability | Status | Recommendation |
|------------|--------|----------------|
| Mark voicemail unread | No API (`PATCH .../read` sets `isRead: true` only) | Add `PATCH .../unread` or accept `{ isRead: boolean }` |
| Delete voicemail (end user) | Admin-only `DELETE` | Add tenant-user delete or soft-delete scoped to extension |

Client uses **device-local hide** for delete until backend supports end-user deletion.

## Notification Center

- Persistent store (`notificationsStore.ts`) with incremental upsert/mark read/clear
- Grouped list: Today / Yesterday / Earlier
- Deep links to voicemail, SMS thread, recents, settings
- Entry from Home bell icon → `NotificationsCenter`
- Registration warnings from phone connection status

## Push client

- Extended `appNotifications.ts` (messages + voicemail + missed call channels)
- Respects `messageAlerts`, `voicemailAlerts`; incoming calls remain native Telnyx/FCM/CallKit path
- Deep link handlers for voicemail and missed calls

## Call history

- Swipe: Call, Text, Star, Delete (local hide)
- Route param `initialFilter` for deep links (e.g. missed)

## Audio devices

- In-call audio route chip opens `AudioRoutePicker` (Phone, Speaker, Bluetooth, Wired)
- Auto-detect routes via `react-native-incall-manager` events
- Animated bottom sheet selection

## Native telephony

Existing Telnyx integration unchanged:

- Android: `VspFirebaseMessagingService` → Telnyx ConnectionService
- iOS: CallKit / PushKit via `withTelnyxVoice.js`
- Foreground RN incoming UI via `CallOverlay`

Verified against Telnyx React Voice Commons SDK usage — **no native telephony rewrite**.

## Performance

- FlashList on voicemail + notifications
- React Query cache patches
- Memoized rows and enrichment

## Tests

```bash
npm run test:mobile
```

Includes `voicemail-display.test.ts` and `notifications-store.test.ts`.
