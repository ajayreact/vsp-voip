# Phase 4 — Development Sequence

Approved build order for the React Native client. **Complete each phase fully before starting the next.**

| Phase | Focus | Status |
|-------|-------|--------|
| **4.1** | Authentication & device provisioning | **Complete** — [PHASE4-1-AUTH.md](../../../mobile-rn/docs/PHASE4-1-AUTH.md) |
| **4.2** | Calling UI | **Done** — see `mobile-rn/docs/PHASE4-2-CALLING.md` |
| **4.3** | Contacts & communication | **Done** — [PHASE4-3-CONTACTS.md](../../../mobile-rn/docs/PHASE4-3-CONTACTS.md) |
| **4.4** | Business Messaging | **Complete** — [PHASE4-4-MESSAGING.md](../../../mobile-rn/docs/PHASE4-4-MESSAGING.md) |
| **4.5** | Settings | Planned |
| **4.6** | Performance & polish | Planned |

Rules for all phases: [03-mobile-development-rules.md](./03-mobile-development-rules.md)

---

## Phase 4.4 — Business Messaging

| Screen | Primary UI |
|--------|------------|
| Conversations | `screens/messages/ConversationListScreen.tsx` |
| Thread | `screens/messages/ConversationThreadScreen.tsx` |
| Compose | `screens/messages/NewMessageScreen.tsx` |
| Search | `screens/messages/MessageSearchScreen.tsx` |

Extend: `messaging/messagingService.ts`, `outboxStore.ts`, `MessagingSyncProvider.tsx` — do not replace.

---

## Phase 4.2 — Calling UI

Modernize calling screens. **Extend existing telephony modules — do not replace.**

| Screen / flow | Primary UI | Inspect before changing |
|---------------|------------|-------------------------|
| Home | `screens/dashboard/DashboardScreen.tsx` | `dashboard/dashboardService.ts`, `store/appStore.ts` |
| Dial Pad | `screens/calls/DialPadScreen.tsx` | `calling/callingController.ts`, `components/vsp/VspDialPad.tsx` |
| Incoming Call | `screens/calls/IncomingCallScreen.tsx` | `calling/CallOverlay.tsx`, `calling/telnyxCallMapping.ts` |
| Outgoing Call | Dial pad + active preview | `calling/callingController.ts`, `store/callingStore.ts` |
| In-Call Screen | `screens/calls/ActiveCallScreen.tsx` | `calling/audioRoute.ts`, `calling/callSessionTracker.ts` |

Telephony stack (read-only unless bug fix):

- `calling/TelnyxCallingProvider.tsx` — SDK lifecycle, registration
- `calling/telnyxVoip.ts` — Telnyx client singleton
- `calling/callingController.ts` — answer, hangup, dial, hold, mute
- `calling/softphoneService.ts` — backend API (`/api/softphone/*`)
- `store/callingStore.ts` — call state for UI

---

## Phase 4.3 — Contacts & communication

| Screen / flow | Primary UI | Inspect before changing |
|---------------|------------|-------------------------|
| Contacts | `screens/contacts/ContactsListScreen.tsx` | `contacts/contactsService.ts`, `hooks/useContacts.ts` |
| Favorites | TBD / extend | `store/favoritesStore.ts` |
| Recents | `screens/calls/RecentCallsScreen.tsx` | `hooks/useRecentCalls.ts`, `calling/callsService.ts` |
| Call History | `screens/calls/CallDetailsScreen.tsx` | `calling/callLogParties.ts`, `calling/groupRecentCalls.ts` |
| Voicemail | `screens/voicemail/*` | `voicemail/index.ts`, portal API usage |

---

## Phase 4.4 — Settings

