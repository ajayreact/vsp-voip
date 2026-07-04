# Phase 4.8 — Production Release Readiness

Final mobile-only hardening before enterprise deployment. **No backend changes. No new features.**

---

## Executive Summary

Phase 4.8 closes production gaps identified in security, memory, battery, startup, and store configuration audits. Telnyx native telephony (ConnectionService / CallKit / PushKit) was verified and left unchanged. The app is recommended for **staging validation** before production rollout.

---

## Performance Improvements

| Change | Impact |
|--------|--------|
| Lazy-loaded stack screens (messages, voicemail, contacts detail, call details, notifications) | Faster cold start; lower initial JS heap |
| Reduced tab preload (`Contacts`, `Recent` only) | Less background memory on Home load |
| Contacts directory polling paused when app backgrounded | Lower CPU when inactive |
| Thread sync interval no longer restarts on scroll | Stable 8s polling in conversation view |
| Dashboard notification badge uses store `unreadCount()` | Cleaner selector |

---

## Memory Improvements

| Change | Impact |
|--------|--------|
| `queryClient.clear()` on logout / session expiry | No cross-user data in React Query cache |
| Voicemail file cache capped at 5 entries + cleared on logout | Bounded disk/memory for audio temp files |
| Contacts query `gcTime` reduced to 30 min | Faster eviction of large directory cache |
| Lazy navigation imports | Fewer modules retained at startup |

---

## Battery Improvements

| Change | Impact |
|--------|--------|
| Contacts `refetchInterval` disabled in background | No 30s wake-ups when app inactive |
| (Phase 4.7) AppState-aware messaging/voicemail sync | Already slowing background polling |

---

## Accessibility Improvements

- Notification rows memoized (smoother list scrolling for assistive tech)
- Diagnostics clipboard auto-clears after 60s (reduced sensitive data exposure window)
- Phase 4.7 gate-screen accessibility retained

---

## Security Improvements

| Change | Severity addressed |
|--------|-------------------|
| SIP passwords moved from AsyncStorage → SecureStore | High |
| Legacy SIP password migration on load | High |
| QR provisioning rejects untrusted `apiUrl` hosts | Medium |
| Release builds fail fast if API URL is localhost | Medium |
| JWT SecureStore uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Medium |
| SIP debug logging UI hidden outside `__DEV__` | Low |
| Session caches cleared on logout / expiry | Medium |

---

## Native Platform Verification

| Platform | Component | Status |
|----------|-----------|--------|
| Android | ConnectionService (Telnyx plugin) | Unchanged — compliant |
| Android | FCM + VspFirebaseMessagingService | Unchanged |
| Android | Bluetooth / audio (InCallManager) | Unchanged; route sync from Phase 4.7 |
| iOS | CallKit + PushKit (Telnyx SDK) | Unchanged |
| iOS | Audio interruptions | Handled by SDK + InCallManager listeners |
| Both | Lock-screen answer | Native SDK path — not rewritten |

---

## Production Configuration

| Item | Status |
|------|--------|
| App icons | Present (`assets/icon.png`, adaptive Android) |
| Native splash | Added `expo-splash-screen` plugin |
| Permissions plugins | Added Face ID + photo library config plugins |
| Version | `1.0.0` in app.config / package.json |
| EAS build guards | API URL + google-services.json required for release |
| Debug flags | Telnyx `debug: __DEV__` only |
| Global error handler | Telemetry via allowlisted events; no stack to users |

---

## Test Results

```bash
npm run test:mobile
```

Expected: all mobile tests pass including new `production-readiness.test.ts`.

---

## Manual QA Checklist

Perform on physical devices before production:

| Area | Check |
|------|-------|
| Auth | Login, logout, remember me, biometric, QR login |
| Calling | In/out PSTN, internal extension, lock screen, Bluetooth, wired headset |
| Messaging | Send/receive, offline outbox, recovery |
| Voicemail | List, play, share |
| Notifications | Push, in-app center, deep links |
| Background | App backgrounded, killed, airplane mode, network switch |
| Settings | Diagnostics copy, devices, security |
| Accessibility | VoiceOver / TalkBack, large text, reduce motion |

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| End-user voicemail delete | Admin-only backend API — client hides locally |
| Mark voicemail unread | No PATCH endpoint |
| Self-service DND/forwarding | Requires TENANT_ADMIN |
| Change password | No authenticated endpoint |
| SIP export/share | May include credentials — user-initiated only |
| No third-party crash SDK | Relies on backend telemetry + ErrorBoundary |
| Font scale preference | Partially applied (gate screens); full rollout incremental |
| Preview EAS profile | Uses development APNS with production API |

---

## Deployment Notes

1. Set `EXPO_PUBLIC_API_BASE_URL=https://api.vspphone.com` for preview/production EAS builds.
2. Provide `GOOGLE_SERVICES_JSON` for Android release builds.
3. Use EAS `production` profile for App Store / Play Store (production APNS).
4. Run `npm run test:mobile` in CI before every release build.
5. Rebuild native client after `app.config.ts` plugin changes (splash, permissions).

---

## Backend Changes

**NONE**

---

## Production Readiness Score

**82 / 100**

Deductions: manual QA not executed in CI; known backend API gaps; no crash reporting SDK; font scale not global.

---

## Recommendation

**READY FOR STAGING**

Proceed with staged rollout on TestFlight / internal Play track. Complete manual QA checklist on physical devices, then promote to production after sign-off.
