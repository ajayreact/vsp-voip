# VSP Phone — Phase 4

**React Native mobile application only.**

Phase 2 PAT is complete and the backend is **feature-frozen**. All new product work in Phase 4 happens in `mobile-rn/` unless a production bug requires a minimal backend fix.

| Item | Detail |
|------|--------|
| **Status** | Active |
| **Codebase** | `mobile-rn/` |
| **Backend baseline tag** | `phase2-production-ready` (`1c1fb1d`) |
| **Backend changes** | Bug fixes discovered during mobile development only |

---

## Scope (in scope)

| Feature | Document |
|---------|----------|
| Feature matrix & current status | [01-mobile-feature-matrix.md](./01-mobile-feature-matrix.md) |
| Backend freeze rules | [02-backend-freeze-rules.md](./02-backend-freeze-rules.md) |
| Mobile design system | [../../../mobile-rn/docs/DESIGN.md](../../../mobile-rn/docs/DESIGN.md) |
| Firebase / push setup | [../../../mobile-rn/docs/ANDROID-FIREBASE-SETUP.md](../../../mobile-rn/docs/ANDROID-FIREBASE-SETUP.md) |

### Phase 4 feature list

1. **QR Login** — scan admin-generated provisioning QR; no manual SIP entry on happy path
2. **Remember Me** — persist session across app restarts (SecureStore)
3. **Biometric Login** — Face ID / Touch ID / Android biometrics for returning users
4. **Dial Pad** — outbound PSTN and extension dialing
5. **Contacts** — tenant directory and device contacts integration
6. **Call History** — recent calls, detail, tap-to-call
7. **Incoming Call UI** — full-screen answer/decline; lock-screen behavior
8. **In-Call Screen** — mute, hold, hangup, DTMF, audio route
9. **Voicemail** — list, playback, mark read
10. **Push Notifications** — incoming call and message alerts (FCM / APNs)
11. **Settings** — profile, theme, notifications, SIP diagnostics
12. **Desk Phone Provisioning support** — scan desk SIP QR from admin portal

---

## Out of scope

Do **not** implement in Phase 4:

| Area | Reason |
|------|--------|
| New PBX features (IVR builder, new routing rules, etc.) | Backend frozen |
| Browser WebRTC / softphone re-enablement | Phase 2 admin-only browser policy |
| Database schema changes | Frozen unless bug fix requires it |
| Call Control / Telnyx handler refactors | Frozen |
| Flutter `mobile/` | Removed in Phase 2.8 |
| Tenant portal feature work | Phase 2 complete; bug fixes only |

---

## Development rules

1. Work in `mobile-rn/` first. Reuse existing `/api/*` and softphone endpoints.
2. Before any backend change, confirm it is a **confirmed bug** with a regression test.
3. Run `npm run test:mobile` before every mobile PR.
4. Run `npm run test:telephony` before any backend bug-fix PR.
5. No new REST endpoints for mobile convenience — use existing contracts from Phase 2.

---

## Commit pattern

```bash
# Mobile-only change
npm run test:mobile

# Mobile + backend bug fix
npm run test:mobile
npm run test:telephony
```

Prefix commits: `feat(mobile):`, `fix(mobile):`, or `fix(api):` (bug fix only).

---

## Related docs

- [Phase 2 completion & PAT](../phase2/10-production-acceptance.md)
- [Backend freeze](../phase2/06-backend-telephony-freeze.md)
- [Mobile roadmap (product)](../roadmap/08-mobile-roadmap.md)
- [PBX mobile reference](../pbx/19-mobile-app.md) — update to React Native in Phase 4