| Screen / flow | Primary UI | Inspect before changing |
|---------------|------------|-------------------------|
| SIP Configuration | `screens/settings/SipConfigurationScreen.tsx` | `sip/service.ts`, `sip/storage.ts`, `sip/provisioningProfile.ts` |
| Desk Phone QR | SIP settings scan flow | `auth/provisionService.ts`, `sip/qrProvisioning.ts` |
| Audio Settings | Extend settings / in-call | `calling/audioRoute.ts` |
| Notification Settings | `screens/settings/NotificationsScreen.tsx` | `store/settingsStore.ts`, `notifications/*` |
| Profile | `screens/settings/ProfileScreen.tsx` | `store/authStore.ts`, `auth/authService.ts` |

---

## Phase 4.5 — Performance & polish

Cross-cutting improvements applied after feature screens are complete:

| Area | Techniques |
|------|------------|
| Animations | Reanimated, shared timing from theme |
| Skeleton loaders | `components/ui/SkeletonLoader.tsx` |
| FlashList | Contacts, recents, voicemail, messages |
| Memory optimization | Memoization, query cache tuning, lazy stack screens |
| Native transitions | Stack/tab animation options in `navigation/screenOptions.ts` |

Do not rewrite working modules for style. Apply polish incrementally per screen.

---

## Existing implementation map

Before modifying **any** mobile telephony logic, inspect these code paths and decide whether a change is necessary.

### SIP registration

| Module | Role |
|--------|------|
| `sip/service.ts` | SIP profile load, Telnyx registration orchestration |
| `sip/storage.ts` | Persisted SIP profile (SecureStore) |
| `sip/provisioningProfile.ts` | Map server provisioning → local profile |
| `calling/TelnyxCallingProvider.tsx` | React provider; connects SDK to app lifecycle |
| `calling/telnyxVoip.ts` | Telnyx VoIP client instance |
| `calling/softphonePresence.ts` | Presence heartbeat to backend |

### Call controller

| Module | Role |
|--------|------|
| `calling/callingController.ts` | Dial, answer, hangup, hold, mute, DTMF |
| `calling/callSessionTracker.ts` | Track call lifecycle for CDR / bridge grace |
| `calling/telnyxCallMapping.ts` | Map Telnyx SDK states → UI states |
| `calling/dialNormalization.ts` | PSTN vs extension dial input |
| `calling/callerIdentity.ts` | Resolve display name for inbound/outbound |

### Push notifications

| Module | Role |
|--------|------|
| `notifications/PushNotificationProvider.tsx` | FCM registration, incoming call wake |
| `notifications/pushTokenService.ts` | POST push token to backend |
| `notifications/messageNotifications.ts` | SMS/message alerts |
| `notifications/nativeBridge.ts` | Native notification hooks |

### Authentication (4.1 complete)

| Module | Role |
|--------|------|
| `store/authStore.ts` | Auth state machine |
| `auth/authService.ts` | Login, refresh, logout, authorized requests |
| `auth/sessionRestore.ts` | Auto-login planning |
| `auth/biometricAuth.ts` | Face ID / fingerprint gate |
| `auth/tokenStorage.ts` | Secure token storage |

### QR provisioning

| Module | Role |
|--------|------|
| `auth/provisionService.ts` | Redeem mobile/desk QR via `POST /api/mobile/provision` |
| `auth/provisionQr.ts` | Parse and validate QR payload |
| `auth/qrLogin.ts` | Mobile login QR helpers |
| `screens/QrLoginScreen.tsx` | Camera scan UX |
| `sip/qrProvisioning.ts` | Desk SIP QR import |

### Call state management

| Module | Role |
|--------|------|
| `store/callingStore.ts` | `incomingCall`, `activeCall`, connection state |
| `calling/CallOverlay.tsx` | Full-screen incoming + active call UI shell |
| `hooks/usePhoneConnection.ts` | Connection status for UI |

---

## Architecture principle

```
Backend (frozen)  →  mobile services  →  Zustand stores  →  screens
```

**Extend** services and stores. **Polish** screens. **Do not replace** working telephony modules unless fixing a verified defect.

---

## Related docs

- [Mobile development rules (mandatory)](./03-mobile-development-rules.md)
- [Feature matrix](./01-mobile-feature-matrix.md)
- [Mobile design system](../../../mobile-rn/docs/DESIGN.md)
