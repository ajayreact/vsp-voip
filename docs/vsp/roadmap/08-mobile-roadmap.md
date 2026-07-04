# Mobile Roadmap

React Native mobile platform — **Phase 4 active**. Flutter `mobile/` was removed in Phase 2.8.

**Authoritative Phase 4 scope:** [../phase4/README.md](../phase4/README.md)

---

## Current state

| Item | Status |
|------|--------|
| React Native app (`mobile-rn/`) | 🔄 Phase 4 — primary client |
| Android | 🔄 In development |
| iOS | ❌ Not shipped |
| QR Login | 🔄 Partial |
| Remember Me / Biometric | ❌ Phase 4 |
| Push notifications (FCM) | 🔄 Partial |
| Incoming / in-call UI polish | 🔄 Phase 4 |
| Desk phone QR (mobile side) | 🔄 Partial |
| Flutter Android | ❌ Removed |

Code: `mobile-rn/` — see [../pbx/19-mobile-app.md](../pbx/19-mobile-app.md), [../../../mobile-rn/docs/PHASE4.md](../../../mobile-rn/docs/PHASE4.md)

---

## Phase 4 — React Native GA (active)

| Item | Detail |
|------|--------|
| **Platform** | React Native / Expo (`mobile-rn/`) |
| **Backend** | Frozen at `phase2-production-ready` — bug fixes only |
| **Auth** | QR Login, Remember Me, Biometric |
| **Calling** | Dial pad, call history, incoming UI, in-call screen |
| **Voicemail** | List + playback |
| **Push** | Reliable incoming call alert (FCM; APNs later) |
| **Desk phone** | Scan admin SIP QR from mobile settings |
| **Release tag** | TBD after Phase 4 PAT |

See [../phase4/01-mobile-feature-matrix.md](../phase4/01-mobile-feature-matrix.md) for per-feature status.

---

## Future — Native telephony UI (post Phase 4)

| Item | Platform | Detail |
|------|----------|--------|
| **CallKit** | iOS | Native incoming call screen, lock screen |
| **ConnectionService** | Android | System call UI, Bluetooth routing |
| **Background calls** | Both | Answer/hangup when app backgrounded |
| **iOS GA** | iOS | TestFlight → App Store |

**Depends on:** Push notifications reliable in Phase 4.

---

## Future — Enterprise mobile

| Item | Detail |
|------|--------|
| SSO mobile login | Enterprise IdP |
| MDM deployment | Managed app config |
| Supervisor mobile | Queue stats (read-only) |
| CRM screen-pop | Deep link from push payload |

---

## Testing (mobile)

| Test | Method |
|------|--------|
| Auth | `scripts/verify-mobile-auth.js` |
| Unit / integration | `npm run test:mobile` |
| Inbound | Physical device + Telnyx debugger |
| Push | FCM test payload |
| Background | OS-specific QA matrix |

---

## Dependencies

| Mobile feature | Requires |
|----------------|----------|
| CallKit | iOS app, push |
| ConnectionService | Android GA |
| QR Login | Phase 2 provisioning API (frozen ✅) |
| Desk phone QR | Phase 2 portal QR generation (frozen ✅) |

See [03-feature-dependencies.md](./03-feature-dependencies.md)

---

## Related docs

- [Phase 4 README](../phase4/README.md)
- [04-release-plan.md](./04-release-plan.md)
- [../pbx/19-mobile-app.md](../pbx/19-mobile-app.md)
- [mobile-rn/docs/DESIGN.md](../../../mobile-rn/docs/DESIGN.md)
