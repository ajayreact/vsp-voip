# Phase 4.7 — Native Platform Excellence

Mobile-only polish for startup, battery, accessibility, audio route sync, and error handling. **No backend changes.**

## Summary

Phase 4.7 improves perceived startup time, background battery usage, native audio route consistency, accessibility on gate screens, and crash UX — without modifying Telnyx ConnectionService/CallKit integration or any backend APIs.

## Performance Improvements

- **Removed 400ms artificial splash delay** — splash hides as soon as bootstrap + settings hydration complete.
- **Deferred sync providers** — messaging/voicemail sync mounts only when the user is authenticated (`AuthenticatedSyncProviders`).
- **Single call overlay modal** — one `Modal` instead of two stacked modals during call transitions.

## Native Improvements

- **Audio route ↔ store sync** — Bluetooth/headset changes from the OS update `callingStore.speakerOn` so UI matches the active route.
- **Telnyx native telephony unchanged** — ConnectionService, CallKit, PushKit, and FCM call push remain owned by `@telnyx/react-voice-commons-sdk` and existing VSP plugins.

## Accessibility Improvements

- **Offline / session expired / error boundary** — alert roles, headers, hints, and live regions.
- **Reduce motion** — stack navigators respect system “Reduce Motion” via `useStackScreenOptions`.
- **Font size preference** — `fontScale` wired into theme context; gate screens scale typography from Appearance settings.

## Battery Optimizations

- **AppState-aware sync intervals** (`createAppStateAwareInterval`):
  - Messaging: 10s foreground → 60s background; outbox 15s → 90s.
  - Voicemail: 30s foreground → 120s background.
- Sync providers no longer run during login/splash/offline gate.

## Offline / Startup

- **NetInfo.fetch() on launch** — avoids false offline gate before the first connectivity event.
- React Query `offlineFirst` and existing caches unchanged.

## Files Modified

| Area | Files |
|------|--------|
| Startup | `RootNavigator.tsx`, `useSyncAppOnline.ts`, `App.tsx` |
| Battery | `appStateSync.ts`, `MessagingSyncProvider.tsx`, `VoicemailSyncProvider.tsx`, `AuthenticatedSyncProviders.tsx` |
| Audio | `useAudioRoute.ts` |
| Performance | `CallOverlay.tsx` |
| Accessibility | `OfflineScreen.tsx`, `SessionExpiredScreen.tsx`, `ErrorBoundary.tsx`, `Button.tsx`, `screenOptions.ts`, `useStackScreenOptions.ts`, stack navigators, `typography.ts`, `ThemeContext.tsx` |
| Tests | `tests/mobile/app-state-sync.test.ts`, `tests/mobile/components/error-boundary.test.ts` |

## Tests Executed

```bash
npm run test:mobile
```

## Remaining Work

- Apply `fontScale` to additional screens beyond gate/error flows (incremental).
- Per-screen accessibility audit for dynamic type on custom fixed font sizes.
- Optional: lazy `getComponent` on remaining heavy settings screens (already partial).

## Backend Changes

**NONE**
